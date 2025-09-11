import { IsString, IsOptional, IsDateString } from 'class-validator';

export class ListAgentsDto {
  @IsString()
  agentId: string;

  @IsString()
  name: string;

  @IsDateString()
  createdAt: string;

  @IsString()
  creatorName: string;

  @IsOptional()
  @IsDateString()
  lastCallTime: string;
}
