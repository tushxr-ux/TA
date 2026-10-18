import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// ponytail: no DB table for push subscriptions yet — stored in devices.push_token (already exists)
// This endpoint just acknowledges for now; wired to Device entity in Phase 1.6
@Controller('push')
@UseGuards(AuthGuard('jwt'))
export class PushController {
  @Post('subscribe')
  subscribe(@Request() req: any, @Body() body: { subscription: object }) {
    // TODO Phase 1.6: upsert body.subscription JSON into devices.push_token for req.user.userId
    return { ok: true };
  }

  vapidPublicKey() {
    return { key: process.env.VAPID_PUBLIC_KEY };
  }
}
