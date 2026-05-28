import { IsBoolean } from 'class-validator';

export class ToggleArticleDto {
  @IsBoolean()
  value: boolean;
}
