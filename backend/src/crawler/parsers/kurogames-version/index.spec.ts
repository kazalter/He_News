/**
 * 鸣潮版本前瞻 parser 的回归测试。
 *
 * 这个 parser 全靠官网「X.Y版本内容说明」长文里的固定中文措辞吃饭：
 *   ✦全新角色✦ 5星共鸣者「X」（属性 | 武器类型）… [卡池名]角色活动唤取获得
 *   ✦全新武器✦ 5星武器「Y」… 「Y」武器活动唤取获得
 * 官网换排版任意一处都会让抽取 silently 变空。下面用按真实 3.3 正文缩写的样本钉死，
 * 重点覆盖：首发/复刻判定、武器卡池名「浮声沉兵」不被误当武器、按出现顺序配对成 phase。
 *
 * 角色 / 武器名是按真实 3.3 格式写的样本，目的是锁格式不是记花名册。
 */
import {
  findVersionArticle,
  parseCharacters,
  parsePoolNames,
  parseWeapons,
  parseNewNames,
  parseEvents,
  parseVersionContent,
} from './index';
import type { KuroArticleMeta } from '../kurogames-news';

const CONTENT = `
<div><img src="https://cdn.example.com/3-3-cover.jpg" alt=""></div>
<p>【版本内容介绍】</p>
<p>✦全新角色✦ 5星共鸣者「绯雪」（冷凝 | 迅刀）</p>
<p>※可通过[雪色所映千般未来]角色活动唤取获得。</p>
<p>✦全新武器✦ 5星武器「灼霜」（迅刀）</p>
<p>※可通过「灼霜」武器活动唤取获得。</p>
<p>5星共鸣者「达妮娅」（热熔 | 音感仪）</p>
<p>※可通过[予明日以谎言]角色活动唤取获得。</p>
<p>※可通过「赝作的矮星」武器活动唤取获得。</p>
<p>本版本将新增「浮声沉兵」武器活动唤取中，获得5星武器的动画演出。</p>
<p>✦全新地区✦ 「黯原」 该地区包含…</p>
<p>✦全新剧情✦ 【潮汐任务】第三章正式开启。</p>
<p>✦全新活动以及玩法✦ 【周年庆典】系列活动。</p>
`;

describe('parseCharacters', () => {
  it('抽出 5 星共鸣者的名字 / 属性 / 武器类型，按出现顺序', () => {
    expect(parseCharacters(CONTENT)).toEqual([
      { name: '绯雪', element: '冷凝', weaponType: '迅刀' },
      { name: '达妮娅', element: '热熔', weaponType: '音感仪' },
    ]);
  });

  it('措辞对不上时返回空', () => {
    expect(parseCharacters('本期没有任何符合格式的共鸣者段落')).toEqual([]);
  });
});

describe('parsePoolNames / parseWeapons', () => {
  it('角色活动唤取卡池名按出现顺序', () => {
    expect(parsePoolNames(CONTENT)).toEqual([
      '雪色所映千般未来',
      '予明日以谎言',
    ]);
  });

  it('武器锚定「…获得」，卡池名「浮声沉兵」不被误当武器', () => {
    expect(parseWeapons(CONTENT)).toEqual(['灼霜', '赝作的矮星']);
  });
});

describe('parseNewNames', () => {
  it('✦全新角色✦ / ✦全新武器✦ 标记下的名字 = 本版本首发', () => {
    expect(parseNewNames(CONTENT, '角色', '共鸣者')).toEqual(['绯雪']);
    expect(parseNewNames(CONTENT, '武器', '武器')).toEqual(['灼霜']);
  });
});

describe('parseEvents', () => {
  it('抽 全新地区 / 剧情 / 活动 成事件', () => {
    expect(parseEvents(CONTENT)).toEqual([
      { category: 'story', name: '潮汐任务', label: '主线剧情' },
      { category: 'other', name: '黯原', label: '全新地区' },
      { category: 'event', name: '周年庆典', label: '活动玩法' },
    ]);
  });
});

describe('findVersionArticle', () => {
  const metas: KuroArticleMeta[] = [
    { articleId: 4448, title: '「于影中启明的决心」3.2版本内容说明' },
    { articleId: 4609, title: '「自星海尽处回响」3.3版本内容说明' },
    { articleId: 4551, title: '《鸣潮》3.3版本更新维护预告' },
  ];

  it('挑版本号最高的「内容说明」，抽出版本号 + 副标题', () => {
    expect(findVersionArticle(metas)).toEqual({
      meta: metas[1],
      version: '3.3',
      subtitle: '自星海尽处回响',
    });
  });

  it('没有内容说明文章时返回 undefined', () => {
    expect(
      findVersionArticle([{ articleId: 1, title: '某个无关公告' }]),
    ).toBeUndefined();
  });
});

describe('parseVersionContent（整篇装配）', () => {
  const plan = parseVersionContent({
    version: '3.3',
    subtitle: '自星海尽处回响',
    articleId: 4609,
    publishedAt: new Date('2026-04-30T02:00:00.000Z'),
    contentHtml: CONTENT,
    jsonBase:
      'https://media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/zh',
  });

  it('封面取正文首图、官方链接拼成 news/detail/<id>', () => {
    expect(plan.coverUrl).toBe('https://cdn.example.com/3-3-cover.jpg');
    expect(plan.officialUrl).toBe(
      'https://mc.kurogames.com/main/news/detail/4609',
    );
  });

  it('两期 banner：角色配同位置专武，首发/复刻判定正确', () => {
    expect(plan.banners).toHaveLength(2);
    expect(plan.banners[0]).toMatchObject({
      phase: 1,
      poolIndex: 1,
      poolName: '雪色所映千般未来',
      characterName: '绯雪',
      characterRarity: 5,
      characterElement: '冷凝',
      characterPath: '迅刀',
      isNewCharacter: true,
      weaponName: '灼霜',
      weaponRarity: 5,
      isNewWeapon: true,
    });
    expect(plan.banners[1]).toMatchObject({
      phase: 2,
      characterName: '达妮娅',
      isNewCharacter: false,
      weaponName: '赝作的矮星',
      isNewWeapon: false,
    });
  });

  it('rawJson 里保留抽取的原始名单', () => {
    const raw = JSON.parse(plan.rawJson);
    expect(raw.newCharacters).toEqual(['绯雪']);
    expect(raw.weapons).toEqual(['灼霜', '赝作的矮星']);
  });
});
