import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FirestoreRepository } from './firestore.repository';
import { User } from 'src/shared/entities/user.entity';
import { CsrfToken } from 'src/shared/entities/csrf-token.entity';
import { AudiosStatus } from 'src/shared/entities/audios-status.entity';
import { RegistroArchivo } from 'src/shared/entities/registro-archivo.entity';
import { RegistroSftp } from 'src/shared/entities/registro-sftp.entity';
import { BatchCallExport } from 'src/shared/entities/batch-call-export.entity';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'USER_REPOSITORY',
      useFactory: (configService: ConfigService) => {
        return new FirestoreRepository<User>(configService, {
          collectionName: 'users',
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'CSRF_TOKEN_REPOSITORY',
      useFactory: (configService: ConfigService) => {
        return new FirestoreRepository<CsrfToken>(configService, {
          collectionName: 'csrfTokens',
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'GENERIC_REPOSITORY',
      useFactory: (configService: ConfigService) => {
        return new FirestoreRepository<User>(configService, {
          collectionName: 'generics',
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'REGISTROS_LLAMADAS_REPOSITORY',
      useFactory: (configService: ConfigService) => {
        return new FirestoreRepository<any>(configService, {
          collectionName: 'registros_llamadas',
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'AUDIOS_STATUS_REPOSITORY',
      useFactory: (configService: ConfigService) => {
        return new FirestoreRepository<AudiosStatus>(configService, {
          collectionName: 'audios_status',
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'REGISTRO_ARCHIVOS_REPOSITORY',
      useFactory: (configService: ConfigService) => {
        return new FirestoreRepository<RegistroArchivo>(configService, {
          collectionName: 'registro_archivos',
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'REGISTROS_SFTP_REPOSITORY',
      useFactory: (configService: ConfigService) => {
        return new FirestoreRepository<RegistroSftp>(configService, {
          collectionName: 'registros_sftp',
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'BATCH_CALL_EXPORTS_REPOSITORY',
      useFactory: (configService: ConfigService) => {
        return new FirestoreRepository<BatchCallExport>(configService, {
          collectionName: 'batch_call_exports',
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    'USER_REPOSITORY',
    'GENERIC_REPOSITORY',
    'CSRF_TOKEN_REPOSITORY',
    'REGISTROS_LLAMADAS_REPOSITORY',
    'AUDIOS_STATUS_REPOSITORY',
    'REGISTRO_ARCHIVOS_REPOSITORY',
    'REGISTROS_SFTP_REPOSITORY',
    'BATCH_CALL_EXPORTS_REPOSITORY',
  ],
})
export class DatabaseModule {}
