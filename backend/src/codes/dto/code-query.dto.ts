import { IsOptional, IsString } from 'class-validator';

export class CodeQueryDto {
  @IsOptional()
  @IsString()
  gameId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
