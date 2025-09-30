import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class PrepareBatchCallingDto {
  @ApiProperty({ description: 'ID de la carga para buscar registros SFTP' })
  @IsNotEmpty()
  @IsString()
  carga_id: string;

  @ApiProperty({ description: 'ID del agente de ElevenLabs' })
  @IsNotEmpty()
  @IsString()
  agent_id: string;

  @ApiProperty({ description: 'ID del número de teléfono del agente' })
  @IsNotEmpty()
  @IsString()
  agent_phone_number_id: string;

  @ApiProperty({
    description: 'Nombre de la campaña de llamadas',
    example: 'Cobro atrasado Septiembre',
  })
  @IsNotEmpty()
  @IsString()
  call_name: string;

  @ApiProperty({
    description:
      'Timestamp Unix para programar las llamadas (opcional, por defecto ahora)',
    example: 1705363200,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  scheduled_time_unix?: number;
}
