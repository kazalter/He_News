import { Controller, Get, Param, Query } from '@nestjs/common';
import { VersionPlansService } from './version-plans.service';

@Controller('api/version-plans')
export class VersionPlansController {
  constructor(private readonly service: VersionPlansService) {}

  @Get()
  findAll(@Query('gameId') gameId?: string) {
    return this.service.findAll(gameId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
