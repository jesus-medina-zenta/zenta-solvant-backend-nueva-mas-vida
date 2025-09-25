import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { IAudioStorageService } from '../../shared/interfaces/i-audio-storage-service.interface';
import { IStorageOptions } from '../../shared/interfaces/i-storage-options.interface';
import {
  StorageUploadException,
  StorageDownloadException,
  StorageFileNotFoundException,
  StorageDeleteException,
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
      // Si se especifica una carpeta, incluirla en el nombre del archivo
      const fileName = folder
        ? `${folder}/${audioId}.${fileExtension}`
        : `${audioId}.${fileExtension}`;

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      // Determinar el tipo de contenido basado en la extensión
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
            // Archivo subido como privado - perfecto para acceso desde pipeline GCP
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
   * Obtiene el path GCS del archivo para acceso desde pipeline
   * @param audioId ID del audio
   * @param fileExtension Extensión del archivo
   * @param folder Carpeta donde se encuentra el archivo
   * @returns Path completo en formato gs://bucket/path
   */
  getAudioPath(
    audioId: string,
    fileExtension?: string,
    folder?: string,
  ): string {
    const fileName = fileExtension ? `${audioId}.${fileExtension}` : audioId;
    const fullPath = folder ? `${folder}/${fileName}` : fileName;
    return `gs://${this.bucketName}/${fullPath}`;
  }

  /**
   * @deprecated Use getAudioPath() for GCP pipeline access
   * Gets the HTTP URL of the file (not functional for private files)
   */
  getAudioUrl(
    audioId: string,
    fileExtension?: string,
    folder?: string,
  ): string {
    const fileName = fileExtension ? `${audioId}.${fileExtension}` : audioId;
    const fullPath = folder ? `${folder}/${fileName}` : fileName;
    // Retorna la URL directa (será privada con Uniform Bucket-Level Access)
    return `https://storage.googleapis.com/${this.bucketName}/${fullPath}`;
  }

  async deleteAudio(audioId: string): Promise<void> {
    try {
      // Intentar eliminar con diferentes extensiones comunes si no se especifica
      const commonExtensions = ['mp3', 'wav', 'ogg', 'm4a'];
      let deleted = false;

      for (const ext of commonExtensions) {
        const fileName = `${audioId}.${ext}`;
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(fileName);

        const [exists] = await file.exists();
        if (exists) {
          await file.delete();
          this.logger.log(`Audio deleted successfully: ${fileName}`);
          deleted = true;
          break;
        }
      }

      if (!deleted) {
        throw new StorageFileNotFoundException(audioId);
      }
    } catch (error) {
      if (error instanceof StorageFileNotFoundException) {
        throw error;
      }
      this.handleStorageError(error, audioId);
    }
  }

  async audioExists(
    audioId: string,
    folder?: string,
    fileExtension?: string,
  ): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);

      if (fileExtension) {
        const fileName = `${audioId}.${fileExtension}`;
        const fullPath = folder ? `${folder}/${fileName}` : fileName;
        const file = bucket.file(fullPath);
        const [exists] = await file.exists();
        return exists;
      } else {
        const commonExtensions = ['mp3', 'wav', 'ogg', 'm4a'];

        for (const ext of commonExtensions) {
          const fileName = `${audioId}.${ext}`;
          const fullPath = folder ? `${folder}/${fileName}` : fileName;
          const file = bucket.file(fullPath);
          const [exists] = await file.exists();

          if (exists) {
            return true;
          }
        }

        return false;
      }
    } catch (error) {
      this.handleStorageError(error, audioId);
    }
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
      error instanceof StorageDownloadException ||
      error instanceof StorageDeleteException ||
      error instanceof StorageConfigurationException
    ) {
      throw error;
    }

    throw new GenericStorageException(error.message);
  }
}
