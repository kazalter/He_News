/**
 * B站评论区兑换码 parser。
 *
 * 思路（用户需求）：米哈游前瞻/活动视频下，玩家常把兑换码贴在评论里。这里：
 *   1. 从 source.url 解析出视频 oid(aid)——支持 BV 号（走 view API 换 aid）或
 *      直接给 av/oid 数字。
 *   2. 调评论 API x/v2/reply?sort=2（按热度），翻几页，连带二级评论一起扫。
 *   3. 评论噪音极大，精度优先：码取 [A-Z0-9]{8,20} 且字母数字都有、排除 BV/av；
 *      保留条件 = 评论里出现「兑换码/口令/cdk」等关键词，或命中米哈游直播码的
 *      标准 12 位形态。点赞数当 confidence（高赞码更可信，留给上层排序/过滤）。
 *
 * 召回不追求全（standalone 无关键词的非 12 位码会漏），那是聚合页(game8)的活；
 * 评论源补的是"社区贴得快"的时效。
 *
 * 脆点：B站可能给评论接口加 wbi 签名/风控；real 抓不到时整源 silently 空。
 */
import axios from 'axios';
import { ParsedRedeemCode } from './types';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const VIEW_API = 'https://api.bilibili.com/x/web-interface/view';
const REPLY_API = 'https://api.bilibili.com/x/v2/reply';
const MAX_PAGES = 3;

const REDEEM_KEYWORDS = /兑换码|口令|礼包码|福利码|前瞻码|cdk/i;

interface BiliReply {
  content?: { message?: string };
  like?: number;
  member?: { uname?: string };
  replies?: BiliReply[] | null;
}

export async function parseBilibiliComments(
  url: string,
): Promise<ParsedRedeemCode[]> {
  const oid = await resolveOid(url);
  const replies: BiliReply[] = [];

  for (let pn = 1; pn <= MAX_PAGES; pn += 1) {
    const res = await axios.get(REPLY_API, {
      params: { type: 1, oid, pn, sort: 2 },
      headers: { 'User-Agent': BROWSER_UA, Referer: 'https://www.bilibili.com' },
      timeout: 15000,
    });

    if (res.data?.code !== 0) {
      break;
    }

    const pageReplies: BiliReply[] = res.data?.data?.replies ?? [];
    if (pageReplies.length === 0) {
      break;
    }

    replies.push(...pageReplies);
  }

  return collectCodesFromReplies(replies);
}

/** 从 source.url 里抠出 oid：优先 BV 号（换 aid），否则 av/oid 数字。 */
export async function resolveOid(url: string): Promise<string> {
  const bv = parseBvid(url);
  if (bv) {
    const res = await axios.get(VIEW_API, {
      params: { bvid: bv },
      headers: { 'User-Agent': BROWSER_UA },
      timeout: 15000,
    });
    const aid = res.data?.data?.aid;
    if (!aid) {
      throw new Error(`B站 view API 无法解析 BV→aid: ${bv}`);
    }
    return String(aid);
  }

  const num = url.match(/(?:av|oid=)(\d+)/i)?.[1];
  if (num) {
    return num;
  }

  throw new Error(`B站码源 url 需含 BV 号或 av/oid 数字: ${url}`);
}

export function parseBvid(url: string): string | null {
  return url.match(/BV[0-9A-Za-z]{10}/)?.[0] ?? null;
}

/** 纯函数：把一串评论（含二级）映射成去重后的码（带作者/点赞）。 */
export function collectCodesFromReplies(
  replies: BiliReply[],
): ParsedRedeemCode[] {
  const byCode = new Map<string, ParsedRedeemCode>();

  const visit = (reply: BiliReply) => {
    const message = reply?.content?.message ?? '';
    const uname = reply?.member?.uname ?? '';
    const like = reply?.like ?? 0;

    for (const code of extractCodesFromComment(message)) {
      const existing = byCode.get(code);
      // 同码留点赞更高的那条（更可信）。
      if (!existing || (existing.confidence ?? 0) < like) {
        byCode.set(code, {
          code,
          description: uname ? `B站评论@${uname}` : 'B站评论',
          confidence: like,
        });
      }
    }

    for (const sub of reply?.replies ?? []) {
      visit(sub);
    }
  };

  for (const reply of replies) {
    visit(reply);
  }

  return [...byCode.values()];
}

/** 纯函数：从单条评论文本里抠码。精度优先（见文件头注释）。 */
export function extractCodesFromComment(text: string): string[] {
  const upper = text.toUpperCase();
  const hasKeyword = REDEEM_KEYWORDS.test(text);
  const out = new Set<string>();

  for (const match of upper.matchAll(/\b[A-Z0-9]{8,20}\b/g)) {
    const code = match[0];

    // 字母数字都得有，滤掉纯数字串/纯词。
    if (!/[A-Z]/.test(code) || !/[0-9]/.test(code)) {
      continue;
    }
    // B站视频号/av 号别误当码。
    if (/^BV[A-Z0-9]{10}$/.test(code) || /^AV\d+$/.test(code)) {
      continue;
    }

    // 米哈游直播码标准形态：12 位字母数字。
    const canonical = /^[A-Z0-9]{12}$/.test(code);
    if (hasKeyword || canonical) {
      out.add(code);
    }
  }

  return [...out];
}
