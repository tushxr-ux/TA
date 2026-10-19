import { Controller, Get, Delete, Patch, Query, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService } from './messages.service';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(private msgs: MessagesService) {}

  @Get('conversations/:id/messages')
  getHistory(
    @Param('id') convId: string,
    @Request() req: { user: { userId: string } },
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.msgs.getHistory(convId, req.user.userId, before, limit ? +limit : 40);
  }

  /** Storage estimate for date range — called when user picks dates */
  @Get('conversations/:id/messages/size')
  getSizeEstimate(
    @Param('id') convId: string,
    @Request() req: { user: { userId: string } },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.msgs.getSizeEstimate(convId, req.user.userId, from, to);
  }

  /** Bulk delete by date range with optional media deletion */
  @Delete('conversations/:id/messages')
  deleteRange(
    @Param('id') convId: string,
    @Request() req: { user: { userId: string } },
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('deleteMedia') deleteMedia: string,
  ) {
    return this.msgs.deleteRange(convId, req.user.userId, from, to, deleteMedia === 'true');
  }

  /** Single message delete */
  @Delete('messages/:id')
  deleteOne(
    @Param('id') msgId: string,
    @Request() req: { user: { userId: string } },
    @Query('scope') scope: 'me' | 'all' = 'me',
  ) {
    return this.msgs.deleteOne(msgId, req.user.userId, scope);
  }

  /** Single message edit */
  @Patch('messages/:id')
  editOne(
    @Param('id') msgId: string,
    @Request() req: { user: { userId: string } },
    @Body('body') body: string,
  ) {
    return this.msgs.editOne(msgId, req.user.userId, body);
  }
}
