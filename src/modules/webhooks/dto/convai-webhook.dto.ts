export interface ConvaiWebhookData {
  event_timestamp: number;
  data: {
    agent_id: string;
    conversation_id: string;
    status: string;
    metadata: {
      call_duration_secs: number;
      llm_usage: {
        model_usage: Record<
          string,
          {
            input: {
              tokens: number;
              price: number;
            };
            output_total: {
              tokens: number;
              price: number;
            };
          }
        >;
      };
      llm_price: number;
      llm_charge: number;
      call_charge: number;
      termination_reason: string;
      main_language: string;
      multivoice: {
        enabled: boolean;
        used: boolean;
      };
      batch_call?: {
        batch_call_id: string | null;
        batch_call_recipient_id: string | null;
      };
    };
    analysis: Record<string, any>;
    conversation_initiation_client_data: {
      conversation_config_override: {
        tts: {
          voice_id: string | null;
        };
      };
      dynamic_variables: Record<string, any>;
    };
  };
}

export interface ProcessedConversationData {
  conversation_id: string;
  agent_id: string;
  status: string;

  // Metadata específicos
  call_duration_secs: number;
  llm_usage: {
    model_usage: Record<
      string,
      {
        input: {
          tokens: number;
          price: number;
        };
        output_total: {
          tokens: number;
          price: number;
        };
      }
    >;
  } | null;
  llm_price: number;
  llm_charge: number;
  call_charge: number;
  termination_reason: string;
  main_language: string;
  multivoice: {
    enabled: boolean;
    used: boolean;
  };
  batch_call: {
    batch_call_id: string | null;
    batch_call_recipient_id: string | null;
  } | null;

  // Track ID extraído de las variables dinámicas
  track_id: string | null;

  // Todas las variables dinámicas
  dynamic_variables: Record<string, any>;

  // Todo el análisis
  analysis: Record<string, any>;

  // Metadatos de procesamiento
  processed_at: string;
  event_timestamp: number;
}
