/**
 * 崩坏：星穹铁道版本前瞻专题 parser。
 *
 * 输入：`https://act.mihoyo.com/puzzle/hkrpg/eYYYYMMDD<slug>/index.html`
 * 抓取：landing HTML → config.<hash>.js → mi18n key → mi18n JSON
 * 输出：包含 `poolList_*` 卡池信息、`charList_*` 新角色、`coneList_*` 新光锥的
 *      结构化 ParsedVersionPlan。
 */
import {
  ParsedVersionBanner,
  ParsedVersionEvent,
  ParsedVersionPlan,
  Mi18nPayload,
  buildMi18nUrl,
  collectListField,
  extractConfigUrl,
  extractMi18nKey,
  extractVersionAndSubtitle,
  fetchText,
  parseMihoyoDateTime,
  pickCoverUrl,
  sameName,
  stripHtml,
  stripWhitespace,
} from './shared';

const MI18N_PREFIX = 'hkrpg_cn';

export async function parseHkrpgVersionSpecial(
  landingUrl: string,
): Promise<ParsedVersionPlan> {
  const landingHtml = await fetchText(landingUrl);
  const configUrl = extractConfigUrl(landingHtml, landingUrl);
  if (!configUrl) {
    throw new Error('未在专题页中找到 config.<hash>.js 入口');
  }

  const configJs = await fetchText(configUrl);
  const mi18nKey = extractMi18nKey(configJs);
  if (!mi18nKey) {
    throw new Error('未在 config.js 中找到 mi18n key');
  }

  const i18nUrl = buildMi18nUrl(MI18N_PREFIX, mi18nKey);
  const i18nRaw = await fetchText(i18nUrl);
  const i18n = JSON.parse(i18nRaw) as Mi18nPayload;

  const { version, subtitle } = extractVersionAndSubtitle(i18n);

  const newCharacterNames = collectListField(i18n, 'charList_name_').map(
    (value) => stripWhitespace(value),
  );
  const newLightConeNames = collectListField(i18n, 'coneList_name_').map(
    (value) => stripWhitespace(value),
  );

  const banners = parseBanners(i18n, newCharacterNames, newLightConeNames);
  const events = parseEvents(i18n);
  const releaseAt = estimateReleaseAt(banners);

  return {
    version,
    subtitle,
    coverUrl: pickCoverUrl(i18n),
    officialUrl: landingUrl,
    providerUrl: i18nUrl,
    releaseAt,
    rawJson: i18nRaw,
    banners,
    events,
  };
}

function estimateReleaseAt(banners: ParsedVersionBanner[]): Date | undefined {
  // mihoyo 专题里 phase 1 的 startAt 写作 "X.Y版本更新后" 无法直接解析。
  // phase 1 的 endAt 就是 phase 2 的 startAt（差 1 分钟的维护窗），
  // 取 phase 1 endAt - 21 天作为版本上线时间的估算。
  const phase1Ends = banners
    .filter((b) => b.phase === 1 && b.endAt)
    .map((b) => b.endAt as Date)
    .sort((a, b) => a.getTime() - b.getTime());
  const phase2Starts = banners
    .filter((b) => b.phase === 2 && b.startAt)
    .map((b) => b.startAt as Date)
    .sort((a, b) => a.getTime() - b.getTime());
  const anchor = phase1Ends[0] ?? phase2Starts[0];
  if (!anchor) {
    return undefined;
  }
  return new Date(anchor.getTime() - 21 * 24 * 3600 * 1000);
}

function parseBanners(
  i18n: Mi18nPayload,
  newCharacterNames: string[],
  newLightConeNames: string[],
): ParsedVersionBanner[] {
  const banners: ParsedVersionBanner[] = [];

  for (let poolIndex = 1; poolIndex <= 12; poolIndex += 1) {
    const name = i18n[`poolList_name_${poolIndex}`];
    const time = i18n[`poolList_time_${poolIndex}`];
    const roleInfo = i18n[`poolList_roleInfo_${poolIndex}`];
    const coneInfo = i18n[`poolList_coneInfo_${poolIndex}`];

    if (!name && !time && !roleInfo && !coneInfo) {
      continue;
    }

    const phase = inferPhase(name, poolIndex);
    const { startAt, endAt } = parseBannerTime(time);

    const character = parseLimitedCharacter(roleInfo);
    const lightCone = parseLimitedLightCone(coneInfo);

    banners.push({
      phase,
      poolIndex,
      poolName: name,
      characterName: character?.name,
      characterRarity: character?.rarity,
      characterPath: character?.path,
      characterElement: character?.element,
      isNewCharacter: Boolean(
        character && newCharacterNames.some((n) => sameName(n, character.name)),
      ),
      lightConeName: lightCone?.name,
      lightConeRarity: lightCone?.rarity,
      isNewLightCone: Boolean(
        lightCone && newLightConeNames.some((n) => sameName(n, lightCone.name)),
      ),
      startAt,
      endAt,
      rawTime: time,
      rawRoleInfo: roleInfo,
      rawConeInfo: coneInfo,
    });
  }

  return banners;
}

function inferPhase(poolName: string | undefined, poolIndex: number): number {
  if (poolName) {
    const cnMatch = poolName.match(/第([一二三四五六])期/);
    if (cnMatch) {
      const map: Record<string, number> = {
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
      };
      const phase = map[cnMatch[1]];
      if (phase) {
        return phase;
      }
    }
    const arabicMatch = poolName.match(/第(\d+)期/);
    if (arabicMatch) {
      return Number(arabicMatch[1]);
    }
  }
  return Math.ceil(poolIndex / 2);
}

function parseBannerTime(time?: string): {
  startAt?: Date;
  endAt?: Date;
} {
  if (!time) {
    return {};
  }
  const halves = time.split(/\s*[-–—]\s*/);
  if (halves.length !== 2) {
    return {};
  }
  return {
    startAt: parseMihoyoDateTime(halves[0]),
    endAt: parseMihoyoDateTime(halves[1]),
  };
}

function parseLimitedCharacter(text?: string): {
  name: string;
  rarity: number;
  path?: string;
  element?: string;
} | undefined {
  if (!text) {
    return undefined;
  }
  const match = text.match(
    /限定(\d)星角色「([^（(]+?)[（(]([^）)]+)[）)]」/,
  );
  if (!match) {
    return undefined;
  }
  const [, rarity, rawName, attrs] = match;
  const name = stripWhitespace(rawName);
  const parts = attrs
    .split(/[•·・]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    name,
    rarity: Number(rarity),
    path: parts[0],
    element: parts[1],
  };
}

function parseLimitedLightCone(text?: string): {
  name: string;
  rarity: number;
} | undefined {
  if (!text) {
    return undefined;
  }
  const match = text.match(/限定(\d)星光锥「([^」]+)」/);
  if (!match) {
    return undefined;
  }
  // 实际数据里 5★ 光锥往往写作「名字（路径）」，把括号尾巴剥掉再返回，
  // 方便和 coneList_name_* 里的清洁名匹配以判断「新光锥」。
  const cleanName = stripWhitespace(match[2]).replace(/[（(][^）)]*[）)]$/, '').trim();
  return {
    name: cleanName || stripWhitespace(match[2]),
    rarity: Number(match[1]),
  };
}

function parseEvents(i18n: Mi18nPayload): ParsedVersionEvent[] {
  const events: ParsedVersionEvent[] = [];

  for (let i = 1; i <= 20; i += 1) {
    const name = i18n[`eventList_name_${i}`];
    if (!name) {
      continue;
    }
    events.push({
      category: 'event',
      name: stripWhitespace(name),
      info: stripHtml(i18n[`eventList_info_${i}`]),
    });
  }

  for (let i = 1; i <= 20; i += 1) {
    const name = i18n[`otherList_name_${i}`];
    if (!name) {
      continue;
    }
    events.push({
      category: 'other',
      name: stripWhitespace(name),
      label: i18n[`otherList_label_${i}`]
        ? stripWhitespace(i18n[`otherList_label_${i}`])
        : undefined,
      info: stripHtml(i18n[`otherList_info_${i}`]),
    });
  }

  for (let i = 1; i <= 10; i += 1) {
    const name = i18n[`storyList_name_${i}`];
    if (!name) {
      continue;
    }
    events.push({
      category: 'story',
      name: stripWhitespace(name),
      label: i18n[`storyList_typeInfo_${i}`]
        ? stripWhitespace(i18n[`storyList_typeInfo_${i}`])
        : undefined,
      info: stripHtml(i18n[`storyList_info_${i}`]),
    });
  }

  return events;
}
