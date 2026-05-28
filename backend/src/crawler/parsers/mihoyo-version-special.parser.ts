import axios from 'axios';

export type ParsedVersionBanner = {
  phase: number;
  poolIndex: number;
  poolName?: string;
  characterName?: string;
  characterRarity?: number;
  characterPath?: string;
  characterElement?: string;
  isNewCharacter: boolean;
  lightConeName?: string;
  lightConeRarity?: number;
  isNewLightCone: boolean;
  startAt?: Date;
  endAt?: Date;
  rawTime?: string;
  rawRoleInfo?: string;
  rawConeInfo?: string;
};

export type ParsedVersionEvent = {
  category: 'event' | 'other' | 'story';
  name: string;
  label?: string;
  info?: string;
};

export type ParsedVersionPlan = {
  version: string;
  subtitle?: string;
  coverUrl?: string;
  officialUrl: string;
  providerUrl: string;
  releaseAt?: Date;
  rawJson: string;
  banners: ParsedVersionBanner[];
  events: ParsedVersionEvent[];
};

type Mi18nPayload = Record<string, string>;

const GAME_PREFIX: Record<string, string> = {
  hkrpg: 'hkrpg_cn',
  hk4e: 'hk4e_cn',
  nap: 'nap_cn',
  bh3: 'bh3_cn',
};

const USER_AGENT =
  'HE-News/0.1 (+https://local.app; official-news-aggregator)';

export async function parseMihoyoVersionSpecial(
  landingUrl: string,
): Promise<ParsedVersionPlan> {
  const url = new URL(landingUrl);
  const gameKey = detectGameKey(url);

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

  const i18nUrl = `https://fastcdn.mihoyo.com/mi18n/${gameKey}/${mi18nKey}/${mi18nKey}-zh-cn.json`;
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

function detectGameKey(landingUrl: URL): string {
  const segments = landingUrl.pathname.split('/').filter(Boolean);
  const puzzleIdx = segments.indexOf('puzzle');
  if (puzzleIdx >= 0 && segments[puzzleIdx + 1]) {
    const slug = segments[puzzleIdx + 1];
    if (GAME_PREFIX[slug]) {
      return GAME_PREFIX[slug];
    }
    return `${slug}_cn`;
  }
  return 'hkrpg_cn';
}

async function fetchText(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    headers: { 'User-Agent': USER_AGENT },
    responseType: 'text',
    timeout: 20000,
    transformResponse: [(value: unknown) => value as string],
  });
  return response.data;
}

function extractConfigUrl(html: string, base: string): string | undefined {
  const match = html.match(/src="([^"]+config\.[0-9a-f]+\.js)"/i);
  if (!match) {
    return undefined;
  }
  try {
    return new URL(match[1], base).toString();
  } catch {
    return undefined;
  }
}

function extractMi18nKey(configJs: string): string | undefined {
  const match = configJs.match(/mi18n\s*:\s*\{[^}]*key\s*:\s*"([^"]+)"/);
  return match?.[1];
}

function extractVersionAndSubtitle(i18n: Mi18nPayload): {
  version: string;
  subtitle?: string;
} {
  const title = i18n['baseinfo-title'] || i18n.share_title || '';
  const match = title.match(/(\d+\.\d+)版本(?:「([^」]+)」)?/);
  if (!match) {
    throw new Error(
      `无法从专题标题中识别版本号（baseinfo-title="${title}"）`,
    );
  }
  return { version: match[1], subtitle: match[2] };
}

function collectListField(
  i18n: Mi18nPayload,
  prefix: string,
): string[] {
  const items: string[] = [];
  for (let i = 1; i <= 20; i += 1) {
    const value = i18n[`${prefix}${i}`];
    if (typeof value !== 'string' || value.length === 0) {
      continue;
    }
    items.push(value);
  }
  return items;
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

function parseMihoyoDateTime(value: string): Date | undefined {
  const match = value.match(
    /(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/,
  );
  if (!match) {
    return undefined;
  }
  const [, y, m, d, hh, mm] = match;
  const iso = `${y}-${pad(m)}-${pad(d)}T${pad(hh ?? '00')}:${pad(mm ?? '00')}:00+08:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function pad(value: string) {
  return value.padStart(2, '0');
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

function pickCoverUrl(i18n: Mi18nPayload): string | undefined {
  const candidates = [
    'pic_share',
    'pic_share_bili',
    'slg-src',
    'wechart_share_img',
  ];
  for (const key of candidates) {
    const value = i18n[key];
    if (typeof value === 'string' && /^https?:\/\//.test(value)) {
      return value;
    }
  }
  return undefined;
}

function stripWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return stripWhitespace(value.replace(/<[^>]+>/g, ' '));
}

function sameName(a: string, b: string): boolean {
  return stripWhitespace(a) === stripWhitespace(b);
}
