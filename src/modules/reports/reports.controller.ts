import {
  Controller,
  Get,
  Logger,
  Param,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ConversationSlimDto } from './dto/conversation-slim.dto';
import { Response } from 'express';

@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);
  constructor(private readonly reportsService: ReportsService) {}

  @Get('conversations/:batchCallId/batchcall')
  @ApiOperation({
    summary: 'Get conversations by batch call ID',
    description:
      'Retrieves all conversation records associated with a specific batch call ID',
  })
  @ApiParam({
    name: 'batchCallId',
    description: 'The batch call ID to search for',
    example: 'batch_12345678',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved conversations for the batch call',
    type: [ConversationSlimDto],
  })
  @ApiResponse({
    status: 404,
    description: 'No conversations found for the specified batch call ID',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getConversationsByBatchCallId(
    @Param('batchCallId') batchCallId: string,
  ) {
    const conversations =
      await this.reportsService.getConversationsByBatchCallId(batchCallId);
    return conversations;
  }

  @Get('batch-call/:batchCallId/excel')
  @ApiOperation({
    summary: 'Download Excel report for batch call',
    description:
      'Generates and downloads an Excel file with all conversations and dynamic data for a specific batch call ID',
  })
  @ApiParam({
    name: 'batchCallId',
    description: 'The batch call ID to generate the Excel report for',
    example: 'batch_12345678',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file generated and downloaded successfully',
    headers: {
      'Content-Type': {
        description: 'MIME type of the file',
        schema: {
          type: 'string',
          example:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      },
      'Content-Disposition': {
        description: 'File attachment disposition',
        schema: {
          type: 'string',
          example: 'attachment; filename="BatchCall_12345678.xlsx"',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No conversations found for the specified batch call ID',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error while generating Excel file',
  })
  async downloadBatchCallExcel(
    @Param('batchCallId') batchCallId: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(
        `Excel download requested for batch call ID: ${batchCallId}`,
      );

      if (!batchCallId || batchCallId.trim() === '') {
        throw new HttpException(
          'Batch Call ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const excelBuffer =
        await this.reportsService.generateBatchCallExcel(batchCallId);

      // Configurar headers para descarga del archivo
      // Sanitize batchCallId to prevent path traversal and header injection
      const sanitizedBatchCallId = batchCallId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `BatchCall_${sanitizedBatchCallId}_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': excelBuffer.length.toString(),
      });

      this.logger.log(
        `Excel file generated successfully for batch call ID: ${batchCallId}`,
      );

      res.send(excelBuffer);
    } catch (error) {
      this.logger.error(
        `Error generating Excel for batch call ID ${batchCallId}:`,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      if (error.message.includes('No conversations found')) {
        throw new HttpException(
          `No conversations found for batch call ID: ${batchCallId}`,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        'Internal server error while generating Excel file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
