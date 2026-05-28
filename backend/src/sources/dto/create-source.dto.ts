import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSourceDto {
  @IsString()
  gameId: string;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsString()
  @IsIn([
    'rss',
    'html',
    'steam',
    'bilibili',
    'weibo',
    'manual',
    'mihoyo-content-v2',
    'mihoyo-version-special',
    'mihoyo-zzz-news-version',
  ])
  type: string;

  @IsUrl({ require_tld: false })
  url: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(10080)
  crawlIntervalMinutes?: number;
}
