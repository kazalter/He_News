import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(gameId?: string) {
    return this.prisma.source.findMany({
      where: { gameId },
      include: {
        game: true,
        _count: {
          select: {
            articles: true,
            crawlLogs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.source.findUniqueOrThrow({
      where: { id },
      include: {
        game: true,
        crawlLogs: {
          take: 5,
          orderBy: { startedAt: 'desc' },
        },
      },
    });
  }

  create(dto: CreateSourceDto) {
    return this.prisma.source.create({
      data: this.toCreateData(dto),
    });
  }

  update(id: string, dto: UpdateSourceDto) {
    return this.prisma.source.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type?.toLowerCase(),
        url: dto.url,
        enabled: dto.enabled,
        crawlIntervalMinutes: dto.crawlIntervalMinutes,
        gameId: dto.gameId,
      },
    });
  }

  remove(id: string) {
    return this.prisma.source.delete({ where: { id } });
  }

  private toCreateData(dto: CreateSourceDto): Prisma.SourceCreateInput {
    return {
      game: { connect: { id: dto.gameId } },
      name: dto.name,
      type: dto.type.toLowerCase(),
      url: dto.url,
      enabled: dto.enabled ?? true,
      crawlIntervalMinutes: dto.crawlIntervalMinutes ?? 60,
    };
  }
}
