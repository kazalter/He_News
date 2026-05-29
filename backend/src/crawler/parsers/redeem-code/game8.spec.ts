/**
 * game8 兑换码 parser 的回归测试。
 *
 * 这个 parser 全靠 game8 的固定 HTML 结构吃饭：靠 <h2> 标题分"有效/过期"两段，
 * 靠 table.a-table + 表头含 "code" 认定码表，码从 input[value] / 兑换链接 /
 * 首列文本三处取。game8 改版任意一处就会 silently 返回空。这里用一份按真实页面
 * 缩写的 fixture 钉死：
 *   - 有效区（input + 兑换链接）→ status unused，带 reward；
 *   - 过期区（纯文本 td）→ status expired，reward 置空；
 *   - 全字母码（无数字）也要能出（米哈游有 OMEGA / SHAREANDSAVEIT 这种）；
 *   - 非码表（tier 表）不被误抓。
 *
 * 下面的码是按格式手写的样本，不是某次真实快照。
 */
import { extractGame8Codes } from './game8';

const FIXTURE = `
<html><body>
<div class="article">
  <h2 class="a-header--2" id="hl_1">Active Redeem Codes for May 2026</h2>
  <table class="a-table a-table" style="">
    <tr><th width="50%">Redeem Codes</th><th width="50%">Reward</th></tr>
    <tr>
      <td class="center">
        <div class="a-clipboard__container">
          <input type="text" class="a-clipboard__textInput" value="VS3Q5VK9CMFP" readonly>
        </div>
        <a class="a-link" href="https://hsr.hoyoverse.com/gift?code=VS3Q5VK9CMFP" target="_blank">Redeem VS3Q5VK9CMFP Here</a>
      </td>
      <td>
        <div class="align">Stellar Jade x50</div>
        <div class="align">Credit x10,000</div>
      </td>
    </tr>
    <tr>
      <td class="center">
        <a class="a-link" href="https://hsr.hoyoverse.com/gift?code=OMEGA" target="_blank">Redeem OMEGA Here</a>
      </td>
      <td><div class="align">Stellar Jade x60</div></td>
    </tr>
  </table>

  <h2 class="a-header--2" id="hl_2">How to Redeem HSR Codes</h2>
  <p>Use the official redemption website.</p>

  <h2 class="a-header--2" id="hl_3">All Expired Star Rail Redeem Codes</h2>
  <table class="a-table a-table" style="">
    <tr><th width="40%">Codes</th><th width="60%">Rewards</th></tr>
    <tr><td class="center">EB395CJ8V5XF</td><td><div class="align">Stellar Jade x100</div></td></tr>
    <tr><td class="center">SHAREANDSAVEIT</td><td><div class="align">Stellar Jade x100</div></td></tr>
  </table>

  <h2 class="a-header--2" id="hl_4">Best Characters Tier List</h2>
  <table class="a-table a-table" style="">
    <tr><th>Tier</th><th>Character</th></tr>
    <tr><td class="center">SS</td><td>Castorice</td></tr>
  </table>
</div>
</body></html>
`;

describe('extractGame8Codes', () => {
  const codes = extractGame8Codes(FIXTURE);
  const byCode = new Map(codes.map((c) => [c.code, c]));

  it('有效区：input 取码、带 reward、status=unused', () => {
    expect(byCode.get('VS3Q5VK9CMFP')).toEqual({
      code: 'VS3Q5VK9CMFP',
      reward: 'Stellar Jade x50 Credit x10,000',
      status: 'unused',
    });
  });

  it('有效区：没有 input 时从兑换链接 ?code= 取码', () => {
    expect(byCode.get('OMEGA')).toMatchObject({
      code: 'OMEGA',
      status: 'unused',
    });
  });

  it('过期区：纯文本 td 取码、status=expired、reward 置空', () => {
    expect(byCode.get('EB395CJ8V5XF')).toEqual({
      code: 'EB395CJ8V5XF',
      reward: null,
      status: 'expired',
    });
  });

  it('全字母码（无数字）也能出', () => {
    expect(byCode.get('SHAREANDSAVEIT')).toMatchObject({
      status: 'expired',
    });
  });

  it('非码表（tier 表，表头无 code）不被误抓', () => {
    expect(byCode.has('SS')).toBe(false);
    expect(byCode.has('CASTORICE')).toBe(false);
  });

  it('措辞/结构对不上时返回空（silently 全空的反例）', () => {
    expect(extractGame8Codes('<html><body><p>no codes here</p></body></html>')).toEqual([]);
  });
});
