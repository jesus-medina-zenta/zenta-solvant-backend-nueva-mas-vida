import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { IIntegrationService } from 'src/shared/interfaces/i-integration-service.interface';
import { BatchCallDto } from './dto/batch-call.dto';
import { ListBachcallsResponseDto } from './dto/list-bachcalls-response.dto';
import { DetailedBatchCallDto } from './dto/detailed-batch-call.dto';
import { UploadExcelDto } from './dto/upload-excel.dto';
import { UploadExcelResponseDto } from './dto/upload-excel-response.dto';
import { ICsvStorageService } from 'src/shared/interfaces/i-csv-storage-service.interface';
import { IDatabaseService } from 'src/shared/interfaces/i-database-service.interface';
import { RegistroArchivo } from 'src/shared/entities/registro-archivo.entity';
import {
  ExcelCsvProcessor,
  ValidationResult,
} from 'src/shared/services/excel-csv-processor.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BachcallsService {
  private readonly logger = new Logger(BachcallsService.name);

  constructor(
    @Inject('EXTERNAL_API_SERVICE')
    private readonly externalApiService: IIntegrationService<any>,
    @Inject('CSV_STORAGE_SERVICE')
    private readonly csvStorageService: ICsvStorageService,
    @Inject('REGISTRO_ARCHIVOS_REPOSITORY')
    private readonly registroArchivosRepository: IDatabaseService<RegistroArchivo>,
    private readonly excelCsvProcessor: ExcelCsvProcessor,
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

  cancelBachcall(bachCallId: string): Promise<void> {
    return this.externalApiService.post(
      `/convai/batch-calling/${bachCallId}/cancel`,
      {},
    );
  }

  async uploadExcel(
    file: any,
    uploadExcelDto: UploadExcelDto,
  ): Promise<UploadExcelResponseDto> {
    try {
      const uuid = uuidv4();

      // Validate file exists
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      const originalName = file.originalname;
      const fileExtension = originalName.split('.').pop()?.toLowerCase();

      // Validate file type
      if (!['xlsx', 'xls', 'csv'].includes(fileExtension)) {
        throw new BadRequestException(
          'Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed',
        );
      }

      // Process file: convert Excel to CSV and validate data
      this.logger.log(`Processing file: ${originalName}`);
      const { csvBuffer, validationResult } =
        await this.excelCsvProcessor.processFile(
          file.buffer,
          originalName,
          fileExtension,
        );

      // Check validation results
      if (!validationResult.isValid) {
        this.logger.error(
          `File validation failed for ${originalName}:`,
          validationResult.errors,
        );
        throw new BadRequestException({
          message: 'File validation failed',
          error: 'VALIDATION_ERROR',
          errors: validationResult.errors,
        });
      }

      // Generate unique filename for CSV (always save as CSV)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${uploadExcelDto.batch_name}_${timestamp}_${uuid}.csv`;

      // Upload processed CSV to GCS
      const folder = 'batch-calling';
      const filePath = await this.csvStorageService.uploadCsv(
        fileName,
        csvBuffer,
        folder,
      );

      // Create registro_archivo record
      const registroArchivo: RegistroArchivo = {
        uuid,
        agent_id: uploadExcelDto.agent_id,
        phone_id: uploadExcelDto.phone_id,
        batch_name: uploadExcelDto.batch_name,
        file_name: fileName,
        file_path: filePath,
        file_size: csvBuffer.length, // Size of processed CSV
        file_type: 'csv', // Always CSV after processing
        status: 'pendiente',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Save to Firestore
      await this.registroArchivosRepository.create(uuid, registroArchivo);

      this.logger.log(
        `File processed and uploaded successfully: ${fileName}, UUID: ${uuid}, Rows: ${validationResult.data?.length || 0}`,
      );

      return {
        uuid,
        message: `File processed and uploaded successfully. ${validationResult.data?.length || 0} rows validated.`,
        file_path: filePath,
        status: 'pendiente',
      };
    } catch (error) {
      // If it's already a BadRequestException, re-throw it
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error('Unexpected error processing file:', error);

      // For other errors, throw a generic BadRequestException
      throw new BadRequestException({
        message: 'Error processing file',
        error: 'PROCESSING_ERROR',
        details: error.message,
      });
    }
  }
}
