import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CrawlerService } from '../crawler/crawler.service';
import { CreateSourceDto } from './dto/create-source.dto';
import { SourcesService } from './sources.service';
import { UpdateSourceDto } from './dto/update-source.dto';

@Controller('api/sources')
export class SourcesController {
  constructor(
    private readonly sourcesService: SourcesService,
    private readonly crawlerService: CrawlerService,
  ) {}

  @Get()
  findAll(@Query('gameId') gameId?: string) {
    return this.sourcesService.findAll(gameId);
  }

  @Post()
  create(@Body() dto: CreateSourceDto) {
    return this.sourcesService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sourcesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSourceDto) {
    return this.sourcesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sourcesService.remove(id);
  }

  @Post(':id/crawl')
  crawl(@Param('id') id: string) {
    return this.crawlerService.crawlSource(id);
  }
}
