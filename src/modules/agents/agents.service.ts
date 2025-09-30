import { Inject, Injectable, Logger } from '@nestjs/common';
import { IIntegrationService } from 'src/shared/interfaces/i-integration-service.interface';
import { ListAgentsDto } from './dto/list-agents.dto';
import { ListAgentsResponseDto } from './dto/list-agents-response.dto';
import { ListPhoneNumbersResponseDto } from './dto/list-phone-numbers-response.dto';
import { PhoneNumberDto } from './dto/phone-number.dto';

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

  async listPhoneNumbers(): Promise<ListPhoneNumbersResponseDto> {
    const response = await this.externalApiService.get('/convai/phone-numbers');

    // Manejar diferentes posibles estructuras de respuesta
    let phoneNumbersData = response.phone_numbers || response || [];

    // Si response es un array directamente
    if (Array.isArray(response)) {
      phoneNumbersData = response;
    }

    const phoneNumbers: PhoneNumberDto[] = Array.isArray(phoneNumbersData)
      ? phoneNumbersData.map((phoneNumber: any) => ({
          phone_number: phoneNumber.phone_number,
          label: phoneNumber.label,
          supports_inbound: phoneNumber.supports_inbound,
          supports_outbound: phoneNumber.supports_outbound,
          phone_number_id: phoneNumber.phone_number_id,
          assigned_agent: {
            agent_id: phoneNumber.assigned_agent?.agent_id,
            agent_name: phoneNumber.assigned_agent?.agent_name,
          },
          provider: phoneNumber.provider,
        }))
      : [];

    this.logger.log(`Retrieved ${phoneNumbers.length} phone numbers`);

    return {
      phone_numbers: phoneNumbers,
    };
  }
}
