import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AudioStorageRepository } from './audio-storage.repository';
import { CsvStorageRepository } from './csv-storage.repository';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'AUDIO_STORAGE_REPOSITORY',
      useFactory: (configService: ConfigService) => {
        return new AudioStorageRepository(configService, {
          bucketName: configService.get<string>('gcpAudioBucketName'),
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'CSV_STORAGE_SERVICE',
      useFactory: (configService: ConfigService) => {
        return new CsvStorageRepository(configService, {
          bucketName: configService.get<string>('gcpCsvBucketName'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['AUDIO_STORAGE_REPOSITORY', 'CSV_STORAGE_SERVICE'],
})
export class StorageModule {}
