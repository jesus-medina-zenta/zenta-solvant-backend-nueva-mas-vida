import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { GetConversationsQueryDto } from './dto/get-conversations-query.dto';
import { ListConversationsDto } from './dto/list-conversation.dto';
import { ListConversationsResponseDto } from './dto/list-conversations-response.dto';
import { ConversationByIdResponseDto } from './dto/conversation-by-id-response.dto';
import { Response } from 'express';

@ApiTags('Conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List conversations',
    description: 'Retrieve a list of conversations with optional filtering.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor for fetching the next page.',
  })
  @ApiQuery({
    name: 'agent_id',
    required: false,
    type: String,
    description: 'Filter by agent ID.',
  })
  @ApiQuery({
    name: 'call_successful',
    required: false,
    enum: ['success', 'failure', 'unknown'],
    description: 'Filter by call success status.',
  })
  @ApiQuery({
    name: 'call_start_before_unix',
    required: false,
    type: Number,
    description: 'Filter conversations up to this start date (Unix timestamp).',
  })
  @ApiQuery({
    name: 'call_start_after_unix',
    required: false,
    type: Number,
    description: 'Filter conversations after this start date (Unix timestamp).',
  })
  @ApiQuery({
    name: 'user_id',
    required: false,
    type: String,
    description: 'Filter by user ID who initiated the conversation.',
  })
  @ApiQuery({
    name: 'page_size',
    required: false,
    type: Number,
    description:
      'Maximum number of conversations to return (1-100, default: 30).',
  })
  @ApiQuery({
    name: 'summary_mode',
    required: false,
    enum: ['exclude', 'include'],
    description: 'Whether to include transcript summaries in the response.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of conversations.',
    type: ListConversationsDto,
  })
  async getConversations(
    @Query() query: GetConversationsQueryDto,
  ): Promise<ListConversationsResponseDto> {
    return this.conversationsService.getConversations(query);
  }

  @Get(':conversationId')
  @ApiOperation({
    summary: 'Get conversation by ID',
    description: 'Retrieve the details of a specific conversation by its ID.',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'The unique identifier of the conversation',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'The conversation details were successfully retrieved.',
    type: ConversationByIdResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'The conversation with the given ID was not found.',
  })
  async getConversationById(
    @Param('conversationId') conversationId: string,
  ): Promise<ConversationByIdResponseDto> {
    return this.conversationsService.getConversationById(conversationId);
  }

  @Get(':conversationId/audio')
  @ApiOperation({
    summary: 'Get conversation audio',
    description:
      'Retrieve the audio file for a specific conversation by its ID.',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'The unique identifier of the conversation',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'The audio file was successfully retrieved.',
    content: {
      'audio/mpeg': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'The conversation audio was not found.',
  })
  async getConversationAudio(
    @Param('conversationId') conversationId: string,
    @Res() res: Response,
  ): Promise<void> {
    const audioBuffer =
      await this.conversationsService.getConversationAudio(conversationId);

    // Configurar los encabezados HTTP para el archivo de audio
    res.set({
      'Content-Type': 'audio/mpeg', // Asegúrate de que el tipo sea correcto
      'Content-Disposition': `inline; filename="${conversationId}.mp3"`, // Cambia a "inline" para reproducir en lugar de descargar
    });

    res.send(audioBuffer); // Envía el audio al cliente
  }
}
