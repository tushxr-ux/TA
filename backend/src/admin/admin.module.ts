import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InviteCode } from './invite-code.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([InviteCode])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
