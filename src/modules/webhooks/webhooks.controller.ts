import {
  Controller,
  Post,
  Body,
  Headers,
  HttpStatus,
  HttpException,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';
import { WebhookResponseDto } from './dto/webhook-response.dto';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  async receiveWebhook(
    @Body() webhookPayload: any, // Recibir el payload de ElevenLabs
    @Headers('elevenlabs-signature') signature?: string,
    @Headers('user-agent') userAgent?: string,
    @Req() req?: RawBodyRequest<Request>,
  ): Promise<WebhookResponseDto> {
    try {
      const rawBody = req?.rawBody?.toString();

      const result = await this.webhooksService.processElevenLabsWebhook(
        webhookPayload,
        signature,
        userAgent,
        rawBody,
      );

      return result;
    } catch (error) {
      this.logger.error(`Webhook controller error`, {
        error: error.message,
        userAgent,
      });

      if (error.message === 'UNAUTHORIZED') {
        throw new HttpException(
          'Invalid webhook signature',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error processing ElevenLabs webhook',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
