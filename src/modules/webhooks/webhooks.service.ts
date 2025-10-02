import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WebhookResponseDto } from './dto/webhook-response.dto';
import {
  ConvaiWebhookData,
  ProcessedConversationData,
} from './dto/convai-webhook.dto';
import { IDatabaseService } from 'src/shared/interfaces/i-database-service.interface';
import { ConversationsService } from '../conversations/conversations.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @Inject('REGISTROS_LLAMADAS_REPOSITORY')
    private readonly registrosLlamadasRepository: IDatabaseService<ProcessedConversationData>,
    private readonly conversationsService: ConversationsService,
    private readonly configService: ConfigService,
  ) {}

  async processElevenLabsWebhook(
    webhookPayload: any,
    signature?: string,
    userAgent?: string,
    rawBody?: string,
  ): Promise<WebhookResponseDto> {
    const eventId = this.generateEventId();
    const webhookData = webhookPayload.body || webhookPayload;

    try {
      this.logger.log('Processing ElevenLabs webhook', {
        eventId,
        conversationId: webhookData.data?.conversation_id,
        agentId: webhookData.data?.agent_id,
        status: webhookData.data?.status,
        hasSignature: !!signature,
      });

      if (userAgent && !userAgent.includes('ElevenLabs')) {
        this.logger.warn('Webhook from non-ElevenLabs source detected', {
          eventId,
          userAgent,
          conversationId: webhookData.data?.conversation_id,
        });
      }

      const webhookSecret = this.configService.get<string>(
        'elevenLabsWebhookSecret',
      );
      if (signature && webhookSecret && rawBody) {
        const isValidSignature = await this.validateElevenLabsSignature(
          rawBody,
          signature,
          webhookSecret,
        );

        if (!isValidSignature) {
          this.logger.warn('Invalid webhook signature', {
            eventId,
            conversationId: webhookData.data?.conversation_id,
          });
          throw new Error('Invalid webhook signature');
        }
      } else if (signature && !webhookSecret) {
        this.logger.warn(
          'Webhook signature received but secret not configured',
          { eventId },
        );
      }

      if (!webhookData.data || !webhookData.data.conversation_id) {
        this.logger.warn('Invalid webhook payload structure', { eventId });
        return new WebhookResponseDto(
          false,
          'Invalid webhook payload structure',
          eventId,
        );
      }

      await this.processPostCallTranscription(webhookData, eventId);

      this.logger.log('ElevenLabs webhook processed successfully', {
        eventId,
        conversationId: webhookData.data.conversation_id,
      });

      return new WebhookResponseDto(
        true,
        'Post call transcription processed successfully',
        eventId,
      );
    } catch (error) {
      this.logger.error('ElevenLabs webhook processing failed', {
        eventId,
        conversationId: webhookData.data?.conversation_id,
        error: error.message,
      });

      if (error.message === 'Invalid webhook signature') {
        throw new Error('UNAUTHORIZED');
      }

      throw error;
    }
  }

  private async processPostCallTranscription(
    webhookData: ConvaiWebhookData,
    eventId: string,
  ): Promise<void> {
    const { data } = webhookData;

    this.logger.log('Processing post call transcription', {
      eventId,
      conversationId: data.conversation_id,
      agentId: data.agent_id,
      callDuration: data.metadata?.call_duration_secs,
      status: data.status,
    });

    // Mapear la información según la nueva estructura de ElevenLabs
    const processedData: ProcessedConversationData = {
      conversation_id: data.conversation_id,
      agent_id: data.agent_id,
      status: data.status,

      call_duration_secs: data.metadata?.call_duration_secs || 0,
      llm_usage: this.cleanUndefinedValues(data.metadata?.llm_usage) || null,
      llm_price: data.metadata?.llm_price || 0,
      llm_charge: data.metadata?.llm_charge || 0,
      call_charge: data.metadata?.call_charge || 0,
      termination_reason: data.metadata?.termination_reason || 'unknown',
      main_language: data.metadata?.main_language || 'es',
      multivoice: this.cleanUndefinedValues(data.metadata?.multivoice) || {
        enabled: false,
        used: false,
      },
      batch_call: this.cleanUndefinedValues(data.metadata?.batch_call) || {
        batch_call_id: null,
        batch_call_recipient_id: null,
      },

      dynamic_variables:
        this.cleanUndefinedValues(
          data.conversation_initiation_client_data?.dynamic_variables,
        ) || {},

      analysis: this.cleanUndefinedValues(data.analysis) || {},

      processed_at: new Date().toISOString(),
      event_timestamp: webhookData.event_timestamp,
    };

    await this.saveConversationData(processedData, eventId);

    await this.processAudioAsync(data.conversation_id, eventId);
  }

  private async saveConversationData(
    data: ProcessedConversationData,
    eventId: string,
  ): Promise<void> {
    try {
      const documentId = data.conversation_id;

      this.logger.debug('Saving conversation data', {
        eventId,
        conversationId: data.conversation_id,
        agentId: data.agent_id,
      });

      await this.registrosLlamadasRepository.createOrReplace(documentId, data);

      this.logger.log('Conversation data saved successfully', {
        eventId,
        conversationId: data.conversation_id,
      });
    } catch (error) {
      this.logger.error('Failed to save conversation data', {
        eventId,
        conversationId: data.conversation_id,
        error: error.message,
      });
      throw error;
    }
  }

  private async processAudioAsync(
    conversationId: string,
    eventId: string,
  ): Promise<void> {
    try {
      await this.conversationsService.saveConversationAudio(conversationId);
      this.logger.log('Audio processed successfully', {
        eventId,
        conversationId,
      });
    } catch (error) {
      this.logger.warn('Audio processing failed', {
        eventId,
        conversationId,
        error: error.message,
      });
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private async validateElevenLabsSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    try {
      if (!signature.includes('t=') || !signature.includes('v0=')) {
        this.logger.warn('Invalid signature format received');
        return false;
      }

      const sigParts = signature.split(',');
      const timestampPart = sigParts.find((part) => part.startsWith('t='));
      const hashPart = sigParts.find((part) => part.startsWith('v0='));

      if (!timestampPart || !hashPart) {
        return false;
      }

      const timestamp = timestampPart.slice(2);
      const receivedHash = hashPart.slice(3);
      const signedPayload = timestamp + '.' + payload;

      const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedHash, 'hex'),
        Buffer.from(receivedHash, 'hex'),
      );
    } catch (error) {
      this.logger.error('Signature validation error', { error: error.message });
      return false;
    }
  }

  private cleanUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.cleanUndefinedValues(item));
    }

    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = this.cleanUndefinedValues(value);
      }
    }

    return cleaned;
  }
}
