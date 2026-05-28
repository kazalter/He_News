import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.game.findMany({
      include: {
        _count: {
          select: {
            sources: true,
            articles: true,
            redeemCodes: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.game.findUniqueOrThrow({
      where: { id },
      include: {
        sources: { orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            articles: true,
            redeemCodes: true,
          },
        },
      },
    });
  }

  create(dto: CreateGameDto) {
    return this.prisma.game.create({
      data: {
        name: dto.name,
        slug: dto.slug ?? this.toSlug(dto.name),
        iconUrl: dto.iconUrl,
        officialUrl: dto.officialUrl,
      },
    });
  }

  update(id: string, dto: UpdateGameDto) {
    return this.prisma.game.update({
      where: { id },
      data: {
        ...dto,
        slug: dto.slug ?? undefined,
      },
    });
  }

  remove(id: string) {
    return this.prisma.game.delete({ where: { id } });
  }

  private toSlug(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return slug || `game-${Date.now()}`;
  }
}
