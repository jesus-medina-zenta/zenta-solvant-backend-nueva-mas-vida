import { ListConversationsDto } from './list-conversation.dto';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListConversationsResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListConversationsDto)
  conversations: ListConversationsDto[];

  @IsBoolean()
  hasMore: boolean;

  @IsOptional()
  @IsString()
  nextCursor: string;
}
