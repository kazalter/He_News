import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeQueryDto } from './dto/code-query.dto';

@Injectable()
export class CodesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: CodeQueryDto) {
    return this.prisma.redeemCode.findMany({
      where: {
        gameId: query.gameId,
        status: query.status,
      },
      include: {
        game: true,
        article: {
          include: {
            source: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateStatus(id: string, status: string) {
    return this.prisma.redeemCode.update({
      where: { id },
      data: { status },
    });
  }
}
