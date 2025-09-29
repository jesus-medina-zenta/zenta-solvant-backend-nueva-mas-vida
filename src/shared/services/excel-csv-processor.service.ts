import * as XLSX from 'xlsx';
import * as csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { Readable } from 'stream';
import { Injectable, Logger } from '@nestjs/common';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any[];
}

@Injectable()
export class ExcelCsvProcessor {
  private readonly logger = new Logger(ExcelCsvProcessor.name);

  /**
   * Process file (Excel or CSV) and convert to validated CSV
   */
  async processFile(
    fileBuffer: Buffer,
    fileName: string,
    fileExtension: string,
  ): Promise<{ csvBuffer: Buffer; validationResult: ValidationResult }> {
    try {
      let data: any[];

      // Convert Excel to data array or parse CSV
      if (fileExtension === 'csv') {
        data = await this.parseCsv(fileBuffer);
      } else if (['xlsx', 'xls'].includes(fileExtension)) {
        data = await this.parseExcel(fileBuffer);
      } else {
        throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      // Validate data
      const validationResult = this.validateData(data);
      if (!validationResult.isValid) {
        return { csvBuffer: null, validationResult };
      }

      // Convert to CSV buffer
      const csvBuffer = await this.convertToCsv(data, fileName);

      return {
        csvBuffer,
        validationResult: { ...validationResult, data },
      };
    } catch (error) {
      this.logger.error(`Error processing file ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Parse Excel file to data array
   */
  private async parseExcel(fileBuffer: Buffer): Promise<any[]> {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error('Excel file must contain at least one sheet');
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
      });

      if (data.length === 0) {
        throw new Error('Excel file is empty');
      }

      const headers = data[0] as string[];
      const rows = data.slice(1);

      return rows
        .filter(
          (row) =>
            Array.isArray(row) &&
            row.some(
              (cell) =>
                cell !== null &&
                cell !== undefined &&
                cell !== '' &&
                String(cell).trim() !== '',
            ),
        )
        .map((row) => {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || null;
          });
          return obj;
        });
    } catch (error) {
      this.logger.error('Error parsing Excel file:', error);
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * Parse CSV file to data array
   */
  private async parseCsv(fileBuffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(fileBuffer);

      stream
        .pipe(csv())
        .on('data', (data) => {
          const hasData = Object.values(data).some(
            (value) =>
              value !== null &&
              value !== undefined &&
              value !== '' &&
              String(value).trim() !== '',
          );
          if (hasData) results.push(data);
        })
        .on('end', () => {
          if (results.length === 0) {
            reject(new Error('CSV file is empty'));
          } else {
            resolve(results);
          }
        })
        .on('error', (error) => {
          this.logger.error('Error parsing CSV file:', error);
          reject(new Error(`Failed to parse CSV file: ${error.message}`));
        });
    });
  }

  /**
   * Validate data structure and content
   */
  private validateData(data: any[]): ValidationResult {
    const errors: string[] = [];

    // Check if data exists
    if (!data || data.length === 0) {
      errors.push('File is empty or contains no data rows');
      return { isValid: false, errors };
    }

    // Get headers from first row
    const headers = Object.keys(data[0]);

    // Find phone_number column (case insensitive)
    const phoneColumn = headers.find(
      (header) => header.toLowerCase() === 'phone_number',
    );

    if (!phoneColumn) {
      errors.push('Must have a column named "phone_number" (case insensitive)');
    }

    // Validate each row has data ONLY in the phone column
    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because index starts at 0 and we skip header

      if (phoneColumn) {
        const phoneValue = row[phoneColumn];
        if (
          phoneValue === null ||
          phoneValue === undefined ||
          phoneValue === ''
        ) {
          errors.push(
            `Row ${rowNumber}: Missing data in column "${phoneColumn}"`,
          );
        }

        // Additional phone value type validation
        if (
          phoneValue &&
          typeof phoneValue !== 'string' &&
          typeof phoneValue !== 'number'
        ) {
          errors.push(`Row ${rowNumber}: Phone value must be text or number`);
        }
      }
    });

    // Check if there are too many errors (avoid flooding)
    if (errors.length > 50) {
      errors.splice(50);
      errors.push(
        '... and more validation errors. Please fix the file structure.',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? data : undefined,
    };
  }

  /**
   * Convert data array to CSV buffer
   */
  private async convertToCsv(data: any[], fileName: string): Promise<Buffer> {
    try {
      if (data.length === 0) {
        throw new Error('No data to convert to CSV');
      }

      // Get headers from first row
      const headers = Object.keys(data[0]);

      // Create CSV string manually to have full control
      const csvRows: string[] = [];

      // Add header row
      csvRows.push(headers.join(','));

      // Add data rows
      data.forEach((row) => {
        const values = headers.map((header) => {
          const value = row[header];
          // Handle values that might contain commas or quotes
          if (value === null || value === undefined) {
            return '';
          }
          const stringValue = String(value);
          if (
            stringValue.includes(',') ||
            stringValue.includes('"') ||
            stringValue.includes('\n')
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(values.join(','));
      });

      const csvContent = csvRows.join('\n');
      return Buffer.from(csvContent, 'utf-8');
    } catch (error) {
      this.logger.error('Error converting to CSV:', error);
      throw new Error(`Failed to convert to CSV: ${error.message}`);
    }
  }
}
