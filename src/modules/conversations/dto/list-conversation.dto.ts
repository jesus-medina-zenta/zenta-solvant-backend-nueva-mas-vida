import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsDate,
} from 'class-validator';

export class ListConversationsDto {
  @IsString()
  agent_id: string;

  @IsString()
  conversation_id: string;

  @IsInt()
  @Min(0)
  start_time_unix_secs: number;

  @IsInt()
  @Min(0)
  call_duration_secs: number;

  @IsInt()
  @Min(0)
  message_count: number;

  @IsString()
  status: string;

  @IsEnum(['success', 'failure', 'unknown'])
  call_successful: 'success' | 'failure' | 'unknown';

  @IsString()
  agent_name: string;

  @IsOptional()
  @IsString()
  transcript_summary: string;

  @IsOptional()
  @IsString()
  call_summary_title: string;

  @IsEnum(['inbound', 'outbound'])
  direction: 'inbound' | 'outbound';
}
