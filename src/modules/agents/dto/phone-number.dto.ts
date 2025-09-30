import { IsString, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AssignedAgentDto } from './assigned-agent.dto';

export class PhoneNumberDto {
  @IsString()
  phone_number: string;

  @IsString()
  label: string;

  @IsBoolean()
  supports_inbound: boolean;

  @IsBoolean()
  supports_outbound: boolean;

  @IsString()
  phone_number_id: string;

  @ValidateNested()
  @Type(() => AssignedAgentDto)
  assigned_agent: AssignedAgentDto;

  @IsString()
  provider: string;
}
