import { IsOptional, IsString } from 'class-validator';

export class CrawlLogQueryDto {
  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
