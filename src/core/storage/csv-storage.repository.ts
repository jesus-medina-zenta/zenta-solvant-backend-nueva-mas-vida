import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { IStorageOptions } from '../../shared/interfaces/i-storage-options.interface';
import { ICsvStorageService } from '../../shared/interfaces/i-csv-storage-service.interface';
import {
  StorageUploadException,
  StorageFileNotFoundException,
  StorageConfigurationException,
  GenericStorageException,
} from '../../shared/exceptions/storage-exceptions';

@Injectable()
export class CsvStorageRepository implements ICsvStorageService {
  private logger = new Logger('CsvStorageRepository');
  private storage: Storage;
  private bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly options: IStorageOptions,
  ) {
    const projectId = this.configService.get<string>('gcpProjectId');

    this.bucketName = this.options.bucketName;
    if (!this.bucketName) {
      throw new StorageConfigurationException('Bucket name is required');
    }

    try {
      this.storage = new Storage({
        projectId: projectId,
      });

      this.logger.log(`CSV Storage initialized for bucket: ${this.bucketName}`);
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  async uploadCsv(
    fileName: string,
    fileBuffer: Buffer,
    folder?: string,
  ): Promise<string> {
    try {
      const fullFileName = folder ? `${folder}/${fileName}` : fileName;

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fullFileName);

      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      const contentType = this.getContentType(fileExtension);

      const stream = file.createWriteStream({
        metadata: {
          contentType: contentType,
        },
        resumable: false,
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          this.logger.error(`Upload error for file ${fileName}:`, error);
          reject(new StorageUploadException(fullFileName));
        });

        stream.on('finish', async () => {
          try {
            const filePath = this.getCsvPath(fileName, folder);
            this.logger.log(`File uploaded successfully: ${fullFileName}`);
            this.logger.log(`GCS path: ${filePath}`);
            resolve(filePath);
          } catch (error) {
            this.logger.error(
              `Error processing uploaded file: ${fullFileName}`,
              error,
            );
            reject(new StorageUploadException(fullFileName));
          }
        });

        stream.end(fileBuffer);
      });
    } catch (error) {
      this.handleStorageError(error, fileName);
    }
  }

  getCsvPath(fileName: string, folder?: string): string {
    const fullPath = folder ? `${folder}/${fileName}` : fileName;
    return `gs://${this.bucketName}/${fullPath}`;
  }

  private getContentType(fileExtension: string): string {
    const contentTypes: Record<string, string> = {
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      txt: 'text/plain',
    };

    return contentTypes[fileExtension] || 'application/octet-stream';
  }

  private handleStorageError(error: any, context?: string): never {
    this.logger.error(
      `Storage error${context ? ` for file ${context}` : ''}:`,
      error.message,
      error.stack,
    );

    if (error.code === 401 || error.code === 403) {
      throw new StorageConfigurationException(
        'Access denied - check credentials and permissions',
      );
    }

    if (error.code === 404) {
      throw new StorageFileNotFoundException(context);
    }

    if (
      error instanceof StorageFileNotFoundException ||
      error instanceof StorageUploadException ||
      error instanceof StorageConfigurationException
    ) {
      throw error;
    }

    throw new GenericStorageException(error.message);
  }
}
