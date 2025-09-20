import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AudioStorageRepository } from './audio-storage.repository';

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
  ],
  exports: ['AUDIO_STORAGE_REPOSITORY'],
})
export class StorageModule {}
