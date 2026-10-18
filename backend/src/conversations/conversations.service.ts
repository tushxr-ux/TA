import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Conversation, ConversationMember } from './conversations.entities';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation) private convs: Repository<Conversation>,
    @InjectRepository(ConversationMember) private members: Repository<ConversationMember>,
  ) {}

  /** List conversations for user with partner info, last message, and unread count */
  async list(userId: string) {
    return this.convs.query(`
      SELECT
        c.id,
        c.type,
        c.created_at,
        partner.id AS partner_id,
        partner.display_name AS partner_name,
        partner.username AS partner_username,
        partner.last_seen_at AS partner_last_seen,
        (
          SELECT json_build_object(
            'id', m.id,
            'senderId', m.sender_id,
            'type', m.type,
            'body', encode(m.body, 'escape'),
            'createdAt', m.created_at
          )
          FROM messages m
          WHERE m.conversation_id = c.id AND m.deleted_for_all = false
          ORDER BY m.created_at DESC LIMIT 1
        ) AS last_message,
        (
          SELECT COUNT(*)::int
          FROM messages m
          LEFT JOIN message_receipts r ON r.message_id = m.id AND r.user_id = $1
          WHERE m.conversation_id = c.id
            AND m.deleted_for_all = false
            AND m.sender_id != $1
            AND r.read_at IS NULL
        ) AS unread_count
      FROM conversations c
      JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
      LEFT JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id != $1
      LEFT JOIN users partner ON partner.id = cm2.user_id
      WHERE cm.archived = false
      ORDER BY (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) DESC NULLS LAST
    `, [userId]);
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
    return this.convs.query(`
      SELECT m.*
      FROM messages m
      JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = $1
      WHERE m.created_at > $2
        AND m.deleted_for_all = false
      ORDER BY m.created_at ASC
      LIMIT 200
    `, [userId, since]);
  }
}
