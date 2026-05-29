/**
 * 鸣潮官网资讯 parser（库洛游戏静态 JSON 渠道）。
 *
 * 数据流：
 *   1. 拉 <jsonBase>/ArticleMenu.json —— 这是官网「资讯」整张文章列表
 *      （标题 / articleId / 类型 / 发布时间 / 简介；articleContent 在这里只是预览片段）。
 *   2. 按发布时间取最新的 N 篇，逐篇拉 <jsonBase>/article/<id>.json 取完整正文。
 *   3. 映射成 CrawledArticle，交给 crawler 的文章管线去重落库。
 *
 * 设计取舍：列表一次能返回上百篇历史文章，每次只取最新 N 篇拉正文（默认 12），
 * 避免首抓时几百个详情请求。正文拉取是 best-effort——单篇失败就退回只用列表里的
 * 标题 / 简介，不让整源挂掉。
 *
 * 脆点：官网换 JSON 结构（改字段名、把正文挪走）会让映射 silently 变空。
 * spec 用真实 ArticleMenu fixture 钉死字段。
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  kurogamesArticleJsonUrl,
  kurogamesArticleMenuUrl,
  kurogamesArticlePageUrl,
} from '../../kurogames';

const USER_AGENT =
  'HE-News/0.1 (+https://local.app; official-news-aggregator)';

/** 默认每次抓取拉正文的文章数（按发布时间取最新的几篇）。 */
const DEFAULT_LIMIT = 12;

/** ArticleMenu.json / article/<id>.json 里我们用到的字段。 */
type KuroArticleRaw = {
  articleId?: number;
  articleTitle?: string;
  articleType?: number;
  articleDesc?: string;
  articleContent?: string;
  createTime?: string;
  startTime?: string;
  suggestCover?: string;
};

export type KuroArticleMeta = {
  articleId: number;
  title: string;
  desc?: string;
  suggestCover?: string;
  publishedAt?: Date;
};

/** 与 crawler.service 的 CrawledArticle 结构一致，可直接当 fetchSource 的返回。 */
export type KurogamesNewsArticle = {
  title: string;
  url: string;
  summary?: string;
  content?: string;
  coverUrl?: string;
  publishedAt?: Date;
  category?: string;
};

export async function fetchKurogamesNews(
  jsonBase: string,
  limit = DEFAULT_LIMIT,
): Promise<KurogamesNewsArticle[]> {
  const menuUrl = kurogamesArticleMenuUrl(jsonBase);
  const { data } = await axios.get<unknown>(menuUrl, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 20000,
  });

  const metas = parseArticleMenu(data).slice(0, Math.max(1, limit));

  return Promise.all(
    metas.map(async (meta) => {
      const detail = await fetchArticleDetail(jsonBase, meta.articleId).catch(
        () => undefined,
      );
      return toNewsArticle(meta, jsonBase, detail);
    }),
  );
}

/**
 * 把 ArticleMenu.json（数组）映射成按发布时间倒序的文章元数据。
 * 丢掉缺 id / 缺标题的脏数据。
 */
export function parseArticleMenu(raw: unknown): KuroArticleMeta[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const metas: KuroArticleMeta[] = [];
  for (const entry of raw as KuroArticleRaw[]) {
    const articleId = entry?.articleId;
    const title = normalizeText(entry?.articleTitle ?? '');
    if (typeof articleId !== 'number' || !title) {
      continue;
    }
    metas.push({
      articleId,
      title,
      desc: normalizeText(entry.articleDesc ?? '') || undefined,
      suggestCover: entry.suggestCover?.trim() || undefined,
      publishedAt:
        parseBeijingTime(entry.startTime) ?? parseBeijingTime(entry.createTime),
    });
  }

  return metas.sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  );
}

async function fetchArticleDetail(
  jsonBase: string,
  articleId: number,
): Promise<KuroArticleRaw> {
  const url = kurogamesArticleJsonUrl(jsonBase, articleId);
  const { data } = await axios.get<KuroArticleRaw>(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 20000,
  });
  return data;
}

export function toNewsArticle(
  meta: KuroArticleMeta,
  jsonBase: string,
  detail?: KuroArticleRaw,
): KurogamesNewsArticle {
  const html = detail?.articleContent;
  const { text, coverUrl } = html
    ? extractContent(html)
    : { text: undefined, coverUrl: undefined };

  const summary = meta.desc ?? truncate(text, 280);

  return {
    title: meta.title,
    url: kurogamesArticlePageUrl(jsonBase, meta.articleId),
    summary,
    content: text ?? meta.desc,
    coverUrl: coverUrl ?? meta.suggestCover,
    publishedAt: meta.publishedAt,
  };
}

/** 从正文 HTML 抽纯文本 + 首图（封面）。 */
export function extractContent(html: string): {
  text: string;
  coverUrl?: string;
} {
  const $ = cheerio.load(html);
  $('script, style').remove();
  const coverUrl = $('img').first().attr('src')?.trim() || undefined;
  return { text: normalizeText($.root().text()), coverUrl };
}

function parseBeijingTime(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  // 形如 "2026-04-30 10:00:00"，官网时间按北京时间解释。
  const iso = `${value.trim().replace(' ', 'T')}+08:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string | undefined, length: number): string | undefined {
  if (!value) {
    return undefined;
  }
  const text = normalizeText(value);
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

/** 仅供单测：导出纯函数好让 spec 用真实 fixture 钉死解析行为。 */
export const __testables = {
  parseArticleMenu,
  toNewsArticle,
  extractContent,
};
