import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlLogQueryDto } from './dto/crawl-log-query.dto';

@Injectable()
export class CrawlLogsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: CrawlLogQueryDto) {
    return this.prisma.crawlLog.findMany({
      where: {
        sourceId: query.sourceId,
        status: query.status,
      },
      include: {
        source: {
          include: {
            game: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }
}
