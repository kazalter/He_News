/**
 * ClassificationService 的回归测试。
 *
 * 这个 service 干两件容易 silently 退化的事：
 *   1. classify()：按中文关键词给文章归类（兑换码/前瞻/更新…）。
 *   2. extractRedeemCodes()：从正文里捞兑换码。这块历史上踩过坑——
 *      旧版要求每个码前后 160 字符内必须出现「兑换码」字样，米哈游排版常把
 *      标题和码列表隔太远，导致 RedeemCode 表长期 0 条（HANDOFF #4）。
 *
 * 这里把放宽后的两条新行为钉死：
 *   - 上下文窗口放到 ±400，隔得稍远的码也能被关键词带出来。
 *   - category 已是 'redeem_code' 时直接放宽，不再强求码附近有关键词。
 * 同时保留对噪音串（纯数字 / 无字母 / BV 号 / HTTP 等）的过滤反例。
 */
import { ClassificationService } from './classification.service';

describe('ClassificationService.classify', () => {
  const svc = new ClassificationService();

  it.each([
    ['【兑换码】本周福利码来啦', 'redeem_code'],
    ['2.8 版本前瞻特别节目', 'preview'],
    ['版本更新公告', 'update'],
    ['停服维护补偿通知', 'maintenance'],
    ['限时活动签到开启', 'event'],
    ['一则普通公告', 'announcement'],
    ['随便一段文字', 'other'],
  ])('「%s」→ %s', (title, expected) => {
    expect(svc.classify({ title })).toBe(expected);
  });
});

describe('ClassificationService.extractRedeemCodes', () => {
  const svc = new ClassificationService();

  it('码紧挨着「兑换码」关键词时能捞出来', () => {
    expect(
      svc.extractRedeemCodes({
        title: '福利',
        content: '本期兑换码：HE2026ABCD，快去领取。',
      }),
    ).toEqual(['HE2026ABCD']);
  });

  it('码和关键词隔 ~300 字符（旧的 ±160 窗口会漏，现在 ±400 能带出来）', () => {
    const filler = '正'.repeat(300);
    const content = `本期兑换码如下${filler}HE2026ABCD 即可兑换。`;
    expect(svc.extractRedeemCodes({ content })).toEqual(['HE2026ABCD']);
  });

  it('正文里完全没有关键词、category 也不是 redeem_code 时不乱捞', () => {
    expect(
      svc.extractRedeemCodes({
        content: '这串 HE2026ABCD 只是随口一提，附近没有任何兑换相关字样。',
      }),
    ).toEqual([]);
  });

  it('category=redeem_code 时放宽：不要求码附近有关键词也能捞', () => {
    expect(
      svc.extractRedeemCodes({
        title: '最新可用码合集',
        content: '<p>HE2026ABCD</p><p>ZZZGIFT2026</p>',
        category: 'redeem_code',
      }),
    ).toEqual(['HE2026ABCD', 'ZZZGIFT2026']);
  });

  it.each([
    ['纯数字', '兑换码 12345678 无效'],
    ['没有数字', '兑换码 ABCDEFGH 无效'],
    ['BV 号', '兑换码 BV1AB411C7XY 其实是视频号'],
    ['HTTP 等噪音词', '兑换码见 HTTPS 链接'],
  ])('过滤噪音串：%s', (_label, content) => {
    expect(svc.extractRedeemCodes({ content })).toEqual([]);
  });

  it('同一个码出现多次只返回一次', () => {
    expect(
      svc.extractRedeemCodes({
        content: '兑换码 HE2026ABCD，再发一次 HE2026ABCD。',
      }),
    ).toEqual(['HE2026ABCD']);
  });
});
