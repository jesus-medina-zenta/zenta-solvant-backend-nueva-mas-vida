import {
  Controller,
  Post,
  Headers,
  HttpStatus,
  HttpException,
  Logger,
  Req,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBody,
  ApiTags,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { WebhookResponseDto } from './dto/webhook-response.dto';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({
    summary: 'Process ElevenLabs webhook',
    description:
      'Processes ElevenLabs post-call transcription webhooks and saves conversation data',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: WebhookResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid payload structure.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid webhook signature.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions.',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Processing failed.',
  })
  @ApiHeader({
    name: 'elevenlabs-signature',
    required: false,
    description: 'ElevenLabs webhook signature for validation',
    example: 't=1234567890,v0=abcdef123456...',
  })
  @ApiHeader({
    name: 'user-agent',
    required: false,
    description: 'User agent header, should contain "ElevenLabs"',
    example: 'ElevenLabs-Webhook/1.0',
  })
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
      const errorMessage = this.getErrorMessage(error);
      this.logger.error('Webhook processing error', {
        error: errorMessage,
        hasUserAgent: !!userAgent,
      });

      if (errorMessage === 'UNAUTHORIZED') {
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

  @Post('elevenlabs/payment-link')
  @ApiOperation({
    summary: 'Process ElevenLabs webhook and send payment link email',
    description:
      'Receives ElevenLabs webhook payload, extracts dynamic variables and sends payment link via SendGrid',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed and email sent successfully',
    type: WebhookResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing email or payment link in payload.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid webhook signature.',
  })
  async receivePaymentLinkWebhook(
    @Req() req: any,
    @Headers('elevenlabs-signature') signature?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<WebhookResponseDto> {
    try {
      const webhookPayload = req.body;
      const rawBodyString = req.rawBody ? req.rawBody.toString('utf8') : null;

      this.logger.log(`Variables de elevenlabs: ${webhookPayload}`)
      return await this.webhooksService.processPaymentLinkWebhook(
        webhookPayload,
        signature,
        userAgent,
        rawBodyString,
      );
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error('Payment link webhook processing error', {
        error: errorMessage,
        hasUserAgent: !!userAgent,
      });

      if (errorMessage === 'UNAUTHORIZED') {
        throw new HttpException(
          'Unauthorized webhook request',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        errorMessage || 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
