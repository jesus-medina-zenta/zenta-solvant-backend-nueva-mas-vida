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
    };
    analysis: Record<string, any>; // Todas las variables que vengan dentro de analysis
    conversation_initiation_client_data: {
      conversation_config_override: {
        tts: {
          voice_id: string | null;
        };
      };
      dynamic_variables: Record<string, any>; // Todas las variables que vengan dentro de dynamic_variables
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

  // Todas las variables dinámicas
  dynamic_variables: Record<string, any>;

  // Todo el análisis
  analysis: Record<string, any>;

  // Metadatos de procesamiento
  processed_at: string;
  event_timestamp: number;
}
