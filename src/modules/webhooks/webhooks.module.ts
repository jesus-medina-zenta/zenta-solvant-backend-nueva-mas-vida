import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { DatabaseModule } from 'src/core/database/database.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [DatabaseModule, ConversationsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
