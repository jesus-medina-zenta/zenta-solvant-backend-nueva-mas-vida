import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetConversationsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string | null;

  @IsOptional()
  @IsString()
  agent_id?: string | null;

  @IsOptional()
  @IsEnum(['success', 'failure', 'unknown'])
  call_successful?: 'success' | 'failure' | 'unknown' | null;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  call_start_before_unix?: number | null;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  call_start_after_unix?: number | null;

  @IsOptional()
  @IsString()
  user_id?: string | null;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;

  @IsOptional()
  @IsEnum(['exclude', 'include'])
  summary_mode?: 'exclude' | 'include';
}
