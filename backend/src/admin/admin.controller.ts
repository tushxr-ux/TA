import { Controller, Post, Get, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(private svc: AdminService) {}

  @Post('invites')
  create(@Request() req: any, @Body() body: { maxUses?: number; expiresAt?: string }) {
    return this.svc.createInvite(req.user.userId, body.maxUses, body.expiresAt ? new Date(body.expiresAt) : undefined);
  }

  @Get('invites')
  list() {
    return this.svc.listInvites();
  }

  @Delete('invites/:id')
  revoke(@Param('id') id: string) {
    return this.svc.revokeInvite(id);
  }
}
