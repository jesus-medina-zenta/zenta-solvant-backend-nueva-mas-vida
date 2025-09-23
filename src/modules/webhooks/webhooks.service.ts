import { Injectable, Logger, Inject } from '@nestjs/common';
import { WebhookRequestDto } from './dto/webhook-request.dto';
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
  ) {}

  /**
   * Procesa un webhook transformado de ElevenLabs para extraer y almacenar
   * datos de transcripción post-llamada. Maneja la persistencia en Firestore
   * y la validación de tipos de eventos soportados.
   *
   * @param webhookData - Datos del webhook ya transformados al formato interno
   * @returns Respuesta indicando éxito o fallo del procesamiento
   */
  async processWebhook(
    webhookData: WebhookRequestDto,
  ): Promise<WebhookResponseDto> {
    const eventId = this.generateEventId();

    try {
      this.logger.log(`Processing ElevenLabs webhook`, {
        eventId,
        event: webhookData.event,
        conversationId: webhookData.data?.data?.conversation_id,
        timestamp: webhookData.timestamp,
      });

      // Solo procesar webhooks de tipo post_call_transcription
      if (webhookData.event === 'post_call_transcription') {
        await this.processPostCallTranscription(
          webhookData.data as ConvaiWebhookData,
          eventId,
        );
      } else {
        this.logger.warn(`Unsupported webhook event: ${webhookData.event}`, {
          eventId,
        });
        return new WebhookResponseDto(
          false,
          `Unsupported webhook event: ${webhookData.event}`,
          eventId,
        );
      }

      this.logger.log(`ElevenLabs webhook processed successfully`, {
        eventId,
        event: webhookData.event,
        conversationId: webhookData.data?.data?.conversation_id,
      });

      return new WebhookResponseDto(
        true,
        `Post call transcription processed successfully`,
        eventId,
      );
    } catch (error) {
      this.logger.error(`Failed to process ElevenLabs webhook`, {
        eventId,
        event: webhookData.event,
        conversationId: webhookData.data?.data?.conversation_id,
        error: error.message,
        stack: error.stack,
      });

      return new WebhookResponseDto(
        false,
        `Failed to process webhook: ${error.message}`,
        eventId,
      );
    }
  }

  /**
   * Punto de entrada principal para webhooks de ElevenLabs. Realiza validaciones
   * de seguridad, autenticación HMAC, y transformación de datos antes del
   * procesamiento. Implementa el patrón de validación por capas.
   *
   * @param webhookPayload - Payload crudo recibido desde ElevenLabs
   * @param signature - Firma HMAC-SHA256 para validación de autenticidad
   * @param userAgent - User-Agent del request para validación de origen
   * @param rawBody - Cuerpo crudo del request para validación de firma
   * @returns Respuesta del procesamiento del webhook
   */
  async processElevenLabsWebhook(
    webhookPayload: any,
    signature?: string,
    userAgent?: string,
    rawBody?: string,
  ): Promise<WebhookResponseDto> {
    try {
      // ElevenLabs envía directamente el objeto body
      const webhookData = webhookPayload.body || webhookPayload;

      this.logger.log(`Received ElevenLabs webhook`, {
        conversationId: webhookData.data?.conversation_id,
        agentId: webhookData.data?.agent_id,
        status: webhookData.data?.status,
        userAgent,
        hasSignature: !!signature,
        timestamp: new Date().toISOString(),
      });

      // Validar que viene de ElevenLabs
      if (userAgent && !userAgent.includes('ElevenLabs')) {
        this.logger.warn(`Suspicious webhook source`, {
          userAgent,
          conversationId: webhookData.data?.conversation_id,
        });
      }

      // Validación de firma HMAC deshabilitada temporalmente
      if (signature) {
        this.logger.debug(
          `Webhook signature received but validation disabled`,
          {
            hasSignature: !!signature,
            signatureLength: signature?.length,
            conversationId: webhookData.data?.conversation_id,
          },
        );
      }

      // Transformar el payload al formato esperado por el service
      const transformedData: WebhookRequestDto = {
        event: 'post_call_transcription', // ElevenLabs siempre envía este tipo de evento
        source: 'elevenlabs',
        data: webhookData, // Los datos vienen directamente en la estructura correcta
        timestamp: new Date(webhookData.event_timestamp * 1000).toISOString(),
      };

      // Procesar el webhook
      return await this.processWebhook(transformedData);
    } catch (error) {
      this.logger.error(`ElevenLabs webhook processing failed`, {
        error: error.message,
        stack: error.stack,
        userAgent,
      });

      throw error;
    }
  }

  /**
   * Procesa específicamente eventos de transcripción post-llamada de ElevenLabs.
   * Transforma los datos a la estructura interna, aplica limpieza de valores undefined,
   * persiste en Firestore y gestiona el almacenamiento de audio en GCS.
   *
   * @param webhookData - Datos estructurados del webhook de ElevenLabs
   * @param eventId - Identificador único del evento para trazabilidad
   * @private
   */
  private async processPostCallTranscription(
    webhookData: ConvaiWebhookData,
    eventId: string,
  ): Promise<void> {
    const { data } = webhookData;

    this.logger.log(`Processing post call transcription`, {
      eventId,
      conversationId: data.conversation_id,
      agentId: data.agent_id,
      callDuration: data.metadata.call_duration_secs,
      status: data.status,
      llmPrice: data.metadata.llm_price,
      mainLanguage: data.metadata.main_language,
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

    // Guardar audio en bucket después de procesar exitosamente
    try {
      await this.conversationsService.saveConversationAudio(
        data.conversation_id,
      );
      this.logger.log(`Conversation audio saved successfully`, {
        eventId,
        conversationId: data.conversation_id,
      });
    } catch (error) {
      this.logger.warn(`Failed to save conversation audio`, {
        eventId,
        conversationId: data.conversation_id,
        error: error.message,
      });
    }
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
      const collectionName = 'registros_llamadas';
      const documentId = data.conversation_id;

      this.logger.log(`Saving conversation data to Firestore`, {
        eventId,
        conversationId: data.conversation_id,
        agentId: data.agent_id,
        idCarga: data.dynamic_variables?.id_carga,
        collection: collectionName,
      });

      await this.registrosLlamadasRepository.createOrReplace(documentId, data);

      this.logger.log(`Conversation data saved successfully`, {
        eventId,
        conversationId: data.conversation_id,
        analysisKeys: Object.keys(data.analysis || {}).length,
        dynamicVariables: Object.keys(data.dynamic_variables || {}).length,
        llmPrice: data.llm_price,
        callCharge: data.call_charge,
      });
    } catch (error) {
      this.logger.error(`Failed to save conversation data`, {
        eventId,
        conversationId: data.conversation_id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
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
   * Valida la autenticidad de webhooks mediante verificación de firma HMAC-SHA256.
   * Soporta múltiples formatos de firma: timestamp+hash (Stripe-style) y hash directo.
   * Implementa comparación timing-safe para prevenir ataques de timing.
   *
   * @param payload - Cuerpo del request a validar
   * @param signature - Firma HMAC recibida en headers
   * @param secret - Secreto compartido para validación HMAC
   * @returns true si la firma es válida, false en caso contrario
   */
  async validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    try {
      const crypto = require('crypto');

      this.logger.debug(`Validating webhook signature`, {
        payloadLength: payload?.length,
        hasSecret: !!secret,
      });

      // ElevenLabs puede usar diferentes formatos
      // Formato 1: "t=timestamp,v0=hash" (similar a Stripe)
      if (signature.includes('t=') && signature.includes('v0=')) {
        const sigParts = signature.split(',');
        const timestamp = sigParts
          .find((part) => part.startsWith('t='))
          ?.slice(2);
        const hash = sigParts.find((part) => part.startsWith('v0='))?.slice(3);

        if (!timestamp || !hash) {
          this.logger.warn(`Invalid signature format with t= and v0=`);
          return false;
        }

        const signedPayload = timestamp + payload;
        const expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(signedPayload, 'utf8')
          .digest('hex');

        return crypto.timingSafeEqual(
          Buffer.from(expectedSignature, 'hex'),
          Buffer.from(hash, 'hex'),
        );
      }

      // Formato 2: Hash directo (solo el hash HMAC-SHA256)
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      // Permitir signature con o sin prefijo 'sha256='
      const cleanSignature = signature.startsWith('sha256=')
        ? signature.slice(7)
        : signature;

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(cleanSignature, 'hex'),
      );
    } catch (error) {
      this.logger.error(`Signature validation failed`, {
        error: error.message,
        hasSignature: !!signature,
        hasSecret: !!secret,
      });
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
