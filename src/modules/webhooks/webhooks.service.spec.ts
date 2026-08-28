import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WebhooksService } from './webhooks.service';
import { ConversationsService } from '../conversations/conversations.service';
import { GcpPipelineService } from 'src/shared/services/gcp-pipeline.service';
import { DocumentConflictException } from 'src/shared/exceptions/database-exceptions';
import { renderPaymentLinkEmailHtml } from './templates/payment-link-email.template';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebhooksService', () => {
  let service: WebhooksService;
  let registrosLlamadasRepository: {
    createOrReplace: jest.Mock;
    getAllByField: jest.Mock;
  };
  let registrosSftpRepository: { getByField: jest.Mock; update: jest.Mock };
  let externalApiService: { get: jest.Mock };
  let batchExportsRepository: { create: jest.Mock };
  let gcpPipelineService: { triggerPipelineAfterAction: jest.Mock };
  let conversationsService: { saveConversationAudio: jest.Mock };
  let configService: { get: jest.Mock };

  const buildWebhookData = (overrides: any = {}) => {
    const dataCollectionResults = {
      final_call_outcome: { value: 'PP' },
      ...(overrides.dataCollectionResultsOverrides ?? {}),
    };

    return {
      event_timestamp: 1700000000,
      data: {
        agent_id: 'agent-1',
        conversation_id: overrides.conversationId ?? 'conv-1',
        status: 'done',
        metadata: {
          call_duration_secs: 30,
          llm_usage: { model_usage: {} },
          llm_price: 0,
          llm_charge: 0,
          call_charge: 0,
          termination_reason: 'end_call',
          main_language: 'es',
          multivoice: { enabled: false, used: false },
          batch_call: overrides.batchCallId
            ? {
                batch_call_id: overrides.batchCallId,
                batch_call_recipient_id: 'recipient-1',
              }
            : { batch_call_id: null, batch_call_recipient_id: null },
        },
        analysis: {
          data_collection_results: dataCollectionResults,
        },
        conversation_initiation_client_data: {
          conversation_config_override: { tts: { voice_id: null } },
          dynamic_variables: { track_id: overrides.trackId ?? null },
        },
      },
    };
  };

  beforeEach(async () => {
    registrosLlamadasRepository = {
      createOrReplace: jest.fn().mockResolvedValue(undefined),
      getAllByField: jest.fn().mockResolvedValue([]),
    };
    registrosSftpRepository = {
      getByField: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
    };
    externalApiService = {
      get: jest.fn().mockResolvedValue({ total_calls_scheduled: 0 }),
    };
    batchExportsRepository = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    gcpPipelineService = {
      triggerPipelineAfterAction: jest.fn().mockResolvedValue(undefined),
    };
    conversationsService = {
      saveConversationAudio: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, any> = {
          elevenLabsWebhookSecret: undefined,
          gcpPipelineNameWriting: 'zenta-solvant-pipe-writing-dev',
          sendgridApiKey: 'test-sendgrid-api-key',
          sendgridFromEmail: 'no-reply@isapre-nueva-masvida.cl',
        };
        return map[key];
      }),
    };

    mockedAxios.post.mockReset().mockResolvedValue({ data: {} });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: 'REGISTROS_LLAMADAS_REPOSITORY',
          useValue: registrosLlamadasRepository,
        },
        {
          provide: 'REGISTROS_SFTP_REPOSITORY',
          useValue: registrosSftpRepository,
        },
        { provide: 'EXTERNAL_API_SERVICE', useValue: externalApiService },
        {
          provide: 'BATCH_CALL_EXPORTS_REPOSITORY',
          useValue: batchExportsRepository,
        },
        {
          provide: GcpPipelineService,
          useValue: gcpPipelineService,
        },
        {
          provide: ConversationsService,
          useValue: conversationsService,
        },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('extracción de fecha_compromiso / agendar_llamada (R5, R6, R7)', () => {
    it('persiste fecha_compromiso y agendar_llamada cuando están presentes en el payload', async () => {
      const webhookData = buildWebhookData({
        dataCollectionResultsOverrides: {
          fecha_compromiso: { value: '2026-09-01' },
          agendar_llamada: { value: 'true' },
        },
      });

      await service.processElevenLabsWebhook(webhookData);

      expect(registrosLlamadasRepository.createOrReplace).toHaveBeenCalledWith(
        'conv-1',
        expect.objectContaining({
          fecha_compromiso: '2026-09-01',
          agendar_llamada: 'true',
        }),
      );
    });

    it('persiste null cuando fecha_compromiso y agendar_llamada no están presentes en el payload', async () => {
      const webhookData = buildWebhookData();

      await service.processElevenLabsWebhook(webhookData);

      expect(registrosLlamadasRepository.createOrReplace).toHaveBeenCalledWith(
        'conv-1',
        expect.objectContaining({
          fecha_compromiso: null,
          agendar_llamada: null,
        }),
      );
    });

    it('no lanza excepción si data_collection_results no existe', async () => {
      const webhookData: any = buildWebhookData();
      delete webhookData.data.analysis.data_collection_results;

      await expect(
        service.processElevenLabsWebhook(webhookData),
      ).resolves.not.toThrow();

      expect(registrosLlamadasRepository.createOrReplace).toHaveBeenCalledWith(
        'conv-1',
        expect.objectContaining({
          fecha_compromiso: null,
          agendar_llamada: null,
        }),
      );
    });
  });

  describe('detección de fin de batch (R1, R2, R3, R4, R14)', () => {
    it('no dispara la generación del CSV cuando las conversaciones registradas son menos que las programadas', async () => {
      externalApiService.get.mockResolvedValue({ total_calls_scheduled: 5 });
      registrosLlamadasRepository.getAllByField.mockResolvedValue(
        new Array(3).fill({}),
      );

      const webhookData = buildWebhookData({ batchCallId: 'batch-1' });
      await service.processElevenLabsWebhook(webhookData);

      expect(batchExportsRepository.create).not.toHaveBeenCalled();
      expect(gcpPipelineService.triggerPipelineAfterAction).not.toHaveBeenCalled();
    });

    it('dispara la generación del CSV exactamente una vez cuando las conversaciones registradas alcanzan el total programado', async () => {
      externalApiService.get.mockResolvedValue({ total_calls_scheduled: 3 });
      registrosLlamadasRepository.getAllByField.mockResolvedValue(
        new Array(3).fill({}),
      );

      const webhookData = buildWebhookData({ batchCallId: 'batch-1' });
      await service.processElevenLabsWebhook(webhookData);

      expect(batchExportsRepository.create).toHaveBeenCalledTimes(1);
      expect(batchExportsRepository.create).toHaveBeenCalledWith(
        'batch-1',
        expect.objectContaining({
          batch_call_id: 'batch-1',
          total_calls_scheduled: 3,
          total_calls_registered: 3,
        }),
      );
      expect(gcpPipelineService.triggerPipelineAfterAction).toHaveBeenCalledTimes(
        1,
      );
      expect(gcpPipelineService.triggerPipelineAfterAction).toHaveBeenCalledWith(
        'batch_call_completed',
        'batch-1',
        'zenta-solvant-pipe-writing-dev',
      );
    });

    it('es idempotente: si ya se disparó (DocumentConflictException) no vuelve a invocar el pipeline', async () => {
      externalApiService.get.mockResolvedValue({ total_calls_scheduled: 3 });
      registrosLlamadasRepository.getAllByField.mockResolvedValue(
        new Array(3).fill({}),
      );
      batchExportsRepository.create.mockRejectedValue(
        new DocumentConflictException('batch-1'),
      );

      const webhookData = buildWebhookData({ batchCallId: 'batch-1' });

      await expect(
        service.processElevenLabsWebhook(webhookData),
      ).resolves.not.toThrow();

      expect(gcpPipelineService.triggerPipelineAfterAction).not.toHaveBeenCalled();
    });
  });

  describe('sendPaymentLinkEmail — plantilla HTML', () => {
    const buildPaymentLinkWebhookData = (overrides: any = {}) => {
      const dynamicVariables: Record<string, any> = {
        email_destinatario: overrides.email ?? 'deudor@example.com',
        url_link: overrides.paymentLink ?? 'https://pagos.example.com/abc123',
        nombre_deudor: overrides.recipientName ?? 'Juana Pérez',
        deuda_cotizaciones: overrides.debtAmount ?? '50.000',
      };

      if (overrides.omitDebtAmount) {
        delete dynamicVariables.deuda_cotizaciones;
      }

      return {
        data: {
          conversation_id: overrides.conversationId ?? 'conv-payment-1',
          conversation_initiation_client_data: {
            dynamic_variables: dynamicVariables,
          },
        },
      };
    };

    it('envía el HTML de SendGrid proveniente de la plantilla, con recipientName, debtAmount y paymentLink interpolados', async () => {
      const webhookData = buildPaymentLinkWebhookData({
        recipientName: 'Juana Pérez',
        paymentLink: 'https://pagos.example.com/abc123',
        debtAmount: '50.000',
      });

      await service.processPaymentLinkWebhook(webhookData);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [url, payload] = mockedAxios.post.mock.calls[0] as [
        string,
        any,
      ];
      expect(url).toBe('https://api.sendgrid.com/v3/mail/send');

      const htmlContent = payload.content.find(
        (part: any) => part.type === 'text/html',
      );
      const textContent = payload.content.find(
        (part: any) => part.type === 'text/plain',
      );

      expect(htmlContent.value).toBe(
        renderPaymentLinkEmailHtml(
          'Juana Pérez',
          'https://pagos.example.com/abc123',
          '50.000',
        ),
      );
      expect(htmlContent.value).toContain('Juana Pérez');
      expect(htmlContent.value).toContain(
        'https://pagos.example.com/abc123',
      );
      expect(htmlContent.value).toContain('50.000');
      expect(htmlContent.value).not.toContain('{{recipientName}}');
      expect(htmlContent.value).not.toContain('{{paymentLink}}');
      expect(htmlContent.value).not.toContain('{{debtAmount}}');

      // El part text/plain se sigue enviando igual que hoy.
      expect(textContent.value).toContain('Juana Pérez');
      expect(textContent.value).toContain(
        'https://pagos.example.com/abc123',
      );
      expect(textContent.value).toContain('50.000');

      expect(payload.personalizations[0].subject).toBe(
        'Regulariza tu pago - Isapre Nueva Masvida',
      );
      expect(payload.from.name).toBe('Isapre Nueva Masvida');
    });

    it('rechaza el envío cuando falta deuda_cotizaciones en dynamic_variables', async () => {
      const webhookData = buildPaymentLinkWebhookData({
        recipientName: 'Juana Pérez',
        paymentLink: 'https://pagos.example.com/abc123',
        omitDebtAmount: true,
      });

      await expect(
        service.processPaymentLinkWebhook(webhookData),
      ).rejects.toThrow(
        'Missing required dynamic variable: deuda_cotizaciones',
      );

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('rechaza el envío cuando deuda_cotizaciones es whitespace', async () => {
      const webhookData = buildPaymentLinkWebhookData({
        recipientName: 'Juana Pérez',
        paymentLink: 'https://pagos.example.com/abc123',
        debtAmount: '   ',
      });

      await expect(
        service.processPaymentLinkWebhook(webhookData),
      ).rejects.toThrow(
        'Missing required dynamic variable: deuda_cotizaciones',
      );

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('escapa recipientName con markup/script inyectado (payload 1 de QA) sin romper el envío', async () => {
      const maliciousName = '<script>alert(1)</script><b>Juan</b>';
      const webhookData = buildPaymentLinkWebhookData({
        recipientName: maliciousName,
        paymentLink: 'https://pagos.example.com/abc123',
      });

      await service.processPaymentLinkWebhook(webhookData);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [, payload] = mockedAxios.post.mock.calls[0] as [string, any];
      const htmlContent = payload.content.find(
        (part: any) => part.type === 'text/html',
      );

      expect(htmlContent.value).not.toContain('<script>');
      expect(htmlContent.value).not.toContain('<b>Juan</b>');
      expect(htmlContent.value).toContain(
        '&lt;script&gt;alert(1)&lt;/script&gt;&lt;b&gt;Juan&lt;/b&gt;',
      );
    });

    it('rechaza paymentLink que rompe el atributo href e inyecta <script> (payload 2 de QA)', async () => {
      const maliciousLink = '"><script>alert(2)</script>';
      const webhookData = buildPaymentLinkWebhookData({
        recipientName: 'Juana Pérez',
        paymentLink: maliciousLink,
      });

      await expect(
        service.processPaymentLinkWebhook(webhookData),
      ).rejects.toThrow('Invalid payment link: must be a well-formed https:// URL');

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('rechaza paymentLink con esquema http:// (no https)', async () => {
      const webhookData = buildPaymentLinkWebhookData({
        recipientName: 'Juana Pérez',
        paymentLink: 'http://pagos.example.com/abc',
      });

      await expect(
        service.processPaymentLinkWebhook(webhookData),
      ).rejects.toThrow('Invalid payment link: must be a well-formed https:// URL');

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('mantiene un querystring legítimo con "&" escapado como &amp; sin romper el HTML', async () => {
      const webhookData = buildPaymentLinkWebhookData({
        recipientName: 'Juana Pérez',
        paymentLink: 'https://pagos.example.com/abc123?ref=1&foo=2',
      });

      await service.processPaymentLinkWebhook(webhookData);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [, payload] = mockedAxios.post.mock.calls[0] as [string, any];
      const htmlContent = payload.content.find(
        (part: any) => part.type === 'text/html',
      );

      expect(htmlContent.value).toContain(
        'https://pagos.example.com/abc123?ref=1&amp;foo=2',
      );
      expect(htmlContent.value).not.toContain('ref=1&foo=2');
    });
  });
});
