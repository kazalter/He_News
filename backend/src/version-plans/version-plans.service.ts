import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VersionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(gameId?: string) {
    return this.prisma.versionPlan.findMany({
      where: gameId ? { gameId } : undefined,
      include: {
        game: true,
        banners: { orderBy: [{ phase: 'asc' }, { poolIndex: 'asc' }] },
        events: { orderBy: { startAt: 'asc' } },
      },
      orderBy: [{ releaseAt: 'desc' }, { version: 'desc' }],
    });
  }

  findOne(id: string) {
    return this.prisma.versionPlan.findUniqueOrThrow({
      where: { id },
      include: {
        game: true,
        banners: { orderBy: [{ phase: 'asc' }, { poolIndex: 'asc' }] },
        events: { orderBy: { startAt: 'asc' } },
      },
    });
  }
}
