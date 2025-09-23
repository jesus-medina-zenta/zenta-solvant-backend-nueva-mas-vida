import {
  Controller,
  Post,
  Headers,
  HttpStatus,
  HttpException,
  Logger,
  Req,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhookResponseDto } from './dto/webhook-response.dto';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  async receiveWebhook(
    @Req() req: any,
    @Headers('elevenlabs-signature') signature?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<WebhookResponseDto> {
    try {
      const webhookPayload = req.body;
      const rawBodyString = req.rawBody ? req.rawBody.toString('utf8') : null;

      return await this.webhooksService.processElevenLabsWebhook(
        webhookPayload,
        signature,
        userAgent,
        rawBodyString,
      );
    } catch (error) {
      this.logger.error('Webhook processing error', {
        error: error.message,
        hasUserAgent: !!userAgent,
      });

      if (error.message === 'UNAUTHORIZED') {
        throw new HttpException(
          'Unauthorized webhook request',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
