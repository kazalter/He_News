import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleQueryDto } from './dto/article-query.dto';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ArticleQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ArticleWhereInput = {
      gameId: query.gameId,
      category: query.category,
      isRead: this.toBoolean(query.isRead),
      isFavorite: this.toBoolean(query.isFavorite),
    };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { summary: { contains: query.search } },
        { content: { contains: query.search } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        include: {
          game: true,
          source: true,
          redeemCodes: true,
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.article.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  findOne(id: string) {
    return this.prisma.article.findUniqueOrThrow({
      where: { id },
      include: {
        game: true,
        source: true,
        redeemCodes: true,
      },
    });
  }

  setRead(id: string, value: boolean) {
    return this.prisma.article.update({
      where: { id },
      data: { isRead: value },
    });
  }

  setFavorite(id: string, value: boolean) {
    return this.prisma.article.update({
      where: { id },
      data: { isFavorite: value },
    });
  }

  private toBoolean(value?: string) {
    if (value === undefined) {
      return undefined;
    }

    return value === 'true';
  }
}
