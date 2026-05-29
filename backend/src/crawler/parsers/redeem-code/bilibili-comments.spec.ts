/**
 * B站评论码 parser 的回归测试。
 *
 * 评论噪音大，这里钉死"精度优先"的提取规则：
 *   - 带「兑换码/口令」等关键词的评论里，码（字母数字混合）能出；
 *   - 没关键词时，只认米哈游直播码的标准 12 位形态（防止误抓一堆随机串）；
 *   - BV/av 号、纯数字、纯词一律不当码；
 *   - 同码在多条评论出现时，留点赞更高的那条（confidence）。
 * 网络部分（resolveOid 翻页）不在单测里，靠下面的纯函数 + 连通性脚本覆盖。
 */
import {
  extractCodesFromComment,
  collectCodesFromReplies,
  parseBvid,
} from './bilibili-comments';

describe('extractCodesFromComment', () => {
  it('带关键词的评论：抠出字母数字混合码', () => {
    expect(
      extractCodesFromComment('前瞻兑换码 MS6DNVXLJJS5 快去领，手慢无'),
    ).toEqual(['MS6DNVXLJJS5']);
  });

  it('无关键词但命中标准 12 位形态：也能出', () => {
    expect(extractCodesFromComment('ET7CNGFDDS6N')).toEqual(['ET7CNGFDDS6N']);
  });

  it('无关键词且非 12 位：不乱抓（精度优先）', () => {
    expect(extractCodesFromComment('我也想要 ABCD1234 这种东西')).toEqual([]);
  });

  it('有关键词时较短的混合码（8–11位）也收', () => {
    expect(extractCodesFromComment('口令码：HSRVER30A 限时')).toEqual([
      'HSRVER30A',
    ]);
  });

  it.each([
    ['纯数字', '兑换码 123456789'],
    ['纯字母词', '兑换码 STARRAILGIFT'],
    ['BV 号', '兑换码见 BV1AB411C7XY'],
    ['av 号', '兑换码见 AV12345678'],
  ])('过滤噪音：%s', (_label, text) => {
    expect(extractCodesFromComment(text)).toEqual([]);
  });
});

describe('collectCodesFromReplies', () => {
  it('扫一级 + 二级评论，去重，同码留高赞，带作者', () => {
    const replies = [
      {
        content: { message: '兑换码 MS6DNVXLJJS5' },
        like: 10,
        member: { uname: '甲' },
        replies: [
          {
            content: { message: '兑换码 MS6DNVXLJJS5 还有效！' },
            like: 99,
            member: { uname: '乙' },
          },
        ],
      },
      {
        content: { message: 'ET7CNGFDDS6N' },
        like: 5,
        member: { uname: '丙' },
        replies: null,
      },
    ];

    const result = collectCodesFromReplies(replies);
    const byCode = new Map(result.map((c) => [c.code, c]));

    expect(result).toHaveLength(2);
    // 同码 MS6DNVXLJJS5 出现在 like=10 和 like=99 两条，留高赞的（@乙）。
    expect(byCode.get('MS6DNVXLJJS5')).toEqual({
      code: 'MS6DNVXLJJS5',
      description: 'B站评论@乙',
      confidence: 99,
    });
    expect(byCode.get('ET7CNGFDDS6N')).toMatchObject({
      description: 'B站评论@丙',
      confidence: 5,
    });
  });
});

describe('parseBvid', () => {
  it('从视频链接里抠 BV 号', () => {
    expect(
      parseBvid('https://www.bilibili.com/video/BV1GJ411x7h7?spm_id=xxx'),
    ).toBe('BV1GJ411x7h7');
  });

  it('没有 BV 号时返回 null', () => {
    expect(parseBvid('https://www.bilibili.com/video/av12345')).toBeNull();
  });
});
