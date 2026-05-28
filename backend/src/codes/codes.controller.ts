import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CodesService } from './codes.service';
import { CodeQueryDto } from './dto/code-query.dto';
import { UpdateCodeStatusDto } from './dto/update-code-status.dto';

@Controller('api/codes')
export class CodesController {
  constructor(private readonly codesService: CodesService) {}

  @Get()
  findAll(@Query() query: CodeQueryDto) {
    return this.codesService.findAll(query);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCodeStatusDto) {
    return this.codesService.updateStatus(id, dto.status);
  }
}
