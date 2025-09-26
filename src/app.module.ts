import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './auth/auth.module';
import { GenericsModule } from './modules/generics/generics.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { BachcallsModule } from './modules/bachcalls/bachcalls.module';

@Module({
  imports: [
    CoreModule,
    SharedModule,
    AuthModule,
    UsersModule,
    GenericsModule,
    AgentsModule,
    ConversationsModule,
    WebhooksModule,
    BachcallsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
