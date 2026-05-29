import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CodeQueryDto } from './dto/code-query.dto';

@Injectable()
export class CodesService {
  private readonly logger = new Logger(CodesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(query: CodeQueryDto) {
    return this.prisma.redeemCode.findMany({
      where: {
        gameId: query.gameId,
        status: query.status,
      },
      include: {
        game: true,
        source: true,
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

  /**
   * 把到期的码自动标过期。每小时跑一次。
   * 只动有 expiredAt 且已过期、状态还不是 expired/used 的码——不碰用户手动标过的。
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireOverdueCodes(): Promise<number> {
    const result = await this.prisma.redeemCode.updateMany({
      where: {
        status: { notIn: ['expired', 'used'] },
        expiredAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    });

    if (result.count > 0) {
      this.logger.log(`标记 ${result.count} 个到期兑换码为已过期`);
    }

    return result.count;
  }
}
