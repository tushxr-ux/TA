import { Controller, Post, Get, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString } from 'class-validator';
import { ContactsService } from './contacts.service';

class RequestByCodeDto { @IsString() code: string; }

@Controller('contacts')
@UseGuards(AuthGuard('jwt'))
export class ContactsController {
  constructor(private svc: ContactsService) {}

  @Post('request')
  request(@Request() req: any, @Body() dto: RequestByCodeDto) {
    return this.svc.requestByCode(req.user.userId, dto.code);
  }

  @Get('requests')
  getRequests(@Request() req: any) {
    return this.svc.getRequests(req.user.userId);
  }

  @Post('requests/:id/accept')
  accept(@Param('id') id: string, @Request() req: any) {
    return this.svc.acceptRequest(id, req.user.userId);
  }

  @Post('requests/:id/reject')
  reject(@Param('id') id: string, @Request() req: any) {
    return this.svc.rejectRequest(id, req.user.userId);
  }

  @Get()
  list(@Request() req: any) {
    return this.svc.listContacts(req.user.userId);
  }

  @Post(':id/block')
  block(@Param('id') id: string, @Request() req: any) {
    return this.svc.block(req.user.userId, id);
  }

  @Post(':id/unblock')
  unblock(@Param('id') id: string, @Request() req: any) {
    return this.svc.unblock(req.user.userId, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.svc.remove(req.user.userId, id);
  }
}
