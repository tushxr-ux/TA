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
import { ConversationMember } from '../conversations/conversations.entities';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private jwt: JwtService,
    @InjectRepository(Message) private msgs: Repository<Message>,
    @InjectRepository(ConversationMember) private members: Repository<ConversationMember>,
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

      // Auto-join all existing conversation rooms for this user
      try {
        const userConvs = await this.members.find({ where: { userId: payload.sub } });
        for (const c of userConvs) {
          await socket.join(c.conversationId);
        }
      } catch {}

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

  @SubscribeMessage('presence:check')
  async onPresenceCheck(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (data?.userId) {
      const isOnline = await this.redis.get(`presence:${data.userId}`);
      socket.emit('presence', { userId: data.userId, online: Boolean(isOnline) });
    }
  }

  @SubscribeMessage('conversation:join')
  async onJoinConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      await socket.join(data.conversationId);
    }
  }

  @SubscribeMessage('conversation:leave')
  async onLeaveConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      await socket.leave(data.conversationId);
    }
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
      deletedForAll: false,
    });
    await this.msgs.save(msg);

    // Ack to sender
    socket.emit('message:ack', { clientMsgId: data.clientMsgId, messageId: msg.id, createdAt: msg.createdAt });

    // Push to conversation room (all members)
    socket.to(data.conversationId).emit('message:new', {
      ...msg,
      body: data.body, // send as string; E2EE ciphertext in Phase 2
    });

    // Also push directly to recipient personal room to guarantee delivery
    try {
      const convMembers = await this.members.find({ where: { conversationId: data.conversationId } });
      for (const m of convMembers) {
        if (m.userId !== socket.data.userId) {
          this.server.to(m.userId).emit('message:new', {
            ...msg,
            body: data.body,
          });
        }
      }
    } catch {}
  }

  @SubscribeMessage('message:delete')
  async onMessageDelete(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; messageId: string; scope: 'me' | 'all' },
  ) {
    if (data?.scope === 'all' && data?.messageId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.messageId);
      if (isUuid) {
        await this.msgs.update({ id: data.messageId, senderId: socket.data.userId }, { deletedForAll: true });
      } else {
        await this.msgs.update({ clientMsgId: data.messageId, senderId: socket.data.userId }, { deletedForAll: true });
      }
      this.server.to(data.conversationId).emit('message:deleted', { messageId: data.messageId });
    }
  }

  @SubscribeMessage('message:react')
  async onMessageReact(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; messageId: string; emoji: string },
  ) {
    if (data?.conversationId && data?.messageId) {
      const userId = socket.data.userId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.messageId);
      const msg = isUuid
        ? await this.msgs.findOne({ where: { id: data.messageId } })
        : await this.msgs.findOne({ where: { clientMsgId: data.messageId } });

      const currentReactions: Record<string, string> = { ...(msg?.reactions || {}) };

      if (data.emoji) {
        if (currentReactions[userId] === data.emoji) {
          delete currentReactions[userId];
        } else {
          currentReactions[userId] = data.emoji;
        }
      } else {
        delete currentReactions[userId];
      }

      if (msg) {
        await this.msgs.update({ id: msg.id }, { reactions: currentReactions });
      }

      this.server.to(data.conversationId).emit('message:reacted', {
        messageId: data.messageId,
        userId,
        emoji: currentReactions[userId] || null,
        reactions: currentReactions,
      });
    }
  }

  @SubscribeMessage('message:edit')
  async onMessageEdit(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; messageId: string; body: string },
  ) {
    if (data?.conversationId && data?.messageId && typeof data?.body === 'string') {
      const now = new Date();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.messageId);
      if (isUuid) {
        await this.msgs.update(
          { id: data.messageId, senderId: socket.data.userId },
          { body: Buffer.from(data.body, 'utf8'), editedAt: now },
        );
      } else {
        await this.msgs.update(
          { clientMsgId: data.messageId, senderId: socket.data.userId },
          { body: Buffer.from(data.body, 'utf8'), editedAt: now },
        );
      }
      this.server.to(data.conversationId).emit('message:edited', {
        messageId: data.messageId,
        body: data.body,
        editedAt: now.toISOString(),
      });
    }
  }

  @SubscribeMessage('message:delivered')
  async onDelivered(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const userId = socket.data.userId as string;
    if (!data?.messageId) return;
    await this.redis.hset(`receipt:${data.messageId}`, userId, 'delivered');
    const msg = await this.msgs.findOne({ where: { id: data.messageId } });
    if (msg && msg.senderId !== userId) {
      if (msg.status !== 'read') {
        await this.msgs.update({ id: data.messageId }, { status: 'delivered' });
      }
      this.server.to(msg.senderId).emit('message:status', {
        messageId: data.messageId,
        userId,
        status: 'delivered',
      });
    }
  }

  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; upToMessageId: string },
  ) {
    const userId = socket.data.userId as string;
    if (!data?.upToMessageId || !data?.conversationId) return;
    await this.redis.hset(`receipt:${data.upToMessageId}`, userId, 'read');
    const targetMsg = await this.msgs.findOne({ where: { id: data.upToMessageId } });
    if (targetMsg && targetMsg.senderId !== userId) {
      await this.msgs.createQueryBuilder()
        .update(Message)
        .set({ status: 'read' })
        .where('conversationId = :cid', { cid: data.conversationId })
        .andWhere('senderId = :partnerId', { partnerId: targetMsg.senderId })
        .andWhere('createdAt <= :upTo', { upTo: targetMsg.createdAt })
        .execute();

      this.server.to(targetMsg.senderId).emit('message:status', {
        messageId: data.upToMessageId,
        conversationId: data.conversationId,
        userId,
        status: 'read',
      });
    }
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

  notifyUser(userId: string, event: string, data: any) {
    this.server.to(userId).emit(event, data);
  }
}
