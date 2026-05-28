import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticleQueryDto } from './dto/article-query.dto';
import { ToggleArticleDto } from './dto/toggle-article.dto';

@Controller('api/articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  findAll(@Query() query: ArticleQueryDto) {
    return this.articlesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(id);
  }

  @Patch(':id/read')
  setRead(@Param('id') id: string, @Body() dto: ToggleArticleDto) {
    return this.articlesService.setRead(id, dto.value);
  }

  @Patch(':id/favorite')
  setFavorite(@Param('id') id: string, @Body() dto: ToggleArticleDto) {
    return this.articlesService.setFavorite(id, dto.value);
  }
}
