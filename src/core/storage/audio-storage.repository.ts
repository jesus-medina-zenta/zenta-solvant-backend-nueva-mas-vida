import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { IAudioStorageService } from '../../shared/interfaces/i-audio-storage-service.interface';
import { IStorageOptions } from '../../shared/interfaces/i-storage-options.interface';
import {
  StorageUploadException,
  StorageFileNotFoundException,
  StorageConfigurationException,
  GenericStorageException,
} from '../../shared/exceptions/storage-exceptions';

@Injectable()
export class AudioStorageRepository implements IAudioStorageService {
  private logger = new Logger('AudioStorageRepository');
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

      this.logger.log(
        `Audio Storage initialized for bucket: ${this.bucketName}`,
      );
    } catch (error) {
      this.handleStorageError(error);
    }
  }

  async uploadAudio(
    audioId: string,
    audioBuffer: Buffer,
    fileExtension: string,
    folder?: string,
  ): Promise<string> {
    try {
      const fileName = folder
        ? `${folder}/${audioId}.${fileExtension}`
        : `${audioId}.${fileExtension}`;

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const contentType = this.getContentType(fileExtension);

      const stream = file.createWriteStream({
        metadata: {
          contentType: contentType,
        },
        resumable: false,
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          this.logger.error(`Upload error for audio ${audioId}:`, error);
          reject(new StorageUploadException(fileName));
        });

        stream.on('finish', async () => {
          try {
            const filePath = this.getAudioPath(audioId, fileExtension, folder);
            this.logger.log(
              `Audio uploaded successfully (private): ${fileName}`,
            );
            this.logger.log(`GCS path for pipeline access: ${filePath}`);
            resolve(filePath);
          } catch (error) {
            this.logger.error(
              `Error processing uploaded audio: ${fileName}`,
              error,
            );
            reject(new StorageUploadException(fileName));
          }
        });

        stream.end(audioBuffer);
      });
    } catch (error) {
      this.handleStorageError(error, audioId);
    }
  }
  /**
   * Returns the Google Cloud Storage path for the specified audio file.
   * @param audioId - The unique identifier for the audio file.
   * @param fileExtension - The file extension (e.g., 'mp3', 'wav').
   * @param folder - Optional folder name where the audio is stored.
   * @returns The GCS path to the audio file.
   */
  public getAudioPath(
    audioId: string,
    fileExtension?: string,
    folder?: string,
  ): string {
    const fileName = fileExtension ? `${audioId}.${fileExtension}` : audioId;
    const fullPath = folder ? `${folder}/${fileName}` : fileName;
    return `gs://${this.bucketName}/${fullPath}`;
  }

  private getContentType(fileExtension: string): string {
    const contentTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      flac: 'audio/flac',
    };

    return contentTypes[fileExtension.toLowerCase()] || 'audio/mpeg';
  }

  private handleStorageError(error: any, context?: string): never {
    this.logger.error(
      `Storage error${context ? ` for audio ${context}` : ''}:`,
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
