import { Module } from '@nestjs/common';
import { BachcallsController } from './bachcalls.controller';
import { BachcallsService } from './bachcalls.service';
import { SharedModule } from 'src/shared/shared.module';
import { CoreModule } from 'src/core/core.module';

@Module({
  imports: [SharedModule, CoreModule],
  controllers: [BachcallsController],
  providers: [BachcallsService],
  exports: [BachcallsService],
})
export class BachcallsModule {}
