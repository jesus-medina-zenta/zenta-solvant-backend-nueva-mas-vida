import { HttpException, HttpStatus } from '@nestjs/common';

export class StorageUploadException extends HttpException {
  constructor(fileName?: string) {
    super(
      `Error uploading audio file ${fileName ? `'${fileName}'` : ''}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class StorageDownloadException extends HttpException {
  constructor(fileName?: string) {
    super(
      `Error downloading audio file ${fileName ? `'${fileName}'` : ''}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class StorageFileNotFoundException extends HttpException {
  constructor(fileName?: string) {
    super(
      `Audio file ${fileName ? `'${fileName}'` : ''} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class StorageDeleteException extends HttpException {
  constructor(fileName?: string) {
    super(
      `Error deleting audio file ${fileName ? `'${fileName}'` : ''}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class StorageConfigurationException extends HttpException {
  constructor(message?: string) {
    super(
      `Storage configuration error: ${message || 'Invalid configuration'}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class GenericStorageException extends HttpException {
  constructor(message?: string) {
    super(
      `Storage error: ${message || 'Unknown storage error'}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
