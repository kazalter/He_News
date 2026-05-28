import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateGameDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  iconUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  officialUrl?: string;
}
