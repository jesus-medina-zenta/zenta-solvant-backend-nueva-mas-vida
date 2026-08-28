import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import { WebhookResponseDto } from './dto/webhook-response.dto';
import {
  ConvaiWebhookData,
  ProcessedConversationData,
} from './dto/convai-webhook.dto';
import { IDatabaseService } from 'src/shared/interfaces/i-database-service.interface';
import { ConversationsService } from '../conversations/conversations.service';
import { RegistroSftp } from 'src/shared/entities/registro-sftp.entity';
import { IIntegrationService } from 'src/shared/interfaces/i-integration-service.interface';
import { GcpPipelineService } from 'src/shared/services/gcp-pipeline.service';
import { BatchCallExport } from 'src/shared/entities/batch-call-export.entity';
import { DocumentConflictException } from 'src/shared/exceptions/database-exceptions';
import { renderPaymentLinkEmailHtml } from './templates/payment-link-email.template';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @Inject('REGISTROS_LLAMADAS_REPOSITORY')
    private readonly registrosLlamadasRepository: IDatabaseService<ProcessedConversationData>,
    @Inject('REGISTROS_SFTP_REPOSITORY')
    private readonly registrosSftpRepository: IDatabaseService<RegistroSftp>,
    @Inject('EXTERNAL_API_SERVICE')
    private readonly externalApiService: IIntegrationService<any>,
    @Inject('BATCH_CALL_EXPORTS_REPOSITORY')
    private readonly batchExportsRepository: IDatabaseService<BatchCallExport>,
    private readonly gcpPipelineService: GcpPipelineService,
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
      const errorMessage = this.getErrorMessage(error);
      this.logger.error('ElevenLabs webhook processing failed', {
        conversationId: webhookData.data?.conversation_id,
        error: errorMessage,
      });

      if (errorMessage === 'Invalid webhook signature') {
        throw new Error('UNAUTHORIZED');
      }

      throw error;
    }
  }

  async processPaymentLinkWebhook(
    webhookPayload: any,
    signature?: string,
    userAgent?: string,
    rawBody?: string,
  ): Promise<WebhookResponseDto> {
    const webhookData = webhookPayload.body || webhookPayload;
    const conversationId = this.extractConversationId(webhookData);

    try {
      this.logger.log('Processing payment link webhook', {
        conversationId,
        hasSignature: !!signature,
        payloadKeys: this.getObjectKeys(webhookData),
        dataKeys: this.getObjectKeys(webhookData?.data),
      });

      if (userAgent && !userAgent.includes('ElevenLabs')) {
        this.logger.warn('Webhook from non-ElevenLabs source detected', {
          userAgent,
          conversationId,
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
          this.logger.warn('Invalid payment-link webhook signature', {
            conversationId,
          });
          throw new Error('Invalid webhook signature');
        }
      }

      const dynamicVariables = this.extractDynamicVariables(webhookData);
      const nestedBodyVariables = this.cleanUndefinedValues(webhookData?.body);

      const recipientEmail =
        dynamicVariables.email_destinatario ||
        dynamicVariables.email ||
        nestedBodyVariables?.email_destinatario ||
        nestedBodyVariables?.email ||
        dynamicVariables.correo ||
        nestedBodyVariables?.correo ||
        null;
      const paymentLink =
        dynamicVariables.url_link ||
        dynamicVariables.link_pago ||
        dynamicVariables.link ||
        nestedBodyVariables?.url_link ||
        nestedBodyVariables?.link_pago ||
        nestedBodyVariables?.link ||
        dynamicVariables.payment_link ||
        dynamicVariables.paymentLink ||
        nestedBodyVariables?.payment_link ||
        nestedBodyVariables?.paymentLink ||
        null;
      const recipientName =
        dynamicVariables.nombre_deudor ||
        dynamicVariables.name ||
        dynamicVariables.nombre ||
        nestedBodyVariables?.nombre_deudor ||
        nestedBodyVariables?.name ||
        nestedBodyVariables?.nombre ||
        'cliente';
      const debtAmountRaw =
        dynamicVariables.deuda_cotizaciones ||
        nestedBodyVariables?.deuda_cotizaciones ||
        null;
      const debtAmount =
        typeof debtAmountRaw === 'string'
          ? debtAmountRaw.trim()
          : debtAmountRaw;

      this.logger.log('Resolved payment-link webhook variables', {
        conversationId,
        hasDynamicVariables: Object.keys(dynamicVariables).length > 0,
        dynamicVariableKeys: Object.keys(dynamicVariables),
        hasRecipientEmail: !!recipientEmail,
        hasPaymentLink: !!paymentLink,
        hasDebtAmount: !!debtAmount,
      });

      if (!recipientEmail || !paymentLink) {
        throw new Error(
          'Missing required dynamic variables: email_destinatario/email and url_link/link_pago/link',
        );
      }

      if (
        debtAmount === null ||
        debtAmount === undefined ||
        debtAmount === ''
      ) {
        throw new Error(
          'Missing required dynamic variable: deuda_cotizaciones',
        );
      }

      await this.sendPaymentLinkEmail(
        recipientEmail,
        recipientName,
        paymentLink,
        String(debtAmount),
      );

      this.logger.log('Payment link email sent successfully', {
        conversationId,
        recipientEmail,
      });

      return new WebhookResponseDto(
        true,
        'Payment link email sent successfully',
      );
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error('Payment-link webhook processing failed', {
        conversationId,
        error: errorMessage,
      });

      if (errorMessage === 'Invalid webhook signature') {
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

      fecha_compromiso:
        data.analysis?.data_collection_results?.fecha_compromiso?.value ??
        null,
      agendar_llamada:
        data.analysis?.data_collection_results?.agendar_llamada?.value ??
        null,

      processed_at: new Date().toISOString(),
      event_timestamp: webhookData.event_timestamp,
    };

    await this.saveConversationData(processedData);

    // Do not save audio if final_call_outcome is "NC"
    const finalCallOutcome =
      data.analysis?.data_collection_results?.final_call_outcome?.value ?? null;

    if (finalCallOutcome === 'NC') {
      this.logger.log(
        'Audio processing skipped - final call outcome is NC',
        {
          conversationId: processedData.conversation_id,
          finalCallOutcome,
          trackId,
          agentId: processedData.agent_id,
        }
      );
    } else {
      this.logger.log('Processing audio for conversation', {
        conversationId: processedData.conversation_id,
        finalCallOutcome,
        trackId,
        agentId: processedData.agent_id,
      });
      await this.processAudioAsync(
        data.conversation_id,
        trackId,
        data.agent_id,
      );
    }

    if (trackId) {
      await this.updateTrackStatus(trackId, 'registered_call');
    }

    const batchCallId = processedData.batch_call?.batch_call_id ?? null;
    if (batchCallId) {
      await this.checkAndTriggerBatchCompletion(batchCallId);
    }
  }

  private async checkAndTriggerBatchCompletion(
    batchCallId: string,
  ): Promise<void> {
    try {
      const bachcall = await this.externalApiService.get(
        `/convai/batch-calling/${batchCallId}`,
      );
      const totalCallsScheduled = bachcall?.total_calls_scheduled ?? 0;

      const registeredConversations =
        await this.registrosLlamadasRepository.getAllByField(
          'batch_call.batch_call_id',
          batchCallId,
        );
      const totalCallsRegistered = registeredConversations.length;

      this.logger.log('Checking batch call completion', {
        batchCallId,
        totalCallsScheduled,
        totalCallsRegistered,
      });

      if (
        totalCallsScheduled > 0 &&
        totalCallsRegistered >= totalCallsScheduled
      ) {
        try {
          await this.batchExportsRepository.create(batchCallId, {
            batch_call_id: batchCallId,
            total_calls_scheduled: totalCallsScheduled,
            total_calls_registered: totalCallsRegistered,
            triggered_at: new Date().toISOString(),
          });
        } catch (error) {
          if (error instanceof DocumentConflictException) {
            this.logger.log(
              'Batch call completion already triggered by another invocation',
              { batchCallId },
            );
            return;
          }
          this.logger.error('Failed to claim batch call export', {
            batchCallId,
            error: this.getErrorMessage(error),
          });
          return;
        }

        const gcpPipelineNameWriting = this.configService.get<string>(
          'gcpPipelineNameWriting',
        );
        await this.gcpPipelineService.triggerPipelineAfterAction(
          'batch_call_completed',
          batchCallId,
          gcpPipelineNameWriting,
        );

        this.logger.log('Triggered pipe-writing CSV export for batch call', {
          batchCallId,
        });
      }
    } catch (error) {
      this.logger.error('Failed to check batch call completion', {
        batchCallId,
        error: this.getErrorMessage(error),
      });
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
      const errorMessage = this.getErrorMessage(error);
      this.logger.error('Failed to save conversation data', {
        conversationId: data.conversation_id,
        error: errorMessage,
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
      const errorMessage = this.getErrorMessage(error);
      this.logger.warn('Audio processing failed', {
        conversationId,
        error: errorMessage,
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
      this.logger.error('Signature validation error', {
        error: this.getErrorMessage(error),
      });
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

  private extractConversationId(webhookData: any): string | undefined {
    return (
      webhookData?.data?.conversation_id ||
      webhookData?.conversation_id ||
      webhookData?.event?.conversation_id ||
      undefined
    );
  }

  private extractDynamicVariables(webhookData: any): Record<string, any> {
    const candidates = [
      webhookData?.data?.conversation_initiation_client_data?.dynamic_variables,
      webhookData?.conversation_initiation_client_data?.dynamic_variables,
      webhookData?.data?.dynamic_variables,
      webhookData?.dynamic_variables,
      webhookData?.body?.dynamic_variables,
      webhookData?.body,
      webhookData?.payload?.dynamic_variables,
      webhookData?.event?.dynamic_variables,
      webhookData,
    ];

    for (const candidate of candidates) {
      const cleaned = this.cleanUndefinedValues(candidate);
      if (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned)) {
        if (Object.keys(cleaned).length > 0) {
          return cleaned as Record<string, any>;
        }
      }
    }

    return {};
  }

  private getObjectKeys(value: unknown): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return [];
    }

    return Object.keys(value as Record<string, unknown>);
  }

  private async sendPaymentLinkEmail(
    to: string,
    recipientName: string,
    paymentLink: string,
    debtAmount: string,
  ): Promise<void> {
    const sendgridApiKey = this.configService.get<string>('sendgridApiKey');
    const fromEmail = this.configService.get<string>('sendgridFromEmail');

    if (!sendgridApiKey || !fromEmail) {
      throw new Error(
        'SendGrid is not configured. Missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL',
      );
    }

    let paymentUrl: URL;
    try {
      paymentUrl = new URL(paymentLink);
    } catch {
      throw new Error(
        'Invalid payment link: must be a well-formed https:// URL',
      );
    }
    if (paymentUrl.protocol !== 'https:') {
      throw new Error(
        'Invalid payment link: must be a well-formed https:// URL',
      );
    }

    const emailPayload = {
      personalizations: [
        {
          to: [{ email: to }],
          subject: 'Regulariza tu pago - Isapre Nueva Masvida',
        },
      ],
      from: { email: fromEmail, name: 'Isapre Nueva Masvida' },
      content: [
        {
          type: 'text/plain',
          value: `Hola ${recipientName},\n\nActualmente registras un saldo pendiente de $${debtAmount}.\n\nTe compartimos tu link de pago para regularizar tu cotización:\n${paymentLink}\n\nSaludos,\nIsapre Nueva Masvida`,
        },
        {
          type: 'text/html',
          value: renderPaymentLinkEmailHtml(
            recipientName,
            paymentUrl.href,
            debtAmount,
          ),
        },
      ],
    };

    await axios.post('https://api.sendgrid.com/v3/mail/send', emailPayload, {
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
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
      const errorMessage = this.getErrorMessage(error);
      this.logger.error('Failed to update track status', {
        trackId,
        newStatus,
        error: errorMessage,
      });
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
