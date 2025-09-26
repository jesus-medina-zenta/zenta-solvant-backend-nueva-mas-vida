import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class WebhookRequestDto {
  @IsString()
  @IsNotEmpty()
  event: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;

  @IsString()
  @IsOptional()
  timestamp?: string;

  @IsString()
  @IsOptional()
  signature?: string;
}
