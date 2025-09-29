import { ApiProperty } from '@nestjs/swagger';

export class ValidationErrorDto {
  @ApiProperty({ description: 'HTTP status code', example: 400 })
  statusCode: number;

  @ApiProperty({ description: 'Error message' })
  message: string;

  @ApiProperty({
    description: 'List of validation errors',
    type: [String],
    example: [
      'Row 2: Missing data in column "phone"',
      'First column must be named "phone"',
    ],
  })
  errors?: string[];

  @ApiProperty({ description: 'Error type', example: 'VALIDATION_ERROR' })
  error: string;
}
