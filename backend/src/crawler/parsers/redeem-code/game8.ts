/**
 * game8.co 兑换码聚合页 parser。
 *
 * game8 的码页是服务端渲染的规整 HTML：
 *   <h2 ...>Active Redeem Codes for ...</h2>
 *     <table class="a-table">
 *       <tr><th>Redeem Codes</th><th>Reward</th></tr>
 *       <tr>
 *         <td><input class="a-clipboard__textInput" value="VS3Q5VK9CMFP"> …</td>
 *         <td>… Stellar Jade ×100 …</td>
 *       </tr>
 *       …
 *   <h2 ...>All Expired … Codes</h2>  ← 之后的码归到过期区
 *
 * 解析策略：按文档顺序遍历 h2/h3/table，用标题切"有效/过期"两段；每个 table 行
 * 优先从 input[value] 取码（最干净），取不到再退回兑换链接 ?code=… 里的码。
 *
 * 脆点：game8 改版（换 class、把码挪进图片、改标题措辞）会让选择器 silently 返回
 * 空。spec 用代表性 fixture 钉死结构。
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { ParsedRedeemCode } from './types';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function parseGame8Codes(url: string): Promise<ParsedRedeemCode[]> {
  const response = await axios.get<string>(url, {
    headers: { 'User-Agent': BROWSER_UA },
    timeout: 20000,
  });

  return extractGame8Codes(response.data);
}

export function extractGame8Codes(html: string): ParsedRedeemCode[] {
  const $ = cheerio.load(html);
  // 同一个码可能在有效区+过期区都出现，用 map 去重，有效优先。
  const byCode = new Map<string, ParsedRedeemCode>();
  let expired = false;

  $('h2.a-header--2, h3.a-header--3, table.a-table').each((_, el) => {
    if (!$(el).is('table')) {
      const heading = $(el).text();
      if (/expired/i.test(heading)) {
        expired = true;
      } else if (/active|working|new\s+.*code|redeem\s+code/i.test(heading)) {
        expired = false;
      }
      return;
    }

    // 只认"码表"：表头里有 "code" 才解析，避免误抓 tier 表等其它 a-table。
    if (!/code/i.test($(el).find('th').text())) {
      return;
    }

    $(el)
      .find('tr')
      .each((__, tr) => {
        const code = extractCodeFromRow($, tr);
        if (!code) {
          return;
        }

        const reward = normalizeWhitespace($(tr).find('td').eq(1).text());
        mergeCandidate(byCode, {
          code,
          reward: expired ? null : reward || null,
          status: expired ? 'expired' : 'unused',
        });
      });
  });

  return [...byCode.values()];
}

function extractCodeFromRow(
  $: cheerio.CheerioAPI,
  tr: AnyNode,
): string | null {
  // 优先 input[value]（active 区），退回兑换链接 ?code=…，再退回首列纯文本
  // （expired 区是 <td>CODE</td>）。表头门槛已确保这是码表，码列内容直接信。
  const inputVal = $(tr).find('input.a-clipboard__textInput').attr('value');
  let code = inputVal?.trim();

  if (!code) {
    const href = $(tr).find('a[href*="code="]').attr('href');
    const match = href?.match(/[?&]code=([A-Za-z0-9]+)/);
    code = match?.[1];
  }

  if (!code) {
    code = normalizeWhitespace($(tr).find('td').first().text());
  }

  if (!code) {
    return null;
  }

  const upper = code.toUpperCase();
  // 码：纯字母数字、4–30 位。不强求带数字——米哈游有不少全字母码
  // （AceDetective / STARRAILGIFT / SHAREANDSAVEIT）。
  if (!/^[A-Z0-9]{4,30}$/.test(upper)) {
    return null;
  }

  return upper;
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

  // 补上之前没拿到的奖励文案。
  if (!existing.reward && candidate.reward) {
    existing.reward = candidate.reward;
  }
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
