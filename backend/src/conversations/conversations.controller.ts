import { Controller, Get, Post, Param, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConversationsService } from './conversations.service';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class ConversationsController {
  constructor(private svc: ConversationsService) {}

  @Get('conversations')
  async list(@Request() req: any) {
    try {
      return await this.svc.list(req.user.userId);
    } catch (err: any) {
      return { error: err?.message, detail: err?.detail };
    }
  }

  @Post('conversations/direct/:targetUserId')
  getOrCreateDirect(@Request() req: any, @Param('targetUserId') targetUserId: string) {
    return this.svc.findOrCreateDirect(req.user.userId, targetUserId);
  }

  @Get('sync')
  sync(@Request() req: any, @Query('since') since: string) {
    return this.svc.sync(req.user.userId, since ?? new Date(0).toISOString());
  }
}
