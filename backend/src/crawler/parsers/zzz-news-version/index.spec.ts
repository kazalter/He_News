/**
 * ZZZ 新闻版本 parser 的回归测试。
 *
 * 这个 parser 全靠正则吃米哈游公告的固定中文措辞（"S级代理人【…】"、
 * "S级代理人「X」「Y」即将登场"、"X.Y版本限时频段（上/下期）" 等）。米哈游某次
 * 换栏目名或排版就会让某个正则 silently 返回空，UI 直接变白也不报错。这里：
 *   1. 单测钉死每个纯解析函数对当前措辞的行为（含"换措辞=空"的反例）。
 *   2. mock 掉 axios，用一份代表性的 2.8 格式文章喂完整 parseZzzNewsVersion，
 *      验证组卡池 / 首发复刻判定 / A 级落事件 等装配逻辑。
 *
 * 注意：下面的文章正文是按 index.ts 里记录的格式手写的"代表性样本"，不是某个
 * 真实版本的角色名单快照——目的是锁格式，不是记录花名册。
 */
import axios from 'axios';
import { parseZzzNewsVersion, __testables } from './index';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockGet = (axios as unknown as { get: jest.Mock }).get;

const {
  parseAgents,
  parseEngines,
  parseAgentToken,
  parseTimeRange,
  parseDebutAgentNames,
  parseActivities,
  parseMainStory,
  findRelevantArticles,
  htmlToText,
} = __testables;

describe('parseAgents', () => {
  it('从 "S级代理人【…】、【…】" 里拆出名字 / 属性 / 特性，rarity=5', () => {
    const text =
      'S级代理人【星徽·比利(物理·命破)】、【浮波柚叶(冰·支援)】调频概率提升！';
    expect(parseAgents(text, 'S')).toEqual([
      { name: '星徽·比利', element: '物理', spec: '命破', rarity: 5 },
      { name: '浮波柚叶', element: '冰', spec: '支援', rarity: 5 },
    ]);
  });

  it('A 级代理人 rarity=4', () => {
    expect(parseAgents('A级代理人【潘引壶(火·强攻)】', 'A')).toEqual([
      { name: '潘引壶', element: '火', spec: '强攻', rarity: 4 },
    ]);
  });

  it('措辞对不上时返回空（"silently 全空" 的反例就是这种）', () => {
    expect(parseAgents('本期没有任何符合该格式的代理人段落', 'S')).toEqual([]);
  });
});

describe('parseEngines', () => {
  it('音擎括号里只有特性，没有属性', () => {
    const text = 'S级音擎【辉骑面铠(命破)】、【飒风刃(支援)】同期上线。';
    expect(parseEngines(text, 'S')).toEqual([
      { name: '辉骑面铠', spec: '命破', rarity: 5 },
      { name: '飒风刃', spec: '支援', rarity: 5 },
    ]);
  });
});

describe('parseAgentToken', () => {
  it('名字本身含 · 时不会被属性拆分误伤', () => {
    expect(parseAgentToken('星徽·比利(物理·命破)', 5)).toEqual({
      name: '星徽·比利',
      element: '物理',
      spec: '命破',
      rarity: 5,
    });
  });
});

describe('parseTimeRange', () => {
  it('解析 "YYYY/MM/DD HH:MM ~ YYYY/MM/DD HH:MM" 按北京时间', () => {
    const { startAt, endAt } = parseTimeRange(
      '限时频段时间：2026/05/06 11:00 ~ 2026/05/27 03:59。',
    );
    expect(startAt?.toISOString()).toBe('2026-05-06T03:00:00.000Z');
    expect(endAt?.toISOString()).toBe('2026-05-26T19:59:00.000Z');
  });

  it('没有时间区间时返回空对象', () => {
    expect(parseTimeRange('正文里没有任何时间')).toEqual({});
  });
});

describe('parseDebutAgentNames', () => {
  it.each([
    'S级代理人「普罗米娅」「星徽·比利」即将登场',
    'S级代理人「普罗米娅」&「星徽·比利」即将登场',
    'S级代理人「普罗米娅」、「星徽·比利」即将登场',
  ])('吞掉各种连接符：%s', (text) => {
    expect(parseDebutAgentNames(text)).toEqual(['普罗米娅', '星徽·比利']);
  });

  it('措辞对不上时返回空', () => {
    expect(parseDebutAgentNames('S级代理人即将与你见面')).toEqual([]);
  });
});

describe('parseActivities / parseMainStory', () => {
  it('抓带标签的活动', () => {
    const text = '主题活动「迷宫鏖战」限时上线，限时活动「街机争霸」开启。';
    expect(parseActivities(text)).toEqual([
      { name: '迷宫鏖战', label: '主题活动' },
      { name: '街机争霸', label: '限时活动' },
    ]);
  });

  it('抓主线章节名', () => {
    expect(parseMainStory('本期主线新章「真夜的余烬」正式开启')).toEqual({
      name: '真夜的余烬',
      label: '主线',
    });
  });
});

describe('htmlToText', () => {
  it('保留 &amp; 解出来的 & （否则 "奥菲丝&「鬼火」" 会断开）', () => {
    expect(htmlToText('<p>奥菲丝&amp;「鬼火」</p>')).toBe('奥菲丝&「鬼火」');
  });
});

describe('findRelevantArticles', () => {
  it('挑出最高版本号的四篇 + 情报总览，并解析副标题', () => {
    const result = findRelevantArticles(LIST);
    expect(result?.version).toBe('2.8');
    expect(result?.subtitle).toBe('新·艾利都日落时');
    expect(result?.contentShangqi?.iInfoId).toBe(5001);
    expect(result?.contentXiaqi?.iInfoId).toBe(5002);
    expect(result?.gachaShangqi?.iInfoId).toBe(5003);
    expect(result?.gachaXiaqi?.iInfoId).toBe(5004);
    expect(result?.intelOverview?.iInfoId).toBe(5005);
  });
});

// ====== 整体集成测试（mock axios）======================================

const LANDING_URL =
  'https://act-api-takumi-static.mihoyo.com/content_v2_user/app/706fd13a87294881/getContentList?iChanId=278&sLangKey=zh-cn';

const LIST = [
  {
    iInfoId: 5001,
    sTitle: '2.8版本内容一览（上期）',
    dtStartTime: '2026-05-06 11:00:00',
    sExt: '{"news-banner":[{"url":"https://example.test/cover.png"}]}',
  },
  {
    iInfoId: 5002,
    sTitle: '2.8版本内容一览（下期）',
    dtStartTime: '2026-05-27 04:00:00',
  },
  {
    iInfoId: 5003,
    sTitle: '2.8版本限时频段（上期）',
    dtStartTime: '2026-05-05 12:00:00',
  },
  {
    iInfoId: 5004,
    sTitle: '2.8版本限时频段（下期）',
    dtStartTime: '2026-05-26 12:00:00',
  },
  {
    iInfoId: 5005,
    sTitle: '情报总览丨《绝区零》2.8 版本「新·艾利都日落时」',
    dtStartTime: '2026-05-04 10:00:00',
  },
];

const DETAILS: Record<number, string> = {
  5001:
    '<p>本期主线新章「真夜的余烬」正式开启。</p>' +
    '<p>主题活动「迷宫鏖战」限时上线，主题活动「热斗罐头」同步开启。</p>',
  5002:
    '<p>下期主线剧情「黎明之前」继续推进。</p>' +
    '<p>限时活动「街机争霸」开启。</p>',
  5003:
    '<p>限时频段时间：2026/05/06 11:00 ~ 2026/05/27 03:59。</p>' +
    '<p>S级代理人【星徽·比利(物理·命破)】、【浮波柚叶(冰·支援)】调频概率提升！</p>' +
    '<p>S级音擎【辉骑面铠(命破)】、【飒风刃(支援)】同期上线。</p>' +
    '<p>A级代理人【潘引壶(火·强攻)】概率提升。A级音擎【含羞恶面(强攻)】。</p>',
  5004:
    '<p>限时频段时间：2026/05/27 12:00 ~ 2026/06/17 03:59。</p>' +
    '<p>S级代理人【薇薇安(以太·异常)】、【朱鸢(以太·强攻)】调频概率提升！</p>' +
    '<p>S级音擎【圣俗杂烩(异常)】、【防暴者Ⅵ型(强攻)】上线。</p>' +
    '<p>A级代理人【狛野真斗(物理·防护)】。A级音擎【含羞恶面(强攻)】。</p>',
  5005:
    '<p>S级代理人「星徽·比利」「浮波柚叶」「薇薇安」即将登场，敬请期待！</p>',
};

function mockApi() {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('getContentList')) {
      return Promise.resolve({ data: { retcode: 0, data: { list: LIST } } });
    }
    const idMatch = url.match(/iInfoId=(\d+)/);
    const id = idMatch ? Number(idMatch[1]) : 0;
    const item = LIST.find((x) => x.iInfoId === id);
    return Promise.resolve({
      data: {
        retcode: 0,
        data: { ...item, sContent: DETAILS[id] ?? '' },
      },
    });
  });
}

describe('parseZzzNewsVersion (整体装配)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockApi();
  });

  it('组出 4 条卡池，首发/复刻判定正确', async () => {
    const plan = await parseZzzNewsVersion(LANDING_URL);

    expect(plan.version).toBe('2.8');
    expect(plan.subtitle).toBe('新·艾利都日落时');
    expect(plan.banners).toHaveLength(4);

    const bili = plan.banners.find((b) => b.characterName === '星徽·比利');
    expect(bili).toMatchObject({
      phase: 1,
      characterRarity: 5,
      characterElement: '物理',
      characterPath: '命破',
      isNewCharacter: true,
      weaponName: '辉骑面铠',
      weaponRarity: 5,
      isNewWeapon: true,
    });
    expect(bili?.startAt?.toISOString()).toBe('2026-05-06T03:00:00.000Z');

    // 朱鸢不在情报总览的「即将登场」名单里 → 复刻，不算新角色、也不算新音擎。
    const zhuyuan = plan.banners.find((b) => b.characterName === '朱鸢');
    expect(zhuyuan).toMatchObject({
      phase: 2,
      isNewCharacter: false,
      isNewWeapon: false,
      weaponName: '防暴者Ⅵ型',
    });
  });

  it('A 级代理人落到事件、标 "调频" 而非新角色', async () => {
    const plan = await parseZzzNewsVersion(LANDING_URL);

    const aAgents = plan.events.filter((e) => e.category === 'other');
    expect(aAgents.map((e) => e.name)).toEqual(['潘引壶', '狛野真斗']);
    expect(aAgents[0].label).toBe('A 级 · 第一期 · 调频');
    expect(aAgents[1].label).toBe('A 级 · 第二期 · 调频');

    // 主线 + 活动也各就各位。
    expect(plan.events.filter((e) => e.category === 'story').map((e) => e.name)).toEqual([
      '真夜的余烬',
      '黎明之前',
    ]);
    expect(plan.events.filter((e) => e.category === 'event').map((e) => e.name)).toEqual([
      '迷宫鏖战',
      '热斗罐头',
      '街机争霸',
    ]);
  });
});
