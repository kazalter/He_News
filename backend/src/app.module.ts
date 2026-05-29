import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ClassificationModule } from './classification/classification.module';
import { CrawlerModule } from './crawler/crawler.module';
import { GamesModule } from './games/games.module';
import { SourcesModule } from './sources/sources.module';
import { ArticlesModule } from './articles/articles.module';
import { CodesModule } from './codes/codes.module';
import { CrawlLogsModule } from './crawl-logs/crawl-logs.module';
import { VersionPlansModule } from './version-plans/version-plans.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    ClassificationModule,
    CrawlerModule,
    GamesModule,
    SourcesModule,
    ArticlesModule,
    CodesModule,
    CrawlLogsModule,
    VersionPlansModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
