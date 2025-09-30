import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './guards/jwt.strategy';
import { CsrfService } from './services/csrf.service';
import { CoreModule } from 'src/core/core.module';
import { ExcelCsvProcessor } from './services/excel-csv-processor.service';
import { GcpPipelineService } from './services/gcp-pipeline.service';

@Module({
  imports: [CoreModule, ConfigModule],
  providers: [JwtStrategy, CsrfService, ExcelCsvProcessor, GcpPipelineService],
  exports: [JwtStrategy, CsrfService, ExcelCsvProcessor, GcpPipelineService],
})
export class SharedModule {}
