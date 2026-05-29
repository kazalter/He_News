import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlerService } from './crawler.service';

/**
 * 每分钟扫一遍 source，把「到点」的串行抓一次。
 * crawlIntervalMinutes 以前只是个摆设（代码里根本没调度器），这里让它真正生效。
 */
@Injectable()
export class CrawlerScheduler {
  private readonly logger = new Logger(CrawlerScheduler.name);
  /** 上一轮还没跑完就跳过本轮，避免慢 source 把多轮抓取叠在一起。 */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawler: CrawlerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const due = await this.findDueSources();
      for (const source of due) {
        try {
          await this.crawler.crawlSource(source.id);
        } catch (error) {
          // crawlSource 失败时不会更新 lastCrawledAt，这里补一次，
          // 让坏掉的 source 也按 interval 退避，而不是每分钟无脑重试。
          await this.prisma.source
            .update({
              where: { id: source.id },
              data: { lastCrawledAt: new Date() },
            })
            .catch(() => undefined);
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(`定时抓取失败 [${source.name}]：${message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async findDueSources() {
    const sources = await this.prisma.source.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        lastCrawledAt: true,
        crawlIntervalMinutes: true,
      },
    });
    const now = Date.now();
    return sources.filter(
      (source) =>
        !source.lastCrawledAt ||
        now - source.lastCrawledAt.getTime() >=
          source.crawlIntervalMinutes * 60_000,
    );
  }
}
