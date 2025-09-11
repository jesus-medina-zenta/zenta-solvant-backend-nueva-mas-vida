import { Inject, Injectable, Logger } from '@nestjs/common';
import { IIntegrationService } from 'src/shared/interfaces/i-integration-service.interface';
import { GetConversationsQueryDto } from './dto/get-conversations-query.dto';
import { ListConversationsResponseDto } from './dto/list-conversations-response.dto';
import { ListConversationsDto } from './dto/list-conversation.dto';
import { ConversationByIdResponseDto } from './dto/conversation-by-id-response.dto';
import { CompressionUtil } from 'src/shared/utils/compression.util';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @Inject('EXTERNAL_API_SERVICE')
    private readonly externalApiService: IIntegrationService<any>,
  ) {}

  async getConversations(
    query: GetConversationsQueryDto,
  ): Promise<ListConversationsResponseDto> {
    const params = { ...query };
    const response = await this.externalApiService.get(
      '/convai/conversations',
      params,
    );

    const conversations = response.conversations.map(
      (conv: any): ListConversationsDto => {
        return {
          agent_id: conv.agent_id,
          agent_name: conv.agent_name,
          conversation_id: conv.conversation_id,
          start_time_unix_secs: conv.start_time_unix_secs,
          call_duration_secs: conv.call_duration_secs,
          message_count: conv.message_count,
          status: conv.status,
          call_successful: conv.call_successful,
          transcript_summary: conv.transcript_summary,
          call_summary_title: conv.call_summary_title,
          direction: conv.direction,
        };
      },
    );

    return {
      conversations,
      hasMore: response.has_more,
      nextCursor: response.next_cursor,
    };
  }

  async getConversationById(
    conversationId: string,
  ): Promise<ConversationByIdResponseDto> {
    const response = await this.externalApiService.get(
      `/convai/conversations/${conversationId}`,
    );

    // Mapear la respuesta al DTO
    const conversation: ConversationByIdResponseDto = {
      agent_id: response.agent_id,
      conversation_id: response.conversation_id,
      status: response.status,
      transcript: response.transcript.map((item: any) => ({
        role: item.role,
        time_in_call_secs: item.time_in_call_secs,
        message: item.message,
      })),
      metadata: {
        start_time_unix_secs: response.metadata.start_time_unix_secs,
        call_duration_secs: response.metadata.call_duration_secs,
      },
      has_audio: response.has_audio,
      has_user_audio: response.has_user_audio,
      has_response_audio: response.has_response_audio,
      dinamic_variable:
        response.conversation_initiation_client_data.dynamic_variables,
    };

    return conversation;
  }

  async getConversationAudio(conversationId: string): Promise<Buffer> {
    const endpoint = `/convai/conversations/${conversationId}/audio`;

    // Llama a la API externa
    const compressedAudioBuffer = await this.externalApiService.get(endpoint);

    // Usa la utilidad para descomprimir el contenido
    return CompressionUtil.decompressGzip(Buffer.from(compressedAudioBuffer));
  }
}
