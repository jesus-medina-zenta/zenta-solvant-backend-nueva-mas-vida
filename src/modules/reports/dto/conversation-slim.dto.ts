import { ApiProperty } from '@nestjs/swagger';

export class ConversationSlimDto {
  @ApiProperty({
    description: 'Unique conversation identifier',
    example: 'conv_12345678-1234-5678-9012-123456789abc',
  })
  conversation_id: string;

  @ApiProperty({
    description: 'Agent identifier associated with the conversation',
    example: 'agent_12345',
  })
  agent_id: string;

  @ApiProperty({
    description: 'Track ID from dynamic variables (UUID format)',
    example: '12345678-1234-5678-9012-123456789abc',
    nullable: true,
  })
  track_id: string | null;

  @ApiProperty({
    description: 'Dynamic variables passed during conversation initiation',
    example: {
      track_id: '12345678-1234-5678-9012-123456789abc',
      custom_field: 'value',
    },
  })
  dynamic_variables: Record<string, unknown>;

  @ApiProperty({
    description: 'Evaluation results from conversation analysis',
    example: {
      evaluation_criteria_results: { score: 85, feedback: 'Good conversation' },
      data_collection_results: { collected_data: 'sample data' },
    },
  })
  evaluation: {
    evaluation_criteria_results?: Record<string, unknown>;
    data_collection_results?: Record<string, unknown>;
  };
}
