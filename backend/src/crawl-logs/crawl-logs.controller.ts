import { Controller, Get, Query } from '@nestjs/common';
import { CrawlLogsService } from './crawl-logs.service';
import { CrawlLogQueryDto } from './dto/crawl-log-query.dto';

@Controller('api/crawl-logs')
export class CrawlLogsController {
  constructor(private readonly crawlLogsService: CrawlLogsService) {}

  @Get()
  findAll(@Query() query: CrawlLogQueryDto) {
    return this.crawlLogsService.findAll(query);
  }
}
