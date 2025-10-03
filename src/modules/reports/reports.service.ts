import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { IDatabaseService } from 'src/shared/interfaces/i-database-service.interface';
import { ProcessedConversationData } from '../webhooks/dto/convai-webhook.dto';
import { ConversationSlimDto } from './dto/conversation-slim.dto';
import * as ExcelJS from 'exceljs';

interface ExcelColumn {
  header: string;
  key: string;
  width: number;
}

interface KeySets {
  dynamic: Set<string>;
  evaluation: Set<string>;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  // Optimized constants
  private static readonly MAX_RECORDS = 20000;
  private static readonly MAX_BUFFER_SIZE = 100 * 1024 * 1024; // 100MB
  private static readonly MAX_COLUMNS = 500;
  private static readonly MAX_DYNAMIC_KEYS = 50;
  private static readonly MAX_EVAL_KEYS = 100;
  private static readonly BATCH_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
  private static readonly EXCEL_FORMULA_CHARS = new Set([
    '=',
    '+',
    '-',
    '@',
    '\t',
    '\r',
  ]);

  // Pre-compiled border style
  private static readonly BORDER_STYLE = {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const },
  };

  constructor(
    @Inject('REGISTROS_LLAMADAS_REPOSITORY')
    private readonly registrosLlamadasRepository: IDatabaseService<ProcessedConversationData>,
  ) {}

  async getConversationsByBatchCallId(
    batchCallId: string,
  ): Promise<ConversationSlimDto[]> {
    try {
      this.validateBatchCallId(batchCallId);
      this.logger.log(
        `Searching conversations for: ${this.sanitizeForLogging(batchCallId)}`,
      );

      const records = await this.registrosLlamadasRepository.getAllByField(
        'batch_call.batch_call_id',
        batchCallId,
      );

      if (records.length > ReportsService.MAX_RECORDS) {
        throw new BadRequestException(
          `Too many records: ${records.length}/${ReportsService.MAX_RECORDS}`,
        );
      }

      const conversations = records.map((record) => ({
        conversation_id: this.sanitizeString(record.conversation_id),
        agent_id: this.sanitizeString(record.agent_id),
        track_id: this.sanitizeString(record.track_id),
        dynamic_variables: this.sanitizeObject(record.dynamic_variables || {}),
        evaluation: {
          evaluation_criteria_results: this.sanitizeObject(
            record.analysis?.evaluation_criteria_results || {},
          ),
          data_collection_results: this.sanitizeObject(
            record.analysis?.data_collection_results || {},
          ),
        },
      }));

      this.logger.log(`Found ${conversations.length} conversations`);
      return conversations;
    } catch (error) {
      this.logger.error(`Error searching conversations: ${error.name}`);
      if (error instanceof BadRequestException) throw error;
      throw new Error('Failed to retrieve conversations');
    }
  }

  async generateBatchCallExcel(batchCallId: string): Promise<Buffer> {
    try {
      this.validateBatchCallId(batchCallId);
      const conversations =
        await this.getConversationsByBatchCallId(batchCallId);

      if (!conversations.length)
        throw new BadRequestException('No conversations found');

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(
        `BatchCall_${this.sanitizeWorksheetName(batchCallId)}`.substring(0, 31),
      );

      const keySets = this.extractAllKeys(conversations);
      this.validateColumnLimits(keySets);

      worksheet.columns = this.buildColumns(keySets);
      this.styleHeaderRow(worksheet);

      // Process in batches for performance
      for (let i = 0; i < conversations.length; i += 1000) {
        conversations
          .slice(i, i + 1000)
          .forEach((conv) =>
            worksheet.addRow(this.buildRowData(conv, keySets)),
          );
      }

      this.applyBordersOptimized(worksheet);

      const buffer = await workbook.xlsx.writeBuffer();
      this.validateBufferSize(buffer);

      this.logger.log(
        `Excel generated: ${conversations.length} rows, ${keySets.evaluation.size} columns`,
      );
      return Buffer.from(buffer);
    } catch (error) {
      this.logger.error(`Error generating Excel: ${error.name}`);
      if (error instanceof BadRequestException) throw error;
      throw new Error('Failed to generate Excel report');
    }
  }

  // Security helper methods
  private validateBatchCallId(batchCallId: string): void {
    if (!batchCallId || typeof batchCallId !== 'string') {
      throw new BadRequestException('Invalid batch call ID format');
    }

    if (batchCallId.length > 100) {
      throw new BadRequestException('Batch call ID too long');
    }

    if (!ReportsService.BATCH_ID_PATTERN.test(batchCallId)) {
      throw new BadRequestException(
        'Batch call ID contains invalid characters',
      );
    }
  }

  private sanitizeForLogging(input: string): string {
    return input.replace(/[^\w-]/g, '_').substring(0, 50);
  }

  private sanitizeString(input: any): string {
    if (typeof input !== 'string') return '';
    return input.replace(/[\x00-\x1F\x7F]/g, '').substring(0, 255);
  }

  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return {};

    const sanitized: any = {};
    Object.entries(obj).forEach(([key, value]) => {
      const cleanKey = key.replace(/[^\w.-]/g, '_').substring(0, 100);
      if (typeof value === 'string') {
        sanitized[cleanKey] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[cleanKey] = JSON.parse(JSON.stringify(value));
      } else {
        sanitized[cleanKey] = value;
      }
    });

    return sanitized;
  }

  // Compact sanitization methods
  private sanitizeWorksheetName = (name: string): string =>
    name.replace(/[\\\/\?\*\[\]:]/g, '_');
  private sanitizeHeaderName = (name: string): string =>
    name.replace(/[^\w\s:-]/g, '_').substring(0, 100);
  private isValidColumnName = (name: string): boolean =>
    /^[a-zA-Z0-9_.-]+$/.test(name) && name.length <= 100;

  // Existing private methods with minor security improvements
  private extractEvaluationKeys(
    results: Record<string, unknown> | undefined,
    prefix: string,
    keysSet: Set<string>,
  ) {
    if (!results) return;
    Object.entries(results)
      .slice(0, 200)
      .forEach(([key, value]) => {
        const sanitizedKey = key.replace(/[^\w.-]/g, '_');
        if (
          typeof value === 'object' &&
          value !== null &&
          prefix === 'data_collection' &&
          'data_collection_id' in (value as any)
        ) {
          Object.keys(value as Record<string, any>)
            .slice(0, 20)
            .forEach((subKey) =>
              keysSet.add(
                `${prefix}_${sanitizedKey}_${subKey.replace(/[^\w.-]/g, '_')}`,
              ),
            );
        } else {
          keysSet.add(`${prefix}_${sanitizedKey}`);
        }
      });
  }

  private getNestedValue(
    source: Record<string, any> | undefined,
    key: string,
    prefix: string,
  ): any {
    if (!source) return '';
    const path = key.substring(prefix.length);
    const parts = path.split('_');
    for (let i = 1; i <= parts.length - 1; i++) {
      const obj = source[parts.slice(0, i).join('_')];
      if (obj && typeof obj === 'object' && parts.slice(i).join('_') in obj)
        return obj[parts.slice(i).join('_')];
    }
    return source[path] ?? '';
  }

  private formatValue = (value: any): string =>
    value == null
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value).substring(0, 10000) +
          (JSON.stringify(value).length > 10000 ? '...' : '')
        : String(value).substring(0, 32767);

  // Optimized helper methods
  private extractAllKeys(conversations: ConversationSlimDto[]): KeySets {
    const dynamic = new Set<string>();
    const evaluation = new Set<string>();

    for (const conv of conversations) {
      // Extract dynamic keys with limit
      const dynamicKeys = Object.keys(conv.dynamic_variables);
      for (
        let i = 0;
        i < Math.min(dynamicKeys.length, ReportsService.MAX_DYNAMIC_KEYS);
        i++
      ) {
        const key = dynamicKeys[i];
        if (this.isValidColumnName(key)) {
          dynamic.add(key);
        }
      }

      // Extract evaluation keys efficiently
      this.extractEvaluationKeysOptimized(
        conv.evaluation.evaluation_criteria_results,
        'eval_criteria',
        evaluation,
      );
      this.extractEvaluationKeysOptimized(
        conv.evaluation.data_collection_results,
        'data_collection',
        evaluation,
      );
    }

    return { dynamic, evaluation };
  }

  private extractEvaluationKeysOptimized(
    results: Record<string, unknown> | undefined,
    prefix: string,
    keysSet: Set<string>,
  ): void {
    if (!results || keysSet.size >= ReportsService.MAX_EVAL_KEYS) return;

    const entries = Object.entries(results);
    for (const [key, value] of entries) {
      if (keysSet.size >= ReportsService.MAX_EVAL_KEYS) break;

      const sanitizedKey = key.replace(/[^\w.-]/g, '_');

      if (typeof value === 'object' && value !== null) {
        if (prefix === 'data_collection' && 'data_collection_id' in value) {
          const subKeys = Object.keys(value as Record<string, any>);
          for (let i = 0; i < Math.min(subKeys.length, 20); i++) {
            const sanitizedSubKey = subKeys[i].replace(/[^\w.-]/g, '_');
            keysSet.add(`${prefix}_${sanitizedKey}_${sanitizedSubKey}`);
          }
        } else {
          keysSet.add(`${prefix}_${sanitizedKey}`);
        }
      } else {
        keysSet.add(`${prefix}_${sanitizedKey}`);
      }
    }
  }

  private validateColumnLimits = (keySets: KeySets): void => {
    const totalColumns = 3 + keySets.dynamic.size + keySets.evaluation.size;
    if (totalColumns > ReportsService.MAX_COLUMNS)
      throw new BadRequestException(
        `Too many columns: ${totalColumns}. Max allowed: ${ReportsService.MAX_COLUMNS}`,
      );
  };

  private buildColumns(keySets: KeySets): ExcelColumn[] {
    const columns: ExcelColumn[] = [
      { header: 'Conversation ID', key: 'conversation_id', width: 40 },
      { header: 'Agent ID', key: 'agent_id', width: 20 },
      { header: 'Track ID', key: 'track_id', width: 40 },
      ...Array.from(keySets.dynamic).map((key) => ({
        header: `Dynamic: ${this.sanitizeHeaderName(key)}`,
        key: `dynamic_${key}`,
        width: 20,
      })),
      ...Array.from(keySets.evaluation).map((key) => ({
        header: this.sanitizeHeaderName(
          key.startsWith('eval_criteria_')
            ? key.replace('eval_criteria_', 'Eval: ')
            : key.startsWith('data_collection_')
              ? key.replace('data_collection_', 'Data: ')
              : key,
        ),
        key,
        width: 25,
      })),
    ];
    return columns;
  }

  private buildRowData(
    conv: ConversationSlimDto,
    keySets: KeySets,
  ): Record<string, any> {
    const rowData = {
      conversation_id: this.sanitizeExcelValue(conv.conversation_id),
      agent_id: this.sanitizeExcelValue(conv.agent_id),
      track_id: this.sanitizeExcelValue(conv.track_id),
      ...Object.fromEntries(
        Array.from(keySets.dynamic).map((key) => [
          `dynamic_${key}`,
          this.sanitizeExcelValue(
            this.formatValue(conv.dynamic_variables[key]),
          ),
        ]),
      ),
      ...Object.fromEntries(
        Array.from(keySets.evaluation).map((key) => [
          key,
          this.sanitizeExcelValue(
            this.formatValue(
              key.startsWith('eval_criteria_')
                ? this.getNestedValue(
                    conv.evaluation.evaluation_criteria_results,
                    key,
                    'eval_criteria_',
                  )
                : key.startsWith('data_collection_')
                  ? this.getNestedValue(
                      conv.evaluation.data_collection_results,
                      key,
                      'data_collection_',
                    )
                  : '',
            ),
          ),
        ]),
      ),
    };
    return rowData;
  }

  private styleHeaderRow = (worksheet: ExcelJS.Worksheet): void => {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  };

  private applyBordersOptimized = (worksheet: ExcelJS.Worksheet): void =>
    worksheet.eachRow((row) =>
      row.eachCell((cell) => (cell.border = ReportsService.BORDER_STYLE)),
    );

  private validateBufferSize = (buffer: ArrayBuffer): void => {
    if (buffer.byteLength > ReportsService.MAX_BUFFER_SIZE)
      throw new BadRequestException(
        'Generated file is too large. Please reduce the data set.',
      );
  };

  private sanitizeExcelValue(value: string): string {
    if (!value) return '';

    const firstChar = value.toString().charAt(0);
    if (ReportsService.EXCEL_FORMULA_CHARS.has(firstChar)) {
      return `'${value}`;
    }

    return value.toString();
  }
}
