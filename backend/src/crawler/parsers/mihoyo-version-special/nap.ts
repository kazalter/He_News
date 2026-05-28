/**
 * 绝区零（NAP / Zenless Zone Zero）"版本前瞻" parser。
 *
 * 与崩坏：星穹铁道不同，绝区零并没有独立的版本前瞻专题 H5，每个版本的
 * 内容都直接更新在官网首页（`zzz.mihoyo.com` → puzzle 落地页）的 mi18n
 * 配置里。可用字段比星穹铁道少得多：
 *   - `baseinfo-title` 例：`《绝区零》官网-2.8全新版本「新·艾利都日落时」现已上线！`
 *   - `cha_name_1..3` / `cha_faction_1..3`：新角色（一般 2 个，包含势力）
 *   - `act_title_1..7` / `act_desc_1..7`：本版本活动（仅文本，无日期）
 *   - `newContent_title_1..6` / `newContent_desc_1..6`：新主线 / 签到 / PV 等
 *
 * 因此 mi18n 中没有「卡池时间」、没有「限定 X 星音擎」、也没有版本上线日期。
 * banner 数组返回为空，新角色塞进 `events[category=character]` 里，由前端单独渲染。
 * `releaseAt` 留 null —— 前端"待官方公告"占位即可。
 */
import {
  ParsedVersionEvent,
  ParsedVersionPlan,
  Mi18nPayload,
  buildMi18nUrl,
  extractConfigUrl,
  extractMi18nKey,
  extractVersionAndSubtitle,
  fetchText,
  pickCoverUrl,
  stripHtml,
  stripWhitespace,
} from './shared';

const MI18N_PREFIX = 'nap_cn';
const CHARACTER_SLOT_COUNT = 3;
const ACTIVITY_SLOT_COUNT = 7;
const NEW_CONTENT_SLOT_COUNT = 6;

export async function parseNapVersionSpecial(
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
  const events = parseEvents(i18n);

  return {
    version,
    subtitle,
    coverUrl: pickCoverUrl(i18n),
    officialUrl: landingUrl,
    providerUrl: i18nUrl,
    releaseAt: undefined,
    rawJson: i18nRaw,
    banners: [],
    events,
  };
}

function parseEvents(i18n: Mi18nPayload): ParsedVersionEvent[] {
  const events: ParsedVersionEvent[] = [];

  // 新角色：name = 角色名，label = 势力。
  for (let i = 1; i <= CHARACTER_SLOT_COUNT; i += 1) {
    const name = i18n[`cha_name_${i}`];
    if (!name || !name.trim()) {
      continue;
    }
    const faction = i18n[`cha_faction_${i}`];
    events.push({
      category: 'character',
      name: stripWhitespace(name),
      label: faction && faction.trim() ? stripWhitespace(faction) : undefined,
    });
  }

  // 活动：title + 富文本 desc。
  for (let i = 1; i <= ACTIVITY_SLOT_COUNT; i += 1) {
    const title = i18n[`act_title_${i}`];
    if (!title || !title.trim()) {
      continue;
    }
    events.push({
      category: 'event',
      name: stripWhitespace(title),
      info: stripHtml(i18n[`act_desc_${i}`]),
    });
  }

  // 新内容（主线 / 签到 / PV / 副本）：title 也可能是富文本，统一 stripHtml。
  for (let i = 1; i <= NEW_CONTENT_SLOT_COUNT; i += 1) {
    const title = i18n[`newContent_title_${i}`];
    if (!title || !title.trim()) {
      continue;
    }
    const cleanTitle = stripHtml(title);
    if (!cleanTitle) {
      continue;
    }
    events.push({
      category: 'other',
      name: cleanTitle,
      info: stripHtml(i18n[`newContent_desc_${i}`]),
    });
  }

  return events;
}
