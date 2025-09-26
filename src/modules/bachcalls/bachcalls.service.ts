import { Inject, Injectable, Logger } from '@nestjs/common';
import { IIntegrationService } from 'src/shared/interfaces/i-integration-service.interface';
import { BatchCallDto } from './dto/batch-call.dto';
import { ListBachcallsResponseDto } from './dto/list-bachcalls-response.dto';
import { DetailedBatchCallDto } from './dto/detailed-batch-call.dto';

@Injectable()
export class BachcallsService {
  private readonly logger = new Logger(BachcallsService.name);

  constructor(
    @Inject('EXTERNAL_API_SERVICE')
    private readonly externalApiService: IIntegrationService<any>,
  ) {}

  async listBachcalls(
    limit: number,
    last_doc: string,
  ): Promise<ListBachcallsResponseDto> {
    const param = { limit, last_doc };
    const response = await this.externalApiService.get(
      '/convai/batch-calling/workspace',
      param,
    );
    const bachcalls: BatchCallDto[] = response.batch_calls.map((call: any) => ({
      id: call.id,
      phone_number_id: call.phone_number_id,
      name: call.name,
      agent_id: call.agent_id,
      created_at_unix: call.created_at_unix,
      scheduled_time_unix: call.scheduled_time_unix,
      total_calls_dispatched: call.total_calls_dispatched,
      total_calls_scheduled: call.total_calls_scheduled,
      last_updated_at_unix: call.last_updated_at_unix,
      status: call.status,
      agent_name: call.agent_name,
      phone_provider: call.phone_provider,
    }));

    return {
      batch_calls: bachcalls,
      has_more: response.has_more,
      next_doc: response.next_doc,
    };
  }

  async getBachcallById(bachCallId: string): Promise<DetailedBatchCallDto> {
    const result = await this.externalApiService.get(
      `/convai/batch-calling/${bachCallId}`,
    );

    const detailedBachcall: DetailedBatchCallDto = {
      id: result.id,
      phone_number_id: result.phone_number_id,
      phone_provider: result.phone_provider,
      name: result.name,
      agent_id: result.agent_id,
      created_at_unix: result.created_at_unix,
      scheduled_time_unix: result.scheduled_time_unix,
      total_calls_dispatched: result.total_calls_dispatched,
      total_calls_scheduled: result.total_calls_scheduled,
      last_updated_at_unix: result.last_updated_at_unix,
      status: result.status,
      agent_name: result.agent_name,
      recipients: result.recipients.map((recipient: any) => ({
        id: recipient.id,
        phone_number: recipient.phone_number,
        status: recipient.status,
        created_at_unix: recipient.created_at_unix,
        updated_at_unix: recipient.updated_at_unix,
        conversation_id: recipient.conversation_id,
        dynamic_variables:
          recipient.conversation_initiation_client_data.dynamic_variables,
      })),
    };

    return detailedBachcall;
  }
}
