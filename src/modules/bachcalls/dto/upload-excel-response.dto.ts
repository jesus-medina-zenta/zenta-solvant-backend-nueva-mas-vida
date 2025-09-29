import { ApiProperty } from '@nestjs/swagger';

export class UploadExcelResponseDto {
  @ApiProperty({ description: 'Unique identifier for the uploaded file' })
  uuid: string;

  @ApiProperty({ description: 'Success message with processing details' })
  message: string;

  @ApiProperty({
    description: 'Google Cloud Storage path of the processed CSV file',
  })
  file_path: string;

  @ApiProperty({ description: 'Processing status', example: 'pendiente' })
  status: string;
}
