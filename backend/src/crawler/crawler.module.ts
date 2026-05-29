import { Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { CrawlerScheduler } from './crawler.scheduler';
import { ClassificationModule } from '../classification/classification.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ClassificationModule],
  providers: [CrawlerService, CrawlerScheduler],
  exports: [CrawlerService],
})
export class CrawlerModule {}
