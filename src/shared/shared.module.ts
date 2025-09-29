import { Module } from '@nestjs/common';
import { JwtStrategy } from './guards/jwt.strategy';
import { CsrfService } from './services/csrf.service';
import { CoreModule } from 'src/core/core.module';
import { ExcelCsvProcessor } from './services/excel-csv-processor.service';

@Module({
  imports: [CoreModule],
  providers: [JwtStrategy, CsrfService, ExcelCsvProcessor],
  exports: [JwtStrategy, CsrfService, ExcelCsvProcessor],
})
export class SharedModule {}
