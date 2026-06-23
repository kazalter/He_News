/**
 * GameKee（K站，www.gamekee.com）卡池接口。
 *
 * GameKee 是国内游戏 wiki 社区，鸣潮专区维护了结构化的卡池数据。它是个 SPA，数据走
 * 同源 JSON 接口，按 wiki 区分用请求头 `game-alias`（鸣潮 = `mc`）：
 *   GET https://www.gamekee.com/v1/cardPool/query-list
 * 返回该游戏全部卡池（按时间排，无版本号），每条带中文名 + start_at/end_at（Unix 秒）
 * + tag_id。tag 含义：12=限定（本版本首发限定 5★）、11=复刻、19=陪跑。
 *
 * 用途：官方「版本内容说明」给版本号 + 角色名单 + 首发判定，但**不带卡池时间**；
 * GameKee 正好补上精确起止时间（中文名两边一致，可直接按名匹配）。
 *
 * 脆点：GameKee 改接口/字段名，或卡池数据滞后（最新一期还没录入）→ 返回空 / 缺条目。
 * 调用方按 best-effort 处理：补不上就把时间留空，不让整源挂掉。
 */
import axios from 'axios';

const GAMEKEE_API = 'https://www.gamekee.com/v1';
const USER_AGENT =
  'HE-News/0.1 (+https://local.app; official-news-aggregator)';

/** GameKee cardPool tag：本版本首发限定。 */
export const TAG_LIMITED = 12;
/** GameKee cardPool tag：复刻。 */
export const TAG_RERUN = 11;

export type GamekeeCardPool = {
  name: string;
  startAt: Date;
  endAt: Date;
  tagIds: number[];
};

export function isLimitedNew(tagIds: number[]): boolean {
  return tagIds.includes(TAG_LIMITED);
}

export function isRerun(tagIds: number[]): boolean {
  return tagIds.includes(TAG_RERUN);
}

export async function fetchGamekeeCardPools(
  alias: string,
): Promise<GamekeeCardPool[]> {
  const { data } = await axios.get<unknown>(
    `${GAMEKEE_API}/cardPool/query-list`,
    {
      headers: { 'game-alias': alias, 'User-Agent': USER_AGENT },
      timeout: 20000,
    },
  );
  return parseCardPools(data);
}

/**
 * 取某条 wiki 词条的正文富文本块（content_json）。
 *
 * GameKee 词条正文走 `GET /content/detail/<contentId>`，正文不在 `content`（常为空），
 * 而在 `content_json`——一段 Slate 风格的富文本 JSON 字符串（块数组）。这里解析成块
 * 数组返回；接口失败 / 字段缺失 / JSON 坏掉都退回空数组，让调用方按 best-effort 处理。
 */
export async function fetchGamekeeContentJson(
  contentId: number | string,
  alias: string,
): Promise<unknown> {
  const { data } = await axios.get<{ data?: { content_json?: string } }>(
    `${GAMEKEE_API}/content/detail/${contentId}`,
    {
      headers: { 'game-alias': alias, 'User-Agent': USER_AGENT },
      timeout: 20000,
    },
  );
  const contentJson = data?.data?.content_json;
  if (!contentJson) {
    return [];
  }
  try {
    return JSON.parse(contentJson);
  } catch {
    return [];
  }
}

type RawCardPool = {
  name?: string;
  start_at?: number;
  end_at?: number;
  tag_id?: string | number;
};

export function parseCardPools(raw: unknown): GamekeeCardPool[] {
  const list = (raw as { data?: unknown })?.data;
  if (!Array.isArray(list)) {
    return [];
  }

  const pools: GamekeeCardPool[] = [];
  for (const entry of list as RawCardPool[]) {
    const name = String(entry?.name ?? '').trim();
    const start = Number(entry?.start_at);
    const end = Number(entry?.end_at);
    if (!name || !Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }
    pools.push({
      name,
      startAt: new Date(start * 1000),
      endAt: new Date(end * 1000),
      tagIds: parseTagIds(entry?.tag_id),
    });
  }
  return pools;
}

/** tag_id 形如 "19" 或 "12,11"。 */
function parseTagIds(raw: unknown): number[] {
  return String(raw ?? '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
}
