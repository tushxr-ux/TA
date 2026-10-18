import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, ConversationMember } from './conversations.entities';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation) private convs: Repository<Conversation>,
    @InjectRepository(ConversationMember) private members: Repository<ConversationMember>,
  ) {}

  /** List conversations for user with last message + unread count (raw SQL for efficiency) */
  async list(userId: string) {
    return this.convs.query(`
      SELECT
        c.id,
        c.type,
        c.created_at,
        (
          SELECT row_to_json(m)
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
      WHERE cm.archived = false
      ORDER BY (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) DESC NULLS LAST
    `, [userId]);
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
