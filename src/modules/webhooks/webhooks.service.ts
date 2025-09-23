import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  /**
   * Procesa webhooks de ElevenLabs validando firma HMAC, extrayendo datos de transcripción
   * y persistiendo en Firestore con almacenamiento de audio en GCS.
   *
   * @param webhookPayload - Payload del webhook de ElevenLabs
   * @param signature - Firma HMAC-SHA256 para validación
   * @param userAgent - User-Agent para validación de origen
   * @param rawBody - Cuerpo crudo para validación de firma
   * @returns Respuesta del procesamiento
   */
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

      // Validar origen si se proporciona user-agent
      if (userAgent && !userAgent.includes('ElevenLabs')) {
        this.logger.warn('Webhook from non-ElevenLabs source detected', {
          eventId,
          userAgent,
          conversationId: webhookData.data?.conversation_id,
        });
      }

      // Validar firma HMAC
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

      // Procesar solo eventos post_call_transcription
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

  /**
   * Procesa eventos de transcripción post-llamada transformando datos,
   * persistiendo en Firestore y almacenando audio en GCS.
   */
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

      // Metadata específicos - limpiar undefined values
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

      // Todas las variables dinámicas
      dynamic_variables:
        this.cleanUndefinedValues(
          data.conversation_initiation_client_data?.dynamic_variables,
        ) || {},

      // Todo el análisis
      analysis: this.cleanUndefinedValues(data.analysis) || {},

      // Metadatos de procesamiento
      processed_at: new Date().toISOString(),
      event_timestamp: webhookData.event_timestamp,
    };

    // Guardar en Firestore
    await this.saveConversationData(processedData, eventId);

    // Procesar audio de forma asíncrona para no bloquear la respuesta
    this.processAudioAsync(data.conversation_id, eventId);
  }

  /**
   * Persiste los datos procesados de conversación en Firestore usando el
   * conversation_id como clave de documento. Implementa estrategia de
   * upsert para manejar actualizaciones y nuevos registros.
   *
   * @param data - Datos procesados de la conversación para persistir
   * @param eventId - Identificador del evento para logging y trazabilidad
   * @private
   */
  private async saveConversationData(
    data: ProcessedConversationData,
    eventId: string,
  ): Promise<void> {
    try {
      // Guardar en colección 'registros_llamadas'
      // Índices principales:
      // 1. conversation_id (document ID)
      // 2. agent_id
      // 3. dynamic_variables.id_carga
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

  /**
   * Procesa el audio de la conversación de forma asíncrona para no bloquear
   * la respuesta del webhook. Maneja errores de forma independiente.
   */
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

  /**
   * Genera un identificador único para eventos de webhook utilizando
   * timestamp Unix y sufijo aleatorio. Formato: evt_{timestamp}_{random}.
   *
   * @returns Identificador único del evento
   * @private
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Valida la autenticidad de webhooks de ElevenLabs mediante verificación de firma HMAC-SHA256.
   * Implementa el formato específico de ElevenLabs: "t=timestamp,v0=hash".
   * Implementa comparación timing-safe para prevenir ataques de timing.
   *
   * @param payload - Cuerpo del request a validar
   * @param signature - Firma HMAC recibida en el header 'elevenlabs-signature'
   * @param secret - Secreto compartido para validación HMAC
   * @returns true si la firma es válida, false en caso contrario
   * @private
   */
  private async validateElevenLabsSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    try {
      const crypto = require('crypto');

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

  /**
   * Limpia recursivamente todos los valores undefined de un objeto para
   * cumplir con las restricciones de Firestore. Preserva null explícitos
   * y maneja arrays y objetos anidados de forma recursiva.
   *
   * @param obj - Objeto a limpiar de valores undefined
   * @returns Objeto limpio sin valores undefined
   * @private
   */
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
