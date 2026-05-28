import { Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { ClassificationModule } from '../classification/classification.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ClassificationModule],
  providers: [CrawlerService],
  exports: [CrawlerService],
})
export class CrawlerModule {}
