import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { validate } from './config/validation';
import { DatabaseModule } from './database/database.module';
import { IntegrationModule } from './integration/integration.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      expandVariables: true,
    }),
    DatabaseModule,
    IntegrationModule,
    StorageModule,
  ],
  providers: [],
  exports: [DatabaseModule, IntegrationModule, StorageModule],
})
export class CoreModule {}
