import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { DatabaseModule } from 'src/core/database/database.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { CoreModule } from 'src/core/core.module';
import { SharedModule } from 'src/shared/shared.module';

@Module({
  imports: [DatabaseModule, ConversationsModule, CoreModule, SharedModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
