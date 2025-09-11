import { ListAgentsDto } from './list-agents.dto';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListAgentsResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListAgentsDto)
  agents: ListAgentsDto[];

  @IsBoolean()
  hasMore: boolean;

  @IsOptional()
  @IsString()
  nextCursor: string;
}
