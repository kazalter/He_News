import { BadRequestException, Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import Parser from 'rss-parser';
import { ClassificationService } from '../classification/classification.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseMihoyoVersionSpecial } from './parsers/mihoyo-version-special';
import { parseZzzNewsVersion } from './parsers/zzz-news-version';

@Injectable()
export class CrawlerService {
  private readonly rssParser = new Parser();

  constructor(
    private readonly prisma: PrismaService,
    private readonly classification: ClassificationService,
  ) {}

  async crawlSource(sourceId: string) {
    const source = await this.prisma.source.findUniqueOrThrow({
      where: { id: sourceId },
      include: { game: true },
    });
    const log = await this.prisma.crawlLog.create({
      data: {
        sourceId,
        status: 'running',
        message: 'Crawl started',
      },
    });

    try {
      if (
        source.type === 'mihoyo-version-special' ||
        source.type === 'mihoyo-zzz-news-version'
      ) {
        const summary = await this.crawlVersionSpecial(source);
        await this.prisma.source.update({
          where: { id: sourceId },
          data: { lastCrawledAt: new Date() },
        });
        await this.prisma.crawlLog.update({
          where: { id: log.id },
          data: {
            status: 'success',
            message: `Version ${summary.version}: ${summary.bannerCount} 卡池, ${summary.eventCount} 活动`,
            finishedAt: new Date(),
          },
        });
        return summary;
      }

      const candidates = await this.fetchSource(source);
      let createdArticles = 0;
      let skippedArticles = 0;
      let detectedCodes = 0;

      for (const candidate of candidates) {
        const contentHash = this.hashArticle(source.id, candidate);
        const existing = await this.prisma.article.findUnique({
          where: { contentHash },
        });

        if (existing) {
          skippedArticles += 1;
          continue;
        }

        const detectedCategory = this.classification.classify(candidate);
        const category =
          detectedCategory === 'other' && candidate.category
            ? candidate.category
            : detectedCategory;
        const article = await this.prisma.article.create({
          data: {
            gameId: source.gameId,
            sourceId: source.id,
            title: candidate.title,
            summary: candidate.summary,
            content: candidate.content,
            url: candidate.url,
            coverUrl: candidate.coverUrl,
            publishedAt: candidate.publishedAt,
            category,
            contentHash,
          },
        });
        createdArticles += 1;

        const codes = this.classification.extractRedeemCodes(candidate);
        detectedCodes += codes.length;

        for (const code of codes) {
          await this.prisma.redeemCode.upsert({
            where: {
              gameId_code: {
                gameId: source.gameId,
                code,
              },
            },
            update: {
              articleId: article.id,
              description: candidate.title,
            },
            create: {
              gameId: source.gameId,
              articleId: article.id,
              code,
              description: candidate.title,
            },
          });
        }
      }

      await this.prisma.source.update({
        where: { id: sourceId },
        data: { lastCrawledAt: new Date() },
      });
      await this.prisma.crawlLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          message: `Created ${createdArticles}, skipped ${skippedArticles}, detected ${detectedCodes} codes`,
          finishedAt: new Date(),
        },
      });

      return {
        sourceId,
        createdArticles,
        skippedArticles,
        detectedCodes,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.crawlLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          message,
          finishedAt: new Date(),
        },
      });

      throw new BadRequestException(message);
    }
  }

  private async crawlVersionSpecial(source: Source) {
    const parsed =
      source.type === 'mihoyo-zzz-news-version'
        ? await parseZzzNewsVersion(source.url)
        : await parseMihoyoVersionSpecial(source.url);

    const plan = await this.prisma.versionPlan.upsert({
      where: {
        gameId_version: {
          gameId: source.gameId,
          version: parsed.version,
        },
      },
      update: {
        subtitle: parsed.subtitle ?? null,
        releaseAt: parsed.releaseAt ?? null,
        coverUrl: parsed.coverUrl ?? null,
        officialUrl: parsed.officialUrl,
        provider: 'mihoyo-version-special',
        providerUrl: parsed.providerUrl,
        raw: parsed.rawJson,
        lastSyncedAt: new Date(),
      },
      create: {
        gameId: source.gameId,
        version: parsed.version,
        subtitle: parsed.subtitle ?? null,
        releaseAt: parsed.releaseAt ?? null,
        coverUrl: parsed.coverUrl ?? null,
        officialUrl: parsed.officialUrl,
        provider: 'mihoyo-version-special',
        providerUrl: parsed.providerUrl,
        raw: parsed.rawJson,
        lastSyncedAt: new Date(),
      },
    });

    await this.prisma.$transaction([
      this.prisma.versionPlanBanner.deleteMany({ where: { planId: plan.id } }),
      this.prisma.versionPlanEvent.deleteMany({ where: { planId: plan.id } }),
      this.prisma.versionPlanBanner.createMany({
        data: parsed.banners.map((banner) => ({
          planId: plan.id,
          phase: banner.phase,
          poolIndex: banner.poolIndex,
          poolName: banner.poolName ?? null,
          characterName: banner.characterName ?? null,
          characterRarity: banner.characterRarity ?? null,
          characterPath: banner.characterPath ?? null,
          characterElement: banner.characterElement ?? null,
          isNewCharacter: banner.isNewCharacter,
          weaponName: banner.weaponName ?? null,
          weaponRarity: banner.weaponRarity ?? null,
          isNewWeapon: banner.isNewWeapon,
          startAt: banner.startAt ?? null,
          endAt: banner.endAt ?? null,
          rawTime: banner.rawTime ?? null,
          rawRoleInfo: banner.rawRoleInfo ?? null,
          rawConeInfo: banner.rawConeInfo ?? null,
        })),
      }),
      this.prisma.versionPlanEvent.createMany({
        data: parsed.events.map((event) => ({
          planId: plan.id,
          category: event.category,
          name: event.name,
          label: event.label ?? null,
          info: event.info ?? null,
        })),
      }),
    ]);

    return {
      sourceId: source.id,
      planId: plan.id,
      version: parsed.version,
      bannerCount: parsed.banners.length,
      eventCount: parsed.events.length,
    };
  }

  private async fetchSource(source: Source) {
    const type = source.type.toLowerCase();

    if (type === 'rss') {
      return this.fetchRss(source);
    }

    if (type === 'mihoyo-content-v2') {
      return this.fetchMihoyoContentV2(source);
    }

    if (
      type === 'html' ||
      type === 'steam' ||
      type === 'bilibili' ||
      type === 'weibo'
    ) {
      return this.fetchHtml(source);
    }

    throw new Error(`Unsupported source type: ${source.type}`);
  }

  private async fetchRss(source: Source): Promise<CrawledArticle[]> {
    const feed = await this.rssParser.parseURL(source.url);

    return feed.items
      .map<CrawledArticle | undefined>((item) => {
        const title = this.normalizeText(item.title ?? '');
        const url = item.link ?? source.url;
        const content = this.normalizeText(
          item.content ?? item.contentSnippet ?? item.summary ?? '',
        );

        if (!title || !url) {
          return undefined;
        }

        return {
          title,
          url,
          summary: this.truncate(item.contentSnippet ?? content, 280),
          content,
          publishedAt: this.parseDate(item.isoDate ?? item.pubDate),
        };
      })
      .filter((item): item is CrawledArticle => item !== undefined);
  }

  private async fetchHtml(source: Source): Promise<CrawledArticle[]> {
    const response = await axios.get<string>(source.url, {
      headers: {
        'User-Agent':
          'HE-News/0.1 (+https://local.app; official-news-aggregator)',
      },
      timeout: 15000,
    });
    const baseUrl = response.request?.res?.responseUrl ?? source.url;
    const $ = cheerio.load(response.data);
    const candidates: CrawledArticle[] = [];
    const seenUrls = new Set<string>();

    $('article a, .news a, .post a, .article a, .list a, .item a, a').each(
      (_, element) => {
        if (candidates.length >= 30) {
          return false;
        }

        const link = $(element);
        const href = link.attr('href');
        const title = this.normalizeText(link.attr('title') ?? link.text());

        if (!href || title.length < 4) {
          return;
        }

        const url = this.toAbsoluteUrl(href, baseUrl);

        if (!url || seenUrls.has(url)) {
          return;
        }

        seenUrls.add(url);
        const parent = link.closest(
          'article, li, .news, .post, .article, .item',
        );
        const rawSummary = this.normalizeText(parent.text() || title);
        const imageSrc =
          parent.find('img').first().attr('src') ??
          link.find('img').first().attr('src');

        candidates.push({
          title,
          url,
          summary: this.truncate(rawSummary, 280),
          content: rawSummary,
          coverUrl: imageSrc
            ? this.toAbsoluteUrl(imageSrc, baseUrl)
            : undefined,
        });
      },
    );

    if (candidates.length > 0) {
      return candidates;
    }

    const title = this.normalizeText($('title').first().text() || source.name);
    const content = this.normalizeText($('body').text());

    return [
      {
        title,
        url: source.url,
        summary: this.truncate(content, 280),
        content,
      },
    ];
  }

  private async fetchMihoyoContentV2(
    source: Source,
  ): Promise<CrawledArticle[]> {
    const endpoint = new URL(source.url);
    const channelIds = this.getMihoyoChannelIds(endpoint);
    const pageSize = this.getNumberParam(endpoint, 'iPageSize', 10, 1, 30);
    const lang = endpoint.searchParams.get('sLangKey') ?? 'zh-cn';
    const newsBase = this.getMihoyoNewsBaseUrl(endpoint);
    const candidates: CrawledArticle[] = [];
    const seenIds = new Set<number>();

    for (const channelId of channelIds) {
      endpoint.searchParams.delete('channels');
      endpoint.searchParams.delete('channelIds');
      endpoint.searchParams.set('iChanId', String(channelId));
      endpoint.searchParams.set('iPage', '1');
      endpoint.searchParams.set('iPageSize', String(pageSize));
      endpoint.searchParams.set('sLangKey', lang);

      const response = await axios.get<MihoyoContentListResponse>(
        endpoint.toString(),
        {
          headers: {
            Referer: `${newsBase}/news`,
            'User-Agent':
              'HE-News/0.1 (+https://local.app; official-news-aggregator)',
          },
          timeout: 15000,
        },
      );

      if (response.data.retcode !== 0) {
        throw new Error(
          `MiHoYo content API failed: ${response.data.message ?? response.data.retcode}`,
        );
      }

      for (const item of response.data.data?.list ?? []) {
        if (seenIds.has(item.iInfoId)) {
          continue;
        }

        const article = this.toMihoyoArticle(item, newsBase, channelId);

        if (!article) {
          continue;
        }

        seenIds.add(item.iInfoId);
        candidates.push(article);
      }
    }

    return candidates.sort((left, right) => {
      const leftTime = left.publishedAt?.getTime() ?? 0;
      const rightTime = right.publishedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    });
  }

  /**
   * 不同游戏的 content_v2_user API 用同一套，但每个 appId 对应不同的官网域名，
   * 文章链接、Referer 都要按 appId 切换。这里按 source URL path 里的 appId
   * 决定 news 落地页域名；未知 appId 兜底到星穹铁道（避免破坏既有 source）。
   */
  private getMihoyoNewsBaseUrl(endpoint: URL): string {
    const appMatch = endpoint.pathname.match(
      /\/content_v2_user\/app\/([0-9a-f]+)\//i,
    );
    const appId = appMatch?.[1];
    const map: Record<string, string> = {
      '1963de8dc19e461c': 'https://sr.mihoyo.com',
      '706fd13a87294881': 'https://zzz.mihoyo.com',
    };
    return (appId && map[appId]) || 'https://sr.mihoyo.com';
  }

  /**
   * ZZZ 等较新的游戏 sCategoryName 多半是空字符串，单靠 mapMihoyoCategory 会全部归
   * 到 other。把抓取时的 channelId 作为兜底：278/资讯→other, 279/公告→announcement,
   * 280/活动→event；星穹铁道的 256/257/258 同理。
   */
  private mapChannelToCategory(channelId: number): string | undefined {
    const announcementChannels = new Set([257, 279]);
    const eventChannels = new Set([258, 280]);
    if (announcementChannels.has(channelId)) return 'announcement';
    if (eventChannels.has(channelId)) return 'event';
    return undefined;
  }

  private toMihoyoArticle(
    item: MihoyoContentItem,
    newsBase: string,
    channelId: number,
  ) {
    const title = this.normalizeText(item.sTitle ?? '');

    if (!title || !item.iInfoId) {
      return undefined;
    }

    const ext = this.parseMihoyoExt(item.sExt);
    const contentText = this.htmlToText(item.sContent);
    const summarySource = item.sIntro || contentText;
    const content = this.normalizeText(
      [item.sIntro, contentText].filter(Boolean).join('\n'),
    );

    return {
      title,
      url: this.getMihoyoArticleUrl(item, ext, newsBase),
      summary: this.truncate(summarySource, 280),
      content,
      coverUrl: this.getMihoyoCoverUrl(item, ext),
      publishedAt: this.parseMihoyoDate(item.dtStartTime),
      category:
        this.mapMihoyoCategory(item.sCategoryName) ??
        this.mapChannelToCategory(channelId),
    };
  }

  private getMihoyoChannelIds(endpoint: URL) {
    const channelParam =
      endpoint.searchParams.get('channels') ??
      endpoint.searchParams.get('channelIds') ??
      endpoint.searchParams.get('iChanId');

    if (!channelParam) {
      return [256, 257, 258];
    }

    const channelIds = channelParam
      .split(/[,\s]+/)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    return channelIds.length > 0 ? channelIds : [256, 257, 258];
  }

  private getNumberParam(
    endpoint: URL,
    key: string,
    fallback: number,
    min: number,
    max: number,
  ) {
    const value = Number(endpoint.searchParams.get(key));

    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, value));
  }

  private parseMihoyoExt(value?: string | Record<string, unknown>) {
    if (!value) {
      return {};
    }

    if (typeof value !== 'string') {
      return value;
    }

    try {
      return JSON.parse(value) as MihoyoContentExt;
    } catch {
      return {};
    }
  }

  private getMihoyoArticleUrl(
    item: MihoyoContentItem,
    ext: MihoyoContentExt,
    newsBase: string,
  ) {
    const directUrl = this.normalizeText(item.sUrl ?? '');

    if (directUrl) {
      return directUrl;
    }

    if (ext['news-self-path'] === 'public') {
      return `${newsBase}/news/public`;
    }

    return `${newsBase}/news/${item.iInfoId}`;
  }

  private getMihoyoCoverUrl(
    item: MihoyoContentItem,
    ext: MihoyoContentExt,
  ) {
    const posters = ext['news-poster'];

    if (Array.isArray(posters)) {
      const poster = posters.find((entry) => entry?.url);

      if (poster?.url) {
        return poster.url;
      }
    }

    const $ = cheerio.load(item.sContent ?? '');
    return $('img').first().attr('src') ?? $('video').first().attr('poster');
  }

  private mapMihoyoCategory(value?: string) {
    const category = this.normalizeText(value ?? '');

    if (category.includes('公告')) {
      return 'announcement';
    }

    if (category.includes('活动')) {
      return 'event';
    }

    return undefined;
  }

  private htmlToText(value?: string) {
    if (!value) {
      return undefined;
    }

    const $ = cheerio.load(value);
    $('script, style').remove();
    return this.normalizeText($.root().text());
  }

  private parseMihoyoDate(value?: string) {
    if (!value) {
      return undefined;
    }

    return this.parseDate(`${value.replace(' ', 'T')}+08:00`);
  }

  private hashArticle(sourceId: string, article: CrawledArticle) {
    return createHash('sha256')
      .update([sourceId, article.url, article.title].join('|'))
      .digest('hex');
  }

  private parseDate(value?: string) {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private normalizeText(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  private truncate(value: string | undefined, length: number) {
    if (!value) {
      return undefined;
    }

    const text = this.normalizeText(value);
    return text.length > length ? `${text.slice(0, length)}...` : text;
  }

  private toAbsoluteUrl(href: string, baseUrl: string) {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return undefined;
    }
  }
}

type CrawledArticle = {
  title: string;
  url: string;
  summary?: string;
  content?: string;
  coverUrl?: string;
  publishedAt?: Date;
  category?: string;
};

type MihoyoContentListResponse = {
  retcode: number;
  message?: string;
  data?: {
    list?: MihoyoContentItem[];
  };
};

type MihoyoContentItem = {
  sTitle?: string;
  sIntro?: string;
  sUrl?: string;
  sContent?: string;
  sExt?: string;
  dtStartTime?: string;
  iInfoId: number;
  sCategoryName?: string;
};

type MihoyoContentExt = Record<string, unknown> & {
  'news-poster'?: Array<{ url?: string }>;
  'news-self-path'?: string;
};
