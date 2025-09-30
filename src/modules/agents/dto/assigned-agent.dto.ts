import { IsString } from 'class-validator';

export class AssignedAgentDto {
  @IsString()
  agent_id: string;

  @IsString()
  agent_name: string;
}
