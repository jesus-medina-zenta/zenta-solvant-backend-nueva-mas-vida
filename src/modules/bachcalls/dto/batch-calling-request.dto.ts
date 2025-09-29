import { ApiProperty } from '@nestjs/swagger';

export type DynamicVariables = Record<string, any>;

export class ConversationInitiationClientDataDto {
  @ApiProperty({
    description: 'Type identifier',
    example: 'conversation_initiation_client_data',
  })
  type: string;

  @ApiProperty({ description: 'Dynamic variables for the conversation' })
  dynamic_variables: DynamicVariables;
}

export class BatchCallRecipientDto {
  @ApiProperty({ description: 'Phone number', example: '+56937752692' })
  phone_number: string;

  @ApiProperty({ description: 'Conversation initiation data' })
  conversation_initiation_client_data: ConversationInitiationClientDataDto;
}

export class BatchCallingRequestDto {
  @ApiProperty({
    description: 'Name of the batch call',
    example: 'Cobro atrasado Septiembre',
  })
  call_name: string;

  @ApiProperty({
    description: 'Agent ID',
    example: 'agent_5701k4jh05fgemmabhcj4jmhdfcq',
  })
  agent_id: string;

  @ApiProperty({
    description: 'Agent phone number ID',
    example: 'phnum_6401k2yysdhqf7asjrmjtpsga0y5',
  })
  agent_phone_number_id: string;

  @ApiProperty({
    description: 'Scheduled time as Unix timestamp',
    example: 1705363200,
  })
  scheduled_time_unix: number;

  @ApiProperty({
    description: 'List of recipients for the batch call',
    type: [BatchCallRecipientDto],
  })
  recipients: BatchCallRecipientDto[];
}
