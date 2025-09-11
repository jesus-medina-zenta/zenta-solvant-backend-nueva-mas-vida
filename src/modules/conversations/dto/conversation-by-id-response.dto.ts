import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TranscriptDto {
  @IsEnum(['user', 'agent'])
  role: 'user' | 'agent';

  @IsInt()
  @Min(0)
  time_in_call_secs: number;

  @IsString()
  message: string;
}

class MetadataDto {
  @IsInt()
  @Min(0)
  start_time_unix_secs: number;

  @IsInt()
  @Min(0)
  call_duration_secs: number;
}

export class ConversationByIdResponseDto {
  @IsString()
  agent_id: string;

  @IsString()
  conversation_id: string;

  @IsString()
  status: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptDto)
  transcript: TranscriptDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata: MetadataDto;

  @IsBoolean()
  has_audio: boolean;

  @IsBoolean()
  has_user_audio: boolean;

  @IsBoolean()
  has_response_audio: boolean;

  dinamic_variable?: any;
}
