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
import { RegistroSftp } from 'src/shared/entities/registro-sftp.entity';
import {
  ExcelCsvProcessor,
  ValidationResult,
} from 'src/shared/services/excel-csv-processor.service';
import { BuscarRegistrosSftpResponseDto } from './dto/buscar-registros-sftp-response.dto';
import { PrepareBatchCallingDto } from './dto/prepare-batch-calling.dto';
import { BatchCallingRequestDto } from './dto/batch-calling-request.dto';
import { GcpPipelineService } from 'src/shared/services/gcp-pipeline.service';
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
    @Inject('REGISTROS_SFTP_REPOSITORY')
    private readonly registrosSftpRepository: IDatabaseService<RegistroSftp>,
    private readonly pipelineService: GcpPipelineService,
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
        id_carga: uuid,
        agent_id: uploadExcelDto.agent_id,
        agent_phone_number_id: uploadExcelDto.phone_id,
        call_name: uploadExcelDto.batch_name,
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

      // Disparar pipeline después de guardar el registro exitosamente
      try {
        const pipelineData = {
          id_carga: registroArchivo.id_carga,
          agent_id: registroArchivo.agent_id,
          agent_phone_number_id: registroArchivo.agent_phone_number_id,
          call_name: registroArchivo.call_name,
          file_path: registroArchivo.file_path,
        };

        await this.pipelineService.triggerPipelineAfterAction(
          'file_uploaded',
          pipelineData,
        );

        this.logger.log(
          `Pipeline triggered successfully for file upload: ${fileName}`,
        );
      } catch (pipelineError) {
        // Log pipeline error but don't fail the main operation
        this.logger.warn(
          `Failed to trigger pipeline after file upload: ${pipelineError.message}`,
        );
      }

      return {
        id_carga: uuid,
        message: `File processed and uploaded successfully. ${validationResult.data?.length || 0} rows validated.`,
        file_path: filePath,
        status: 'pendiente',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Unexpected error processing file:', error);

      throw new BadRequestException({
        message: 'Error processing file',
        error: 'PROCESSING_ERROR',
        details: error.message,
      });
    }
  }

  async buscarRegistrosSftp(
    cargaId: string,
  ): Promise<BuscarRegistrosSftpResponseDto> {
    try {
      this.logger.log(`Searching SFTP records for carga ID: ${cargaId}`);

      const registros = await this.registrosSftpRepository.getAllByField(
        'id',
        cargaId,
      );

      this.logger.log(
        `Found ${registros.length} SFTP records for carga ID: ${cargaId}`,
      );

      const registrosResponse = registros.map((registro) => ({
        id: registro.id,
        fecha: registro.fecha,
        phone_number: registro.phone_number,
        phone_number_2: registro.phone_number_2,
        metadata_user: registro.metadata_user,
      }));

      return {
        registros: registrosResponse,
        total: registros.length,
        carga_id: cargaId,
      };
    } catch (error) {
      this.logger.error(
        `Error searching SFTP records for carga ID ${cargaId}:`,
        error,
      );
      throw new BadRequestException({
        message: `Error searching SFTP records for carga ID: ${cargaId}`,
        error: 'SEARCH_ERROR',
        details: error.message,
      });
    }
  }

  async prepararBatchCalling(
    prepareDto: PrepareBatchCallingDto,
  ): Promise<BatchCallingRequestDto> {
    try {
      this.logger.log(
        `Preparing batch calling for carga ID: ${prepareDto.carga_id}`,
      );

      const sftpData = await this.buscarRegistrosSftp(prepareDto.carga_id);

      if (!sftpData.registros || sftpData.registros.length === 0) {
        throw new BadRequestException({
          message: 'No SFTP records found for the provided carga ID',
          error: 'NO_RECORDS_FOUND',
          carga_id: prepareDto.carga_id,
        });
      }

      const scheduledTime =
        prepareDto.scheduled_time_unix || Math.floor(Date.now() / 1000);

      const recipients = sftpData.registros
        .map((registro) => {
          if (!registro.phone_number) {
            this.logger.warn(
              `Record ${registro.id} missing phone_number, skipping`,
            );
            return null;
          }

          const metadata = registro.metadata_user;

          return {
            phone_number: registro.phone_number,
            conversation_initiation_client_data: {
              type: 'conversation_initiation_client_data',
              dynamic_variables: {
                agent_name: prepareDto.agent_name,
                ...metadata, // Cargar toda la metadata tal cual sin procesamiento
              },
            },
          };
        })
        .filter((recipient) => recipient !== null);

      if (recipients.length === 0) {
        throw new BadRequestException({
          message:
            'No valid recipients found - all records missing required phone_number',
          error: 'NO_VALID_RECIPIENTS',
          carga_id: prepareDto.carga_id,
        });
      }

      const batchCallingRequest: BatchCallingRequestDto = {
        call_name: prepareDto.call_name,
        agent_id: prepareDto.agent_id,
        agent_phone_number_id: prepareDto.agent_phone_number_id,
        scheduled_time_unix: scheduledTime,
        recipients: recipients,
      };

      this.logger.log(
        `Batch calling prepared successfully: ${recipients.length} recipients for carga ID: ${prepareDto.carga_id}`,
      );

      return batchCallingRequest;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error preparing batch calling for carga ID ${prepareDto.carga_id}:`,
        error,
      );
      throw new BadRequestException({
        message: `Error preparing batch calling for carga ID: ${prepareDto.carga_id}`,
        error: 'BATCH_CALLING_PREPARATION_ERROR',
        details: error.message,
      });
    }
  }

  async enviarBatchCalling(prepareDto: PrepareBatchCallingDto): Promise<any> {
    try {
      this.logger.log(
        `Starting batch calling process for carga ID: ${prepareDto.carga_id}`,
      );

      // Primero preparar la información del batch calling
      const batchCallingRequest = await this.prepararBatchCalling(prepareDto);

      this.logger.log(
        `Sending batch calling request: ${batchCallingRequest.call_name}`,
      );

      // Después enviar la solicitud preparada
      const response = await this.externalApiService.post(
        '/convai/batch-calling/submit',
        batchCallingRequest,
      );

      this.logger.log(
        `Batch calling submitted successfully: ${batchCallingRequest.call_name}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Error in batch calling process for carga ID ${prepareDto.carga_id}:`,
        error,
      );
      throw new BadRequestException({
        message: `Error processing batch calling for carga ID: ${prepareDto.carga_id}`,
        error: 'BATCH_CALLING_SUBMIT_ERROR',
        details: error.message,
      });
    }
  }
}
