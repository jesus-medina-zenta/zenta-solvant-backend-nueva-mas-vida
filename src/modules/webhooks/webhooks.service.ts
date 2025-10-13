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
import { RegistroSftp } from 'src/shared/entities/registro-sftp.entity';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @Inject('REGISTROS_LLAMADAS_REPOSITORY')
    private readonly registrosLlamadasRepository: IDatabaseService<ProcessedConversationData>,
    @Inject('REGISTROS_SFTP_REPOSITORY')
    private readonly registrosSftpRepository: IDatabaseService<RegistroSftp>,
    private readonly conversationsService: ConversationsService,
    private readonly configService: ConfigService,
  ) {}

  async processElevenLabsWebhook(
    webhookPayload: any,
    signature?: string,
    userAgent?: string,
    rawBody?: string,
  ): Promise<WebhookResponseDto> {
    const webhookData = webhookPayload.body || webhookPayload;

    try {
      this.logger.log('Processing ElevenLabs webhook', {
        conversationId: webhookData.data?.conversation_id,
        agentId: webhookData.data?.agent_id,
        status: webhookData.data?.status,
        hasSignature: !!signature,
      });

      if (userAgent && !userAgent.includes('ElevenLabs')) {
        this.logger.warn('Webhook from non-ElevenLabs source detected', {
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
            conversationId: webhookData.data?.conversation_id,
          });
          throw new Error('Invalid webhook signature');
        }
      } else if (signature && !webhookSecret) {
        this.logger.warn(
          'Webhook signature received but secret not configured',
        );
      }

      if (!webhookData.data || !webhookData.data.conversation_id) {
        this.logger.warn('Invalid webhook payload structure');
        return new WebhookResponseDto(
          false,
          'Invalid webhook payload structure',
        );
      }

      await this.processPostCallTranscription(webhookData);

      this.logger.log('ElevenLabs webhook processed successfully', {
        conversationId: webhookData.data.conversation_id,
      });

      return new WebhookResponseDto(
        true,
        'Post call transcription processed successfully',
      );
    } catch (error) {
      this.logger.error('ElevenLabs webhook processing failed', {
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
  ): Promise<void> {
    const { data } = webhookData;

    this.logger.log('Processing post call transcription', {
      conversationId: data.conversation_id,
      agentId: data.agent_id,
      callDuration: data.metadata?.call_duration_secs,
      status: data.status,
    });

    // Extraer variables dinámicas y track_id
    const dynamicVariables =
      this.cleanUndefinedValues(
        data.conversation_initiation_client_data?.dynamic_variables,
      ) ?? {};

    const trackId = dynamicVariables.track_id ?? null;

    this.logger.log('Extracted track_id from dynamic variables', {
      conversationId: data.conversation_id,
      trackId,
      hasDynamicVariables: Object.keys(dynamicVariables).length > 0,
    });

    // Mapear la información según la nueva estructura de ElevenLabs
    const processedData: ProcessedConversationData = {
      conversation_id: data.conversation_id,
      agent_id: data.agent_id,
      status: data.status,

      call_duration_secs: data.metadata?.call_duration_secs ?? 0,
      llm_usage: this.cleanUndefinedValues(data.metadata?.llm_usage) ?? null,
      llm_price: data.metadata?.llm_price ?? 0,
      llm_charge: data.metadata?.llm_charge ?? 0,
      call_charge: data.metadata?.call_charge ?? 0,
      termination_reason: data.metadata?.termination_reason ?? 'unknown',
      main_language: data.metadata?.main_language ?? 'es',
      multivoice: this.cleanUndefinedValues(data.metadata?.multivoice) ?? {
        enabled: false,
        used: false,
      },
      batch_call: this.cleanUndefinedValues(data.metadata?.batch_call) ?? {
        batch_call_id: null,
        batch_call_recipient_id: null,
      },

      track_id: trackId,
      dynamic_variables: dynamicVariables,

      analysis: this.cleanUndefinedValues(data.analysis) ?? {},

      processed_at: new Date().toISOString(),
      event_timestamp: webhookData.event_timestamp,
    };

    await this.saveConversationData(processedData);

    // No guardar el audio si el final_call_outcome es "NC"
    const finalCallOutcome =
      data.analysis?.data_collection_results?.final_call_outcome?.json_schema
        ?.value ?? null;

    if (finalCallOutcome === 'NC') {
      this.logger.log('Audio processing skipped - final call outcome is NC', {
        conversationId: data.conversation_id,
        finalCallOutcome,
      });
    } else {
      await this.processAudioAsync(
        data.conversation_id,
        trackId,
        data.agent_id,
      );
    }

    if (trackId) {
      await this.updateTrackStatus(trackId, 'registered_call');
    }
  }

  private async saveConversationData(
    data: ProcessedConversationData,
  ): Promise<void> {
    try {
      const documentId = data.conversation_id;

      this.logger.debug('Saving conversation data', {
        conversationId: data.conversation_id,
        agentId: data.agent_id,
      });

      await this.registrosLlamadasRepository.createOrReplace(documentId, data);

      this.logger.log('Conversation data saved successfully', {
        conversationId: data.conversation_id,
      });
    } catch (error) {
      this.logger.error('Failed to save conversation data', {
        conversationId: data.conversation_id,
        error: error.message,
      });
      throw error;
    }
  }

  private async processAudioAsync(
    conversationId: string,
    trackId?: string,
    agentId?: string,
  ): Promise<void> {
    try {
      await this.conversationsService.saveConversationAudio(
        conversationId,
        trackId,
        agentId,
      );
      this.logger.log('Audio processed successfully', {
        conversationId,
      });
    } catch (error) {
      this.logger.warn('Audio processing failed', {
        conversationId,
        error: error.message,
      });
    }
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

  private async updateTrackStatus(
    trackId: string,
    newStatus: string,
  ): Promise<void> {
    try {
      this.logger.log('Updating track status by searching for track_id field', {
        trackId,
        newStatus,
      });

      // Buscar por el campo track_id usando getByField
      const existingRecord = await this.registrosSftpRepository.getByField(
        'track_id',
        trackId,
      );

      if (!existingRecord) {
        this.logger.warn('No SFTP record found for track_id', {
          trackId,
        });
        return;
      }

      // Solo actualizar el campo track_status, no todo el objeto
      const updateData = {
        track_status: newStatus,
      };

      // Usar el ID real del documento para la actualización
      await this.registrosSftpRepository.update(existingRecord.id, updateData);

      this.logger.log('Track status updated successfully', {
        trackId,
        newStatus,
        documentId: existingRecord.id,
      });
    } catch (error) {
      this.logger.error('Failed to update track status', {
        trackId,
        newStatus,
        error: error.message,
      });
    }
  }
}
