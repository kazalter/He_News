/**
 * GameKee 卡池解析的回归测试。
 *
 * 靠 cardPool/query-list 的固定字段（name / start_at / end_at / tag_id）。GameKee 改
 * 字段名或 tag 含义会让解析 silently 变空 / 错判首发。用按真实响应缩写的样本钉死。
 */
import {
  parseCardPools,
  isLimitedNew,
  isRerun,
  TAG_LIMITED,
  TAG_RERUN,
} from './gamekee';

const START = 1777597200; // 2026 年的某个北京时间点
const END = 1779328740;

const RAW = {
  code: 0,
  msg: '成功',
  data: [
    { id: 1, name: '绯雪', start_at: START, end_at: END, tag_id: '12' },
    { id: 2, name: '莫宁', start_at: START, end_at: END, tag_id: '11' },
    // 多标签
    { id: 3, name: '某武器', start_at: START, end_at: END, tag_id: '12,11' },
    // 脏数据：缺名 / 缺时间，应被丢
    { id: 4, name: '', start_at: 1, end_at: 2, tag_id: '19' },
    { id: 5, name: '占位', start_at: 'x', end_at: 'y', tag_id: '' },
  ],
};

describe('parseCardPools', () => {
  const pools = parseCardPools(RAW);

  it('映射中文名 + 起止时间（Unix 秒 → Date，×1000）', () => {
    const fei = pools.find((p) => p.name === '绯雪');
    expect(fei?.startAt.getTime()).toBe(START * 1000);
    expect(fei?.endAt.getTime()).toBe(END * 1000);
    expect(fei?.tagIds).toEqual([12]);
  });

  it('多标签 tag_id "12,11" 拆成 [12,11]', () => {
    expect(pools.find((p) => p.name === '某武器')?.tagIds).toEqual([12, 11]);
  });

  it('缺名 / 时间非数字的脏数据被丢', () => {
    expect(pools.map((p) => p.name)).toEqual(['绯雪', '莫宁', '某武器']);
  });

  it('非预期结构返回空', () => {
    expect(parseCardPools(null)).toEqual([]);
    expect(parseCardPools({ data: '不是数组' })).toEqual([]);
  });
});

describe('tag 判定', () => {
  it('12=限定首发，11=复刻', () => {
    expect(isLimitedNew([TAG_LIMITED])).toBe(true);
    expect(isLimitedNew([TAG_RERUN])).toBe(false);
    expect(isRerun([TAG_RERUN])).toBe(true);
    expect(isRerun([19])).toBe(false);
  });
});
