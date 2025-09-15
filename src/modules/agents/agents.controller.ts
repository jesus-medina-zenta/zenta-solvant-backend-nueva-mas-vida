import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SecurityValidationPipe } from 'src/shared/pipes/validations/security-validation.pipe';
import { ListAgentsResponseDto } from './dto/list-agents-response.dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all agents' })
  @ApiResponse({
    status: 200,
    description: 'List of agents retrieved successfully.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
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
}
