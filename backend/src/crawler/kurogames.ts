/**
 * 库洛游戏（鸣潮）官网资讯接口的逐游戏配置注册表。
 *
 * 鸣潮官网 mc.kurogames.com 是个 Vite SPA，资讯不走带鉴权的 API，而是直接读
 * CDN 上发布的静态 JSON：
 *   <jsonBase>/ArticleMenu.json          → 全部文章列表（标题 / id / 类型 / 时间 / 简介）
 *   <jsonBase>/article/<articleId>.json   → 单篇正文（articleContent 是完整 HTML）
 * 文章在官网的可读链接是 <siteBase>/main/news/detail/<articleId>。
 *
 * jsonBase 里的 G152 是国服 GEMA_ID、末尾 /zh 是语言段，都是从官网 bundle 的
 * VITE_APP_JSON_PATH_ZH（+ window.__CURRENTLOCALE__）抠出来的。这套机制是库洛
 * 系（鸣潮 / 战双）共用的，加一个库洛游戏 = 加一条。
 */
export type KurogamesGameConfig = {
  key: string;
  name: string;
  /** 静态 JSON 基址，已含语言段，结尾不带斜杠。 */
  jsonBase: string;
  /** 官网域名，拼文章可读链接用，结尾不带斜杠。 */
  siteBase: string;
};

export const KUROGAMES_GAMES: KurogamesGameConfig[] = [
  {
    key: 'wuwa',
    name: '鸣潮',
    jsonBase:
      'https://media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/zh',
    siteBase: 'https://mc.kurogames.com',
  },
];

const DEFAULT_SITE_BASE = 'https://mc.kurogames.com';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** source.url 存的是 jsonBase；按它在注册表里找回对应游戏（拿 siteBase 等）。 */
export function findKurogamesGameByJsonBase(
  jsonBase: string,
): KurogamesGameConfig | undefined {
  const normalized = trimTrailingSlash(jsonBase);
  return KUROGAMES_GAMES.find(
    (game) => trimTrailingSlash(game.jsonBase) === normalized,
  );
}

export function kurogamesArticleMenuUrl(jsonBase: string): string {
  return `${trimTrailingSlash(jsonBase)}/ArticleMenu.json`;
}

export function kurogamesArticleJsonUrl(
  jsonBase: string,
  articleId: number | string,
): string {
  return `${trimTrailingSlash(jsonBase)}/article/${articleId}.json`;
}

/** 文章在官网的可读详情页。注册表里查不到 jsonBase 时退回鸣潮官网域名。 */
export function kurogamesArticlePageUrl(
  jsonBase: string,
  articleId: number | string,
): string {
  const siteBase =
    findKurogamesGameByJsonBase(jsonBase)?.siteBase ?? DEFAULT_SITE_BASE;
  return `${trimTrailingSlash(siteBase)}/main/news/detail/${articleId}`;
}
