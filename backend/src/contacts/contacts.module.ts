import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactRequest, Contact } from './contact.entity';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { User } from '../users/user.entity';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [TypeOrmModule.forFeature([ContactRequest, Contact, User]), GatewayModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
