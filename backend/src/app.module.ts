import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContactsModule } from './contacts/contacts.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { MediaModule } from './media/media.module';
import { GatewayModule } from './gateway/gateway.module';
import { AdminModule } from './admin/admin.module';
import { PushModule } from './push/push.module';
import { RedisModule } from './redis/redis.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: true, // auto-sync schema
      ssl: process.env.DATABASE_URL?.includes('sslmode=require') || process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    ScheduleModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    RedisModule,
    AuthModule,
    UsersModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    MediaModule,
    GatewayModule,
    AdminModule,
    PushModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
