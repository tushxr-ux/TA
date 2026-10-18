import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';

@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);

  private get ready() {
    return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  }

  async send(subscriptionJson: string, title: string, body: string, data?: Record<string, unknown>) {
    if (!subscriptionJson || !this.ready) return;
    // Configure lazily so missing keys don't crash on startup
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    try {
      const sub = JSON.parse(subscriptionJson);
      await webpush.sendNotification(sub, JSON.stringify({ title, body, data }));
    } catch (err) {
      this.log.warn(`Push failed: ${(err as Error).message}`);
    }
  }
}
