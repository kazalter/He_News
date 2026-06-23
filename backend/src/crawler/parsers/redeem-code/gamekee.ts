/**
 * GameKee（K站）兑换码词条 parser。
 *
 * 鸣潮等游戏在 GameKee 维护了一张人工整理的兑换码表，比从评论区/正文正则抠码干净得多：
 * 词条正文（content_json）里有结构化表格，列固定为 `兑换码 | 奖励 | 有效期至 | 来源`。
 * 取数走 GameKee content/detail 接口（见 ../../gamekee fetchGamekeeContentJson）。
 *
 * 有效 / 过期怎么分：
 *   - 顶层那张 table 是「有效码」（当前可能只有表头 + 空行，即暂无有效码）；
 *   - 「已过期：」段之后、折叠块（type=`flod`，title 含「已过期」）里那张 table 是过期码。
 * 解析时按文档顺序走，遇到含「已过期」的段落/折叠块标题就把 expired 置真（粘性，之后的
 * 表都算过期）。过期码照样吐出去（status=expired）——persistRedeemCodes 只拿它降级库里
 * 已有的同码、不新建，正好用得上。
 *
 * source.url 存的是词条的人类可读地址：`https://www.gamekee.com/<alias>/<contentId>.html`，
 * 从里面解出 alias（鸣潮=mc）和 contentId（兑换码词条=622905）。
 *
 * 脆点：GameKee 换富文本编辑器 / 改表格列序 / 改折叠块结构，解析会 silently 返回空。
 * spec 用按真实结构缩写的 fixture 钉死。
 */
import { fetchGamekeeContentJson } from '../../gamekee';
import { ParsedRedeemCode } from './types';

export async function parseGamekeeCodes(
  url: string,
): Promise<ParsedRedeemCode[]> {
  const { alias, contentId } = parseGamekeeCodeUrl(url);
  const blocks = await fetchGamekeeContentJson(contentId, alias);
  return extractGamekeeCodes(blocks);
}

/** 从 `https://www.gamekee.com/<alias>/<contentId>.html` 解出 alias + contentId。 */
export function parseGamekeeCodeUrl(url: string): {
  alias: string;
  contentId: string;
} {
  const match = url.match(/gamekee\.com\/([^/]+)\/(\d+)\.html/i);
  if (!match) {
    throw new Error(`无法从 URL 解析 GameKee alias/contentId：${url}`);
  }
  return { alias: match[1], contentId: match[2] };
}

type SlateNode = {
  type?: string;
  text?: string;
  title?: string;
  children?: SlateNode[];
};

export function extractGamekeeCodes(contentJson: unknown): ParsedRedeemCode[] {
  const blocks = normalizeBlocks(contentJson);
  // 同码去重，有效优先（理论上一份词条不会重复，但稳妥处理）。
  const byCode = new Map<string, ParsedRedeemCode>();
  let expired = false;

  const walk = (nodes: SlateNode[]) => {
    for (const node of nodes) {
      if (node?.type === 'table') {
        parseTable(node, expired, byCode);
        continue;
      }
      // 折叠块标题 / 段落文本里出现「已过期」就翻牌：之后的表都归过期区。
      if (isExpiredMarker(node)) {
        expired = true;
      }
      if (Array.isArray(node?.children)) {
        walk(node.children);
      }
    }
  };

  walk(blocks);
  return [...byCode.values()];
}

function parseTable(
  table: SlateNode,
  expired: boolean,
  byCode: Map<string, ParsedRedeemCode>,
) {
  for (const row of table.children ?? []) {
    if (row?.type !== 'table-row') {
      continue;
    }
    const cells = (row.children ?? []).filter(
      (cell) => cell?.type === 'table-cell',
    );
    if (cells.length < 2) {
      continue;
    }

    // 列序：兑换码 | 奖励 | 有效期至 | 来源。表头行/空行的首列不是合法码，自然被跳过。
    const code = normalizeCode(cellText(cells[0]));
    if (!code) {
      continue;
    }

    const reward = cellText(cells[1]) || null;
    const expiredAt = parseValidUntil(cellText(cells[2]));
    const description = cellText(cells[3]) || null;

    mergeCandidate(byCode, {
      code,
      reward: expired ? null : reward,
      description,
      expiredAt,
      status: expired ? 'expired' : 'unused',
    });
  }
}

function normalizeBlocks(contentJson: unknown): SlateNode[] {
  if (Array.isArray(contentJson)) {
    return contentJson as SlateNode[];
  }
  if (typeof contentJson === 'string') {
    try {
      const parsed = JSON.parse(contentJson);
      return Array.isArray(parsed) ? (parsed as SlateNode[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** 折叠块看 title，其它节点看自身文本——表格内容不参与判定（避免过期码单元格误翻牌）。 */
function isExpiredMarker(node: SlateNode): boolean {
  const title = typeof node?.title === 'string' ? node.title : '';
  const text = node?.type === 'table' ? '' : cellText(node);
  return /已过期/.test(title) || /已过期/.test(text);
}

/** 递归取节点下所有 text，拼接并压空白。 */
function cellText(node: SlateNode | undefined): string {
  if (!node) {
    return '';
  }
  const out: string[] = [];
  const walk = (n: SlateNode) => {
    if (typeof n?.text === 'string') {
      out.push(n.text);
    }
    (n?.children ?? []).forEach(walk);
  };
  walk(node);
  return out.join('').replace(/\s+/g, ' ').trim();
}

function normalizeCode(text: string): string | null {
  const upper = text.toUpperCase();
  // 纯字母数字、4–30 位。鸣潮码常是全字母（ILLUSIONHAUNTS）或字母数字（MINGCHAO666）。
  return /^[A-Z0-9]{4,30}$/.test(upper) ? upper : null;
}

/** 解析「2025年7月20日23:59」这类中文日期（按东八区）。解析不出（已过期/未知/长期有效）→ null。 */
function parseValidUntil(text: string): Date | null {
  const match = text.match(
    /(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2}):(\d{2}))?/,
  );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour = '23', minute = '59'] = match;
  const pad = (value: string) => value.padStart(2, '0');
  const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+08:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mergeCandidate(
  map: Map<string, ParsedRedeemCode>,
  candidate: ParsedRedeemCode,
) {
  const existing = map.get(candidate.code);
  if (!existing) {
    map.set(candidate.code, candidate);
    return;
  }
  // 有效区盖过过期区。
  if (existing.status === 'expired' && candidate.status === 'unused') {
    map.set(candidate.code, candidate);
    return;
  }
  if (!existing.reward && candidate.reward) {
    existing.reward = candidate.reward;
  }
}
