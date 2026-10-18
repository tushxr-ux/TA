import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { Message } from '../messages/message.entity';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
  transports: ['websocket'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private jwt: JwtService,
    @InjectRepository(Message) private msgs: Repository<Message>,
    @Inject('REDIS') private redis: InstanceType<typeof Redis>,
  ) {}

  // ── Connection lifecycle ──────────────────────────────────────────────────

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token as string;
      const payload = this.jwt.verify<{ sub: string }>(token);
      socket.data.userId = payload.sub;

      // Join personal room so we can push events to this user from anywhere
      await socket.join(payload.sub);

      // Mark online in Redis (60s TTL; client heartbeats keep it alive)
      await this.redis.setex(`presence:${payload.sub}`, 60, '1');
      await this.redis.sadd(`sockets:${payload.sub}`, socket.id);

      // Notify partner
      this.broadcastPresence(payload.sub, true);
    } catch {
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    await this.redis.srem(`sockets:${userId}`, socket.id);
    const remaining = await this.redis.scard(`sockets:${userId}`);

    if (remaining === 0) {
      await this.redis.del(`presence:${userId}`);
      await this.broadcastPresence(userId, false);
    }
  }

  private async broadcastPresence(userId: string, online: boolean) {
    this.server.emit('presence', { userId, online, lastSeen: new Date() });
  }

  // ── Heartbeat (client pings every 30s to keep presence alive) ─────────────

  @SubscribeMessage('presence:update')
  async onPresenceUpdate(@ConnectedSocket() socket: Socket) {
    const userId = socket.data.userId as string;
    await this.redis.setex(`presence:${userId}`, 60, '1');
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  @SubscribeMessage('message:send')
  async onMessageSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: {
      conversationId: string;
      clientMsgId: string;
      type?: string;
      body?: string;
      mediaId?: string;
      replyTo?: string;
    },
  ) {
    const senderId = socket.data.userId as string;

    // Save message
    const msg = this.msgs.create({
      conversationId: data.conversationId,
      senderId,
      clientMsgId: data.clientMsgId,
      type: data.type ?? 'text',
      body: data.body ? Buffer.from(data.body) : undefined,
      mediaId: data.mediaId,
      replyTo: data.replyTo,
    });
    await this.msgs.save(msg);

    // Ack to sender
    socket.emit('message:ack', { clientMsgId: data.clientMsgId, messageId: msg.id, createdAt: msg.createdAt });

    // Push to conversation room (all members)
    socket.to(data.conversationId).emit('message:new', {
      ...msg,
      body: data.body, // send as string; E2EE ciphertext in Phase 2
    });

    // ponytail: push notification for offline users handled in PushService — called from here in Phase 1.6
  }

  @SubscribeMessage('message:delivered')
  async onDelivered(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const userId = socket.data.userId as string;
    await this.redis.hset(`receipt:${data.messageId}`, userId, 'delivered');
    this.server.emit('message:status', { messageId: data.messageId, userId, status: 'delivered' });
  }

  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; upToMessageId: string },
  ) {
    const userId = socket.data.userId as string;
    await this.redis.hset(`receipt:${data.upToMessageId}`, userId, 'read');
    this.server.to(data.conversationId).emit('message:status', {
      messageId: data.upToMessageId,
      userId,
      status: 'read',
    });
  }

  // ── Typing ────────────────────────────────────────────────────────────────

  @SubscribeMessage('typing:start')
  async onTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = socket.data.userId as string;
    await this.redis.setex(`typing:${data.conversationId}:${userId}`, 5, '1');
    socket.to(data.conversationId).emit('typing', { conversationId: data.conversationId, userId, isTyping: true });
  }

  @SubscribeMessage('typing:stop')
  async onTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = socket.data.userId as string;
    await this.redis.del(`typing:${data.conversationId}:${userId}`);
    socket.to(data.conversationId).emit('typing', { conversationId: data.conversationId, userId, isTyping: false });
  }

  // ── Screen sharing signaling (pure relay — no video data) ─────────────────

  @SubscribeMessage('screen:request')
  onScreenRequest(@ConnectedSocket() socket: Socket, @MessageBody() data: { sessionId: string; to: string }) {
    this.server.to(data.to).emit('screen:requested', { sessionId: data.sessionId, from: socket.data.userId });
  }

  @SubscribeMessage('screen:accept')
  onScreenAccept(@ConnectedSocket() socket: Socket, @MessageBody() data: { sessionId: string; to: string }) {
    this.server.to(data.to).emit('screen:accepted', { sessionId: data.sessionId });
  }

  @SubscribeMessage('screen:decline')
  onScreenDecline(@ConnectedSocket() socket: Socket, @MessageBody() data: { sessionId: string; to: string }) {
    this.server.to(data.to).emit('screen:declined', { sessionId: data.sessionId });
  }

  @SubscribeMessage('screen:offer')
  onScreenOffer(@ConnectedSocket() socket: Socket, @MessageBody() data: { sessionId: string; to: string; sdp: string }) {
    this.server.to(data.to).emit('screen:signal', { type: 'offer', data: data.sdp, sessionId: data.sessionId });
  }

  @SubscribeMessage('screen:answer')
  onScreenAnswer(@ConnectedSocket() socket: Socket, @MessageBody() data: { sessionId: string; to: string; sdp: string }) {
    this.server.to(data.to).emit('screen:signal', { type: 'answer', data: data.sdp, sessionId: data.sessionId });
  }

  @SubscribeMessage('screen:ice')
  onScreenIce(@ConnectedSocket() socket: Socket, @MessageBody() data: { sessionId: string; to: string; candidate: unknown }) {
    this.server.to(data.to).emit('screen:signal', { type: 'ice', data: data.candidate, sessionId: data.sessionId });
  }

  @SubscribeMessage('screen:end')
  onScreenEnd(@ConnectedSocket() socket: Socket, @MessageBody() data: { sessionId: string; to: string }) {
    this.server.to(data.to).emit('screen:ended', { sessionId: data.sessionId, reason: 'user' });
  }

  // ── Helper: join a room (called when contact accepted / conversation created) ─
  joinRoom(userId: string, roomId: string) {
    const sockets = this.server.in(userId).fetchSockets();
    sockets.then(ss => ss.forEach(s => s.join(roomId)));
  }
}
