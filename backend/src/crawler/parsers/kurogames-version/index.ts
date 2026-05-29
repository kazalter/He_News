/**
 * 鸣潮「版本前瞻」parser（库洛游戏官网静态 JSON 渠道）。
 *
 * 鸣潮没有米哈游那种结构化的版本前瞻专题 H5；版本的卡池 / 角色 / 武器信息写在官网
 * 每个版本固定会发的一篇「X.Y版本内容说明」长文里（标题如「自星海尽处回响」3.3
 * 版本内容说明）。这篇正文用固定中文措辞排版：
 *   - 角色：✦全新角色✦ 5星共鸣者「绯雪」（冷凝 | 迅刀）… [雪色所映千般未来]角色活动唤取获得
 *   - 武器：✦全新武器✦ 5星武器「灼霜」… 「灼霜」武器活动唤取获得
 *   - 复刻角色/武器同样出现在「…角色活动唤取获得 / …武器活动唤取获得」句式里，但不带
 *     ✦全新…✦ 标记 —— 据此判定首发 / 复刻。
 *
 * parser 流程：
 *   1. 拉 ArticleMenu.json，按标题正则筛出版本号最高的「X.Y版本内容说明」。
 *   2. 拉该文 article/<id>.json 取正文。
 *   3. 正则抽角色 / 卡池名 / 武器，按出现顺序配对成 phase（鸣潮一版本两期，每期
 *      1 个角色卡池 + 1 个武器卡池，武器是该角色的专武）。
 *
 * 脆点：官网换排版措辞（去掉 ✦全新…✦、改「角色活动唤取」叫法）会让抽取 silently
 * 变空。index.spec.ts 用真实 3.3 正文样本钉死格式。
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  ParsedVersionBanner,
  ParsedVersionEvent,
  ParsedVersionPlan,
} from '../mihoyo-version-special/shared';
import {
  KuroArticleMeta,
  parseArticleMenu,
} from '../kurogames-news';
import {
  kurogamesArticleJsonUrl,
  kurogamesArticleMenuUrl,
  kurogamesArticlePageUrl,
} from '../../kurogames';

const USER_AGENT =
  'HE-News/0.1 (+https://local.app; official-news-aggregator)';

export async function fetchKurogamesVersion(
  jsonBase: string,
): Promise<ParsedVersionPlan> {
  const menuUrl = kurogamesArticleMenuUrl(jsonBase);
  const { data: menuData } = await axios.get<unknown>(menuUrl, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 20000,
  });

  const found = findVersionArticle(parseArticleMenu(menuData));
  if (!found) {
    throw new Error(
      '未在鸣潮官网资讯里找到任何「X.Y版本内容说明」文章',
    );
  }

  const articleUrl = kurogamesArticleJsonUrl(jsonBase, found.meta.articleId);
  const { data: detail } = await axios.get<{ articleContent?: string }>(
    articleUrl,
    { headers: { 'User-Agent': USER_AGENT }, timeout: 20000 },
  );

  return parseVersionContent({
    version: found.version,
    subtitle: found.subtitle,
    articleId: found.meta.articleId,
    publishedAt: found.meta.publishedAt,
    contentHtml: detail?.articleContent ?? '',
    jsonBase,
  });
}

/** 从文章列表里挑版本号最高的「X.Y版本内容说明」。 */
export function findVersionArticle(metas: KuroArticleMeta[]):
  | { meta: KuroArticleMeta; version: string; subtitle?: string }
  | undefined {
  const tagged: { meta: KuroArticleMeta; version: string }[] = [];
  for (const meta of metas) {
    const m = meta.title.match(/(\d+(?:\.\d+)?)\s*版本内容说明/);
    if (m) {
      tagged.push({ meta, version: m[1] });
    }
  }
  if (tagged.length === 0) {
    return undefined;
  }
  tagged.sort((a, b) => parseFloat(b.version) - parseFloat(a.version));
  const top = tagged[0];
  // 副标题：标题里的「…」，如「自星海尽处回响」3.3版本内容说明 → 自星海尽处回响
  const subtitle = top.meta.title.match(/「([^」]+)」/)?.[1];
  return { meta: top.meta, version: top.version, subtitle };
}

type CharacterInfo = {
  name: string;
  element?: string;
  weaponType?: string;
};

export function parseVersionContent(input: {
  version: string;
  subtitle?: string;
  articleId: number;
  publishedAt?: Date;
  contentHtml: string;
  jsonBase: string;
}): ParsedVersionPlan {
  const { text, coverUrl } = extractContent(input.contentHtml);

  const characters = parseCharacters(text);
  const pools = parsePoolNames(text);
  const weapons = parseWeapons(text);
  const newCharacters = parseNewNames(text, '角色', '共鸣者');
  const newWeapons = parseNewNames(text, '武器', '武器');

  const phaseCount = Math.max(characters.length, weapons.length);
  const banners: ParsedVersionBanner[] = [];
  for (let i = 0; i < phaseCount; i += 1) {
    const character = characters[i];
    const weapon = weapons[i];
    const phase = i + 1;
    banners.push({
      phase,
      poolIndex: phase,
      poolName: pools[i],
      characterName: character?.name,
      characterRarity: character ? 5 : undefined,
      characterElement: character?.element,
      // 鸣潮用「武器类型」（迅刀 / 音感仪 / 长刃…）描述角色定位，复用 characterPath 槽。
      characterPath: character?.weaponType,
      isNewCharacter: character ? newCharacters.includes(character.name) : false,
      weaponName: weapon,
      weaponRarity: weapon ? 5 : undefined,
      isNewWeapon: weapon ? newWeapons.includes(weapon) : false,
    });
  }

  const events = parseEvents(text);

  const officialUrl = kurogamesArticlePageUrl(input.jsonBase, input.articleId);
  const rawJson = JSON.stringify(
    {
      version: input.version,
      subtitle: input.subtitle,
      articleId: input.articleId,
      characters,
      pools,
      weapons,
      newCharacters,
      newWeapons,
      events,
    },
    null,
    2,
  );

  return {
    version: input.version,
    subtitle: input.subtitle,
    coverUrl,
    officialUrl,
    providerUrl: officialUrl,
    releaseAt: input.publishedAt,
    rawJson,
    banners,
    events,
  };
}

/** ✦全新角色✦ 5星共鸣者「绯雪」（冷凝 | 迅刀） → {name, element, weaponType}，按出现顺序去重。 */
export function parseCharacters(text: string): CharacterInfo[] {
  const re =
    /5\s*星共鸣者\s*[「『]([^」』]+)[」』]\s*[（(]\s*([^（）()|｜]+?)\s*[|｜]\s*([^（）()]+?)\s*[)）]/g;
  const out: CharacterInfo[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim();
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, element: m[2].trim(), weaponType: m[3].trim() });
  }
  return out;
}

/** [雪色所映千般未来]角色活动唤取获得 → 卡池名，按出现顺序去重。 */
export function parsePoolNames(text: string): string[] {
  return collectUnique(text, /[[【「『]([^\]】」』]+)[\]】」』]\s*角色活动唤取获得/g);
}

/**
 * 「灼霜」武器活动唤取获得 → 武器名。
 * 注意必须锚定「…获得」：鸣潮武器卡池本身固定叫「浮声沉兵」，也会出现在
 * 「浮声沉兵」武器活动唤取「中」的句子里，不带「获得」，据此排除掉卡池名本身。
 */
export function parseWeapons(text: string): string[] {
  return collectUnique(text, /[「『]([^」』]+)[」』]\s*武器活动唤取获得/g);
}

/**
 * ✦全新角色✦ 5星共鸣者「绯雪」 / ✦全新武器✦ 5星武器「灼霜」里的名字 = 本版本首发。
 * kind='角色' 配 noun='共鸣者'，kind='武器' 配 noun='武器'。
 */
export function parseNewNames(
  text: string,
  kind: '角色' | '武器',
  noun: string,
): string[] {
  const re = new RegExp(
    `全新${kind}[\\s✦●]*5\\s*星${noun}\\s*[「『]([^」』]+)[」』]`,
    'g',
  );
  return collectUnique(text, re);
}

/** ✦全新地区/剧情/活动以及玩法✦ 后面紧跟的「…」/【…】，best-effort 抽成事件。 */
export function parseEvents(text: string): ParsedVersionEvent[] {
  const specs: { marker: string; category: ParsedVersionEvent['category']; label: string }[] =
    [
      { marker: '全新剧情', category: 'story', label: '主线剧情' },
      { marker: '全新地区', category: 'other', label: '全新地区' },
      { marker: '全新活动以及玩法', category: 'event', label: '活动玩法' },
    ];
  const events: ParsedVersionEvent[] = [];
  for (const spec of specs) {
    const re = new RegExp(
      `${spec.marker}[\\s✦●]*[「『【]([^」』】]+)[」』】]`,
    );
    const m = text.match(re);
    if (m) {
      events.push({ category: spec.category, name: m[1].trim(), label: spec.label });
    }
  }
  return events;
}

function collectUnique(text: string, re: RegExp): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = m[1].trim();
    if (value && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

/** 从正文 HTML 抽纯文本 + 首图（封面）。 */
export function extractContent(html: string): {
  text: string;
  coverUrl?: string;
} {
  const $ = cheerio.load(html ?? '');
  $('script, style').remove();
  const coverUrl = $('img').first().attr('src')?.trim() || undefined;
  const text = $.root().text().replace(/\s+/g, ' ').trim();
  return { text, coverUrl };
}

/** 仅供单测：导出纯函数好让 spec 用真实正文样本钉死解析行为。 */
export const __testables = {
  findVersionArticle,
  parseCharacters,
  parsePoolNames,
  parseWeapons,
  parseNewNames,
  parseEvents,
  parseVersionContent,
  extractContent,
};
