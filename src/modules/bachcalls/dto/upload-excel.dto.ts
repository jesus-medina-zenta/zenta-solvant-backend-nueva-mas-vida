import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadExcelDto {
  @ApiProperty({ description: 'ID of the agent' })
  @IsNotEmpty()
  @IsString()
  agent_id: string;

  @ApiProperty({ description: 'ID of the phone' })
  @IsNotEmpty()
  @IsString()
  phone_id: string;

  @ApiProperty({ description: 'Name of the batch calling' })
  @IsNotEmpty()
  @IsString()
  batch_name: string;
}
