import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SecurityValidationPipe } from 'src/shared/pipes/validations/security-validation.pipe';
import { ListAgentsResponseDto } from './dto/list-agents-response.dto';
import { ListPhoneNumbersResponseDto } from './dto/list-phone-numbers-response.dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all agents',
    description:
      'Retrieves a paginated list of agents with optional search and cursor-based pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of agents retrieved successfully.',
    type: ListAgentsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Invalid query parameters (e.g., invalid page_size, malformed cursor).',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Invalid page_size parameter' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions to access agents.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: 'Forbidden resource' },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - External API integration failure.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: {
          type: 'string',
          example: 'External API service unavailable',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @ApiResponse({
    status: 502,
    description: 'Bad Gateway - External service error.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 502 },
        message: {
          type: 'string',
          example: 'External service returned invalid response',
        },
        error: { type: 'string', example: 'Bad Gateway' },
      },
    },
  })
  @ApiResponse({
    status: 504,
    description: 'Gateway Timeout - External service timeout.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 504 },
        message: { type: 'string', example: 'External service timeout' },
        error: { type: 'string', example: 'Gateway Timeout' },
      },
    },
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor for fetching the next page.',
  })
  @ApiQuery({
    name: 'page_size',
    required: false,
    type: Number,
    description: 'Maximum number of agents to return, default 30.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by agent name.',
  })
  @UsePipes(new SecurityValidationPipe())
  async listAgent(
    @Query('cursor') cursor?: string,
    @Query('page_size') pageSize?: number,
    @Query('search') search?: string,
  ): Promise<ListAgentsResponseDto> {
    return this.agentsService.listAgents(cursor, pageSize, search);
  }

  @Get('phone-numbers')
  @ApiOperation({
    summary: 'List all phone numbers',
    description:
      'Retrieves a complete list of phone numbers with their assigned agents, provider information, and capabilities.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of phone numbers retrieved successfully.',
    type: ListPhoneNumbersResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid request format or parameters.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Invalid request parameters' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Insufficient permissions to access phone numbers.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: 'Forbidden resource' },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Phone numbers resource not available.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          example: 'Phone numbers endpoint not found',
        },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - External API integration failure.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: {
          type: 'string',
          example: 'Failed to retrieve phone numbers from external service',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @ApiResponse({
    status: 502,
    description: 'Bad Gateway - External service error.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 502 },
        message: {
          type: 'string',
          example: 'External phone number service returned invalid response',
        },
        error: { type: 'string', example: 'Bad Gateway' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description:
      'Service Unavailable - External service temporarily unavailable.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 503 },
        message: {
          type: 'string',
          example: 'Phone number service temporarily unavailable',
        },
        error: { type: 'string', example: 'Service Unavailable' },
      },
    },
  })
  @ApiResponse({
    status: 504,
    description: 'Gateway Timeout - External service timeout.',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 504 },
        message: { type: 'string', example: 'Phone number service timeout' },
        error: { type: 'string', example: 'Gateway Timeout' },
      },
    },
  })
  @UsePipes(new SecurityValidationPipe())
  async listPhoneNumbers(): Promise<ListPhoneNumbersResponseDto> {
    return this.agentsService.listPhoneNumbers();
  }
}
