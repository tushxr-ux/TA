import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Conversation, ConversationMember } from './conversations.entities';
import { User } from '../users/user.entity';
import { Message } from '../messages/message.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation) private convs: Repository<Conversation>,
    @InjectRepository(ConversationMember) private members: Repository<ConversationMember>,
    private ds: DataSource,
  ) {}

  /** List conversations for user with partner info, last message, and unread count */
  async list(userId: string) {
    const memberships = await this.members.find({ where: { userId, archived: false } });
    if (!memberships.length) return [];

    const convIds = memberships.map(m => m.conversationId);
    const allMembers = await this.members.find({ where: { conversationId: In(convIds) } });
    const partnerUserIds = allMembers.filter(m => m.userId !== userId).map(m => m.userId);

    const partnerUsers = partnerUserIds.length > 0
      ? await this.ds.getRepository(User).find({ where: { id: In(partnerUserIds) } })
      : [];
    const partnerMap = new Map(partnerUsers.map(u => [u.id, u]));

    const convMapPartner = new Map<string, string>();
    for (const m of allMembers) {
      if (m.userId !== userId) {
        convMapPartner.set(m.conversationId, m.userId);
      }
    }

    const result = [];
    for (const convId of convIds) {
      const partnerId = convMapPartner.get(convId);
      const partner = partnerId ? partnerMap.get(partnerId) : null;

      const lastMsg = await this.ds.getRepository(Message).createQueryBuilder('m')
        .where('m.conversationId = :cid', { cid: convId })
        .andWhere('(m.deletedForAll = false OR m.deletedForAll IS NULL)')
        .orderBy('m.createdAt', 'DESC')
        .getOne();

      let bodyStr = '';
      if (lastMsg?.body) {
        if (Buffer.isBuffer(lastMsg.body)) {
          bodyStr = lastMsg.body.toString('utf8');
        } else if (typeof lastMsg.body === 'object' && Array.isArray((lastMsg.body as any).data)) {
          bodyStr = Buffer.from((lastMsg.body as any).data).toString('utf8');
        } else {
          bodyStr = String(lastMsg.body);
        }
      }

      result.push({
        id: convId,
        type: 'direct',
        partner_id: partnerId,
        partner_name: partner?.displayName || partner?.username || 'Chat',
        partner_username: partner?.username,
        partner_last_seen: partner?.lastSeenAt,
        last_message: lastMsg ? {
          id: lastMsg.id,
          senderId: lastMsg.senderId,
          type: lastMsg.type,
          body: bodyStr,
          createdAt: lastMsg.createdAt,
        } : null,
        unread_count: 0,
      });
    }

    return result.sort((a, b) => {
      const tA = a.last_message?.createdAt ? new Date(a.last_message.createdAt).getTime() : 0;
      const tB = b.last_message?.createdAt ? new Date(b.last_message.createdAt).getTime() : 0;
      return tB - tA;
    });
  }

  /** Find existing 1:1 conversation or create a new direct conversation */
  async findOrCreateDirect(userA: string, userB: string) {
    const myMemberships = await this.members.find({ where: { userId: userA } });
    if (myMemberships.length > 0) {
      const convIds = myMemberships.map(m => m.conversationId);
      const shared = await this.members.findOne({
        where: {
          conversationId: In(convIds),
          userId: userB,
        },
      });
      if (shared) {
        return { id: shared.conversationId, type: 'direct' };
      }
    }
    return this.createDirect(userA, userB);
  }

  /** Create a 1:1 conversation between two users */
  async createDirect(userA: string, userB: string) {
    const conv = await this.convs.save(this.convs.create({ type: 'direct', createdBy: userA }));
    await this.members.save([
      this.members.create({ conversationId: conv.id, userId: userA }),
      this.members.create({ conversationId: conv.id, userId: userB }),
    ]);
    return conv;
  }

  /** Sync endpoint — missed events since a cursor timestamp */
  async sync(userId: string, since: string) {
    const memberships = await this.members.find({ where: { userId } });
    if (!memberships.length) return [];
    const convIds = memberships.map(m => m.conversationId);
    return this.ds.getRepository(Message).createQueryBuilder('m')
      .where('m.conversationId IN (:...convIds)', { convIds })
      .andWhere('(m.deletedForAll = false OR m.deletedForAll IS NULL)')
      .orderBy('m.createdAt', 'ASC')
      .getMany();
  }
}
