import { Inject, Injectable, Logger } from '@nestjs/common';
import { IIntegrationService } from 'src/shared/interfaces/i-integration-service.interface';
import { ListAgentsDto } from './dto/list-agents.dto';
import { ListAgentsResponseDto } from './dto/list-agents-response.dto';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @Inject('EXTERNAL_API_SERVICE')
    private readonly externalApiService: IIntegrationService<any>,
  ) {}

  async listAgents(
    cursor?: string,
    pageSize: number = 30,
    search?: string,
  ): Promise<ListAgentsResponseDto> {
    const params = {
      cursor,
      page_size: pageSize,
      search,
    };
    const response = await this.externalApiService.get(
      '/convai/agents',
      params,
    );

    const agents: ListAgentsDto[] = response.agents.map((agent: any) => ({
      agentId: agent.agent_id,
      name: agent.name,
      createdAt: new Date(agent.created_at_unix_secs * 1000).toISOString(),
      creatorName: agent.access_info.creator_name,
      lastCallTime: agent.last_call_time_unix_secs
        ? new Date(agent.last_call_time_unix_secs * 1000).toISOString()
        : null,
    }));

    this.logger.log(
      `Listing agents - cursor: ${cursor}, pageSize: ${pageSize}, search: ${search}`,
    );
    this.logger.log(
      `Retrieved ${agents.length} agents, hasMore: ${response.has_more}`,
    );

    return {
      agents,
      hasMore: response.has_more,
      nextCursor: response.next_cursor,
    };
  }
}
