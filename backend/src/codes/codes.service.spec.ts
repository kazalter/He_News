/**
 * CodesService.expireOverdueCodes 的回归测试。
 *
 * 这个定时任务只该动"有 expiredAt 且已过期、状态还不是 expired/used"的码。
 * 钉死 where 过滤，防止以后有人误把 used 码或没设过期时间的码也标成过期。
 */
import { CodesService } from './codes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CodesService.expireOverdueCodes', () => {
  it('只过期 status∉{expired,used} 且 expiredAt<now 的码', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = { redeemCode: { updateMany } } as unknown as PrismaService;
    const service = new CodesService(prisma);

    const before = Date.now();
    const count = await service.expireOverdueCodes();
    const after = Date.now();

    expect(count).toBe(3);
    expect(updateMany).toHaveBeenCalledTimes(1);

    const arg = updateMany.mock.calls[0][0];
    expect(arg.data).toEqual({ status: 'expired' });
    expect(arg.where.status).toEqual({ notIn: ['expired', 'used'] });

    // expiredAt 用 { lt: <now> }，Prisma 对 lt 自动排除 null，
    // 所以没设过期时间的码不会被误标。
    const lt = arg.where.expiredAt.lt as Date;
    expect(lt).toBeInstanceOf(Date);
    expect(lt.getTime()).toBeGreaterThanOrEqual(before);
    expect(lt.getTime()).toBeLessThanOrEqual(after);
  });
});
