import { Module } from '@nestjs/common';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { CrawlerModule } from '../crawler/crawler.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, CrawlerModule],
  controllers: [SourcesController],
  providers: [SourcesService],
})
export class SourcesModule {}
