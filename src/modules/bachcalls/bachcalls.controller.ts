import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { BachcallsService } from './bachcalls.service';
import { SecurityValidationPipe } from 'src/shared/pipes/validations/security-validation.pipe';
import { ListBachcallsResponseDto } from './dto/list-bachcalls-response.dto';
import { DetailedBatchCallDto } from './dto/detailed-batch-call.dto';
import { UploadExcelDto } from './dto/upload-excel.dto';
import { UploadExcelResponseDto } from './dto/upload-excel-response.dto';
import { ValidationErrorDto } from './dto/validation-error.dto';
import { PrepareBatchCallingDto } from './dto/prepare-batch-calling.dto';

@Controller('bachcalls')
export class BachcallsController {
  constructor(private readonly bachcallsService: BachcallsService) {}

  @Get()
  @ApiOperation({ summary: 'List all batch calls' })
  @ApiResponse({
    status: 200,
    description: 'List of batch calls retrieved successfully.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of batch calls to return.',
  })
  @ApiQuery({
    name: 'last_doc',
    required: false,
    type: String,
    description: 'Last document ID for pagination.',
  })
  @UsePipes(new SecurityValidationPipe())
  async listBachcalls(
    @Query('limit') limit: number = 30,
    @Query('last_doc') last_doc?: string,
  ): Promise<ListBachcallsResponseDto> {
    return this.bachcallsService.listBachcalls(limit, last_doc);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed batch call by ID' })
  @ApiResponse({
    status: 200,
    description: 'Batch call details retrieved successfully.',
    type: DetailedBatchCallDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Batch call not found.' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the batch call.',
    example: 'btcal_6801k59m1t31e8xt43nscbtxfakf',
  })
  @UsePipes(new SecurityValidationPipe())
  async getBachcallById(
    @Param('id') id: string,
  ): Promise<DetailedBatchCallDto> {
    return this.bachcallsService.getBachcallById(id);
  }

  @Post('upload-excel')
  @ApiOperation({ summary: 'Upload Excel/CSV file for batch calling' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Excel/CSV file and batch call information',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel or CSV file to upload',
        },
        agent_id: {
          type: 'string',
          description: 'ID of the agent',
        },
        phone_id: {
          type: 'string',
          description: 'ID of the phone',
        },
        batch_name: {
          type: 'string',
          description: 'Name of the batch calling',
        },
      },
      required: ['file', 'agent_id', 'phone_id', 'batch_name'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Excel/CSV file uploaded and processed successfully.',
    type: UploadExcelResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - File validation failed.',
    type: ValidationErrorDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(
    @UploadedFile() file: any,
    @Body() uploadExcelDto: UploadExcelDto,
  ): Promise<UploadExcelResponseDto> {
    return await this.bachcallsService.uploadExcel(file, uploadExcelDto);
  }

  @Post('upload-csv')
  @ApiOperation({
    summary: 'Upload CSV file for batch calling and trigger processing',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'CSV file and batch call information',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file to upload',
        },
        agent_id: {
          type: 'string',
          description: 'ID of the agent',
        },
        phone_id: {
          type: 'string',
          description: 'ID of the phone',
        },
        batch_name: {
          type: 'string',
          description: 'Name of the batch calling',
        },
      },
      required: ['file', 'agent_id', 'phone_id', 'batch_name'],
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'CSV uploaded, metadata saved in Firestore, and transformation pipeline triggered.',
    type: UploadExcelResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - CSV validation failed.',
    type: ValidationErrorDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadCsv(
    @UploadedFile() file: any,
    @Body() uploadExcelDto: UploadExcelDto,
  ): Promise<UploadExcelResponseDto> {
    return await this.bachcallsService.uploadExcel(file, uploadExcelDto);
  }

  @Post('send-batch-calling')
  @ApiOperation({ summary: 'Send batch calling to ElevenLabs' })
  @ApiBody({
    description: 'Batch calling information to prepare and send',
    type: PrepareBatchCallingDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Batch calling sent successfully.',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the created batch calling',
        },
        message: {
          type: 'string',
          description: 'Success message',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed or no records found.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UsePipes(new SecurityValidationPipe())
  async sendBatchCalling(
    @Body() prepareBatchCallingDto: PrepareBatchCallingDto,
  ): Promise<any> {
    return await this.bachcallsService.enviarBatchCalling(
      prepareBatchCallingDto,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a batch call by ID' })
  @ApiResponse({
    status: 204,
    description: 'Batch call canceled successfully.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Batch call not found.' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'The unique identifier of the batch call to cancel.',
    example: 'btcal_6801k59m1t31e8xt43nscbtxfakf',
  })
  @UsePipes(new SecurityValidationPipe())
  async cancelBachcall(@Param('id') id: string): Promise<void> {
    return this.bachcallsService.cancelBachcall(id);
  }
}
