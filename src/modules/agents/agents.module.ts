import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { SharedModule } from 'src/shared/shared.module';
import { CoreModule } from 'src/core/core.module';

@Module({
  imports: [SharedModule, CoreModule],
  controllers: [AgentsController],
  providers: [AgentsService],
})
export class AgentsModule {}
