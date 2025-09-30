import { ApiProperty } from '@nestjs/swagger';
import {
  RegistroSftp,
  MetadataUser,
} from 'src/shared/entities/registro-sftp.entity';

export class RegistroSftpResponseDto {
  @ApiProperty({ description: 'Unique identifier of the record' })
  id: string;

  @ApiProperty({ description: 'Date of the record', example: '16092025' })
  fecha: string;

  @ApiProperty({ description: 'Primary phone number', example: '+56942278495' })
  phone_number: string;

  @ApiProperty({
    description: 'Secondary phone number',
    example: '+56956380843',
  })
  phone_number_2: string;

  @ApiProperty({ description: 'User metadata information' })
  metadata_user: MetadataUser;
}

export class BuscarRegistrosSftpResponseDto {
  @ApiProperty({ description: 'Array of SFTP records found' })
  registros: RegistroSftpResponseDto[];

  @ApiProperty({ description: 'Total number of records found' })
  total: number;

  @ApiProperty({ description: 'Search criteria used - carga ID' })
  carga_id: string;
}
