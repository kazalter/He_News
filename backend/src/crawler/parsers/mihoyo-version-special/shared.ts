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
  weaponName?: string;
  weaponRarity?: number;
  isNewWeapon: boolean;
  startAt?: Date;
  endAt?: Date;
  rawTime?: string;
  rawRoleInfo?: string;
  rawConeInfo?: string;
};

export type ParsedVersionEvent = {
  // 'character' 用于游戏没有结构化卡池但仍需要表达"新角色"时（如绝区零）。
  category: 'event' | 'other' | 'story' | 'character';
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

export type Mi18nPayload = Record<string, string>;

export const USER_AGENT =
  'HE-News/0.1 (+https://local.app; official-news-aggregator)';

export async function fetchText(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    headers: { 'User-Agent': USER_AGENT },
    responseType: 'text',
    timeout: 20000,
    transformResponse: [(value: unknown) => value as string],
  });
  return response.data;
}

export function extractConfigUrl(html: string, base: string): string | undefined {
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

export function extractMi18nKey(configJs: string): string | undefined {
  const match = configJs.match(/mi18n\s*:\s*\{[^}]*key\s*:\s*"([^"]+)"/);
  return match?.[1];
}

export function buildMi18nUrl(prefix: string, key: string): string {
  return `https://fastcdn.mihoyo.com/mi18n/${prefix}/${key}/${key}-zh-cn.json`;
}

/**
 * 从 mihoyo 专题里常见的 `share_title` / `baseinfo-title` 抓版本号 + 副标题。
 *   星穹铁道：`《崩坏：星穹铁道》4.3版本「沉于生者的忘川」前瞻特别节目`
 *   绝区零：  `《绝区零》官网-2.8全新版本「新·艾利都日落时」现已上线！`
 */
export function extractVersionAndSubtitle(i18n: Mi18nPayload): {
  version: string;
  subtitle?: string;
} {
  const title = i18n['baseinfo-title'] || i18n.share_title || '';
  const match = title.match(/(\d+\.\d+)(?:[^「]*?)?版本(?:「([^」]+)」)?/);
  if (!match) {
    throw new Error(
      `无法从专题标题中识别版本号（baseinfo-title="${title}"）`,
    );
  }
  return { version: match[1], subtitle: match[2] };
}

export function pickCoverUrl(i18n: Mi18nPayload): string | undefined {
  const candidates = [
    'pic_share',
    'pic_share_bili',
    'slg-src',
    'wechart_share_img',
    'baseinfo-seo-image',
  ];
  for (const key of candidates) {
    const value = i18n[key];
    if (typeof value === 'string' && /^https?:\/\//.test(value)) {
      return value;
    }
  }
  return undefined;
}

export function stripWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function stripHtml(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return stripWhitespace(value.replace(/<[^>]+>/g, ' '));
}

export function sameName(a: string, b: string): boolean {
  return stripWhitespace(a) === stripWhitespace(b);
}

export function parseMihoyoDateTime(value: string): Date | undefined {
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

export function collectListField(
  i18n: Mi18nPayload,
  prefix: string,
  max = 20,
): string[] {
  const items: string[] = [];
  for (let i = 1; i <= max; i += 1) {
    const value = i18n[`${prefix}${i}`];
    if (typeof value !== 'string' || value.length === 0) {
      continue;
    }
    items.push(value);
  }
  return items;
}
