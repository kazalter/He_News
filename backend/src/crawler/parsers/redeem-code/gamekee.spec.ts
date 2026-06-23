/**
 * GameKee 兑换码 parser 的回归测试。
 *
 * 这个 parser 全靠 GameKee 词条 content_json 的固定块结构吃饭：顶层那张 table 是有效码，
 * 「已过期：」段之后折叠块（type=flod，title 含「已过期」）里那张 table 是过期码；列序
 * 固定为 `兑换码 | 奖励 | 有效期至 | 来源`。GameKee 换富文本编辑器 / 改列序 / 改折叠块
 * 结构，任意一处都会 silently 返回空。这里用一份按真实词条缩写的 fixture 钉死：
 *   - 有效区表 → status unused，带 reward，能解析「有效期至」中文日期；
 *   - flod「已过期兑换码」内的表 → status expired，reward 置空；
 *   - 表头行 / 占位空行不被误抓，小写码归一成大写；
 *   - 非过期 flod（兑换方式）里的文本不产码。
 *
 * 节点形状照搬真实结构（table-cell → paragraph → {text}），码是按格式手写的样本。
 */
import { extractGamekeeCodes, parseGamekeeCodeUrl } from './gamekee';

const cell = (text: string) => ({
  type: 'table-cell',
  children: [{ type: 'paragraph', children: [{ text }] }],
});
const row = (...texts: string[]) => ({
  type: 'table-row',
  children: texts.map(cell),
});
const table = (...rows: ReturnType<typeof row>[]) => ({
  type: 'table',
  children: rows,
});

const FIXTURE = [
  { type: 'paragraph', children: [{ text: '兑换码现在可以一键复制啦：' }] },
  table(
    row('兑换码', '奖励', '有效期至', '来源'),
    row('', '', '', ''), // 真实页占位空行
    row('ILLUSIONHAUNTS', '星声*50，贝币*10000', '2026年7月20日23:59', '官方'),
    row('mingchao666', '星声*60', '长期有效', '官方'),
  ),
  { type: 'paragraph', children: [{ text: '已过期：' }] },
  {
    type: 'flod',
    title: '已过期兑换码',
    children: [
      table(
        row('兑换码', '奖励', '有效期至', '来源'),
        row('', '', '', ''),
        row('EXPIRED2025', '星声*50', '已过期', '未知'),
      ),
    ],
  },
  {
    type: 'flod',
    title: '兑换码兑换方式',
    children: [{ type: 'paragraph', children: [{ text: '①点击游戏右上角终端' }] }],
  },
];

describe('parseGamekeeCodeUrl', () => {
  it('从词条地址解出 alias + contentId', () => {
    expect(
      parseGamekeeCodeUrl('https://www.gamekee.com/mc/622905.html'),
    ).toEqual({ alias: 'mc', contentId: '622905' });
  });

  it('地址不合法时抛错', () => {
    expect(() => parseGamekeeCodeUrl('https://example.com/foo')).toThrow();
  });
});

describe('extractGamekeeCodes', () => {
  const codes = extractGamekeeCodes(FIXTURE);
  const byCode = new Map(codes.map((c) => [c.code, c]));

  it('有效区：取码、带 reward、解析有效期、status=unused', () => {
    expect(byCode.get('ILLUSIONHAUNTS')).toEqual({
      code: 'ILLUSIONHAUNTS',
      reward: '星声*50，贝币*10000',
      description: '官方',
      expiredAt: new Date('2026-07-20T23:59:00+08:00'),
      status: 'unused',
    });
  });

  it('有效区：小写码归一成大写，「有效期至」解析不出 → expiredAt=null', () => {
    expect(byCode.get('MINGCHAO666')).toMatchObject({
      code: 'MINGCHAO666',
      reward: '星声*60',
      expiredAt: null,
      status: 'unused',
    });
  });

  it('过期区（flod「已过期兑换码」内）：status=expired、reward 置空', () => {
    expect(byCode.get('EXPIRED2025')).toEqual({
      code: 'EXPIRED2025',
      reward: null,
      description: '未知',
      expiredAt: null,
      status: 'expired',
    });
  });

  it('表头行 / 占位空行不被误抓', () => {
    expect(byCode.has('兑换码')).toBe(false);
    expect(byCode.has('')).toBe(false);
    expect(codes).toHaveLength(3);
  });

  it('content_json 为 JSON 字符串时同样能解析', () => {
    const fromString = extractGamekeeCodes(JSON.stringify(FIXTURE));
    expect(fromString.map((c) => c.code).sort()).toEqual(
      ['EXPIRED2025', 'ILLUSIONHAUNTS', 'MINGCHAO666'].sort(),
    );
  });

  it('结构对不上 / 空 → 返回空（silently 全空的反例）', () => {
    expect(extractGamekeeCodes([])).toEqual([]);
    expect(
      extractGamekeeCodes([
        { type: 'paragraph', children: [{ text: '没有码表' }] },
      ]),
    ).toEqual([]);
    expect(extractGamekeeCodes('not json')).toEqual([]);
  });
});
