import { Module } from '@nestjs/common';
import { CrawlLogsController } from './crawl-logs.controller';
import { CrawlLogsService } from './crawl-logs.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CrawlLogsController],
  providers: [CrawlLogsService],
})
export class CrawlLogsModule {}
