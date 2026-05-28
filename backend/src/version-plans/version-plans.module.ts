import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VersionPlansController } from './version-plans.controller';
import { VersionPlansService } from './version-plans.service';

@Module({
  imports: [PrismaModule],
  controllers: [VersionPlansController],
  providers: [VersionPlansService],
  exports: [VersionPlansService],
})
export class VersionPlansModule {}
