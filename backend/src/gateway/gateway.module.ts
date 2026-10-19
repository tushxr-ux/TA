import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway';
import { Message } from '../messages/message.entity';
import { ConversationMember } from '../conversations/conversations.entities';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message, ConversationMember]), RedisModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewayModule {}
