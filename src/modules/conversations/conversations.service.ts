import { Inject, Injectable, Logger } from '@nestjs/common';
import { IIntegrationService } from 'src/shared/interfaces/i-integration-service.interface';
import { IAudioStorageService } from 'src/shared/interfaces/i-audio-storage-service.interface';
import { IDatabaseService } from 'src/shared/interfaces/i-database-service.interface';
import { AudiosStatus } from 'src/shared/entities/audios-status.entity';
import { GetConversationsQueryDto } from './dto/get-conversations-query.dto';
import { ListConversationsResponseDto } from './dto/list-conversations-response.dto';
import { ListConversationsDto } from './dto/list-conversation.dto';
import { ConversationByIdResponseDto } from './dto/conversation-by-id-response.dto';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @Inject('EXTERNAL_API_SERVICE')
    private readonly externalApiService: IIntegrationService<any>,
    @Inject('AUDIO_STORAGE_REPOSITORY')
    private readonly audioStorageService: IAudioStorageService,
    @Inject('AUDIOS_STATUS_REPOSITORY')
    private readonly audiosStatusRepository: IDatabaseService<AudiosStatus>,
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

    this.logger.log(
      `Fetching conversations with params: ${JSON.stringify(query)}`,
    );
    this.logger.log(
      `Retrieved ${conversations.length} conversations, hasMore: ${response.has_more}`,
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
      analysis: response.analysis,
    };

    this.logger.log(`Fetching conversation details for ID: ${conversationId}`);

    return conversation;
  }

  async getConversationAudio(conversationId: string): Promise<Buffer> {
    this.logger.log(
      `Starting audio retrieval for conversation: ${conversationId}`,
    );

    const endpoint = `/convai/conversations/${conversationId}/audio`;
    const audioBuffer = await this.externalApiService.get(
      endpoint,
      undefined,
      'arraybuffer',
    );

    this.logger.log(
      `Audio downloaded successfully - Size: ${audioBuffer.length} bytes`,
    );

    return audioBuffer;
  }

  async saveConversationAudio(conversationId: string): Promise<string> {
    try {
      this.logger.log(
        `Starting audio save process for conversation: ${conversationId}`,
      );

      const audioBuffer = await this.getConversationAudio(conversationId);

      if (!audioBuffer || audioBuffer.length === 0) {
        await this.saveAudioStatus(conversationId, 'AUDIO_FAILED');
        throw new Error(
          `No audio data found for conversation: ${conversationId}`,
        );
      }

      const fileName = conversationId;
      const fileExtension = 'mp3';
      const folder = 'audios';

      const gcsPath = await this.audioStorageService.uploadAudio(
        fileName,
        audioBuffer,
        fileExtension,
        folder,
      );

      this.logger.log(`Audio saved successfully to GCS: ${gcsPath}`);

      await this.saveAudioStatus(conversationId, 'AUDIO_SAVED_IN_BUCKET');

      return gcsPath;
    } catch (error) {
      await this.saveAudioStatus(conversationId, 'AUDIO_FAILED');
      this.logger.error(
        `Error saving audio for conversation ${conversationId}:`,
        error.message,
        error.stack,
      );
      throw new Error(
        `Failed to save audio for conversation ${conversationId}: ${error.message}`,
      );
    }
  }

  private async saveAudioStatus(
    conversationId: string,
    status: AudiosStatus['status'],
  ): Promise<void> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const existingRecord =
        await this.audiosStatusRepository.getById(conversationId);

      if (existingRecord) {
        await this.audiosStatusRepository.update(conversationId, {
          status,
          update_at: timestamp,
        });
      } else {
        const statusRecord: AudiosStatus = {
          id_conversacion: conversationId,
          status,
          time_stamp: timestamp,
          update_at: timestamp,
        };
        await this.audiosStatusRepository.createOrReplace(
          conversationId,
          statusRecord,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error saving audio status for conversation ${conversationId}:`,
        error.message,
      );
    }
  }
}
