import { IsIn, IsString } from 'class-validator';

export class UpdateCodeStatusDto {
  @IsString()
  @IsIn(['unused', 'used', 'expired'])
  status: string;
}
