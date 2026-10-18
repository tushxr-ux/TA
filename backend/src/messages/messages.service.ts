import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Message } from './message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private msgs: Repository<Message>,
    private ds: DataSource,
  ) {}

  /** History — cursor paginated, chronological order, clean string body */
  async getHistory(conversationId: string, userId: string, before?: string, limit = 50) {
    const qb = this.msgs.createQueryBuilder('m')
      .where('m.conversationId = :cid', { cid: conversationId })
      .andWhere('m.deletedForAll = false')
      .orderBy('m.createdAt', 'DESC')
      .take(Math.min(limit, 100));

    if (before) qb.andWhere('m.createdAt < :before', { before });
    const list = await qb.getMany();
    return list.reverse().map(m => {
      let bodyStr = '';
      if (m.body) {
        if (Buffer.isBuffer(m.body)) {
          bodyStr = m.body.toString('utf8');
        } else if (typeof m.body === 'object' && Array.isArray((m.body as any).data)) {
          bodyStr = Buffer.from((m.body as any).data).toString('utf8');
        } else {
          bodyStr = String(m.body);
        }
      }
      return {
        ...m,
        body: bodyStr,
      };
    });
  }

  /** Storage estimate for a date range */
  async getSizeEstimate(conversationId: string, userId: string, from: string, to: string) {
    const result = await this.ds.query<[{ count: string; bytes: string }]>(`
      SELECT COUNT(m.id)::text AS count,
             COALESCE(SUM(med.size_bytes), 0)::text AS bytes
      FROM   messages m
      LEFT JOIN media med ON med.id::text = m.media_id::text
      WHERE  m.conversation_id = $1
        AND  m.created_at >= $2::date
        AND  m.created_at <  ($3::date + INTERVAL '1 day')
        AND  m.deleted_for_all = false
    `, [conversationId, from, to]);

    return { count: Number(result[0].count), bytes: Number(result[0].bytes) };
  }

  /** Delete messages in range, optionally including media */
  async deleteRange(
    conversationId: string,
    userId: string,
    from: string,
    to: string,
    deleteMedia: boolean,
  ) {
    return this.ds.transaction(async (em) => {
      // Get messages to delete (only those the user is allowed to delete)
      const messages = await em.query<{ id: string; media_id: string | null }[]>(`
        SELECT m.id, m.media_id
        FROM   messages m
        WHERE  m.conversation_id = $1
          AND  m.created_at >= $2::date
          AND  m.created_at <  ($3::date + INTERVAL '1 day')
          AND  m.deleted_for_all = false
      `, [conversationId, from, to]);

      if (messages.length === 0) return { deletedCount: 0, freedBytes: 0 };

      const ids = messages.map(m => m.id);

      // Collect media size before delete
      let freedBytes = 0;
      const mediaIds = messages.map(m => m.media_id).filter(Boolean) as string[];

      if (mediaIds.length > 0) {
        const sizeResult = await em.query<[{ total: string }]>(
          `SELECT COALESCE(SUM(size_bytes), 0)::text AS total FROM media WHERE id = ANY($1::uuid[])`,
          [mediaIds],
        );
        freedBytes = Number(sizeResult[0].total);

        if (deleteMedia) {
          // ponytail: Cloudinary delete is handled async by a cleanup job — not blocking the HTTP response
          await em.query(`DELETE FROM media WHERE id = ANY($1::uuid[])`, [mediaIds]);
        }
      }

      // Soft-delete by marking deletedForAll (keeps receipts intact for the other party)
      await em.query(
        `UPDATE messages SET deleted_for_all = true WHERE id = ANY($1::uuid[])`,
        [ids],
      );

      return { deletedCount: ids.length, freedBytes };
    });
  }

  /** Single message delete */
  async deleteOne(messageId: string, userId: string, scope: 'me' | 'all') {
    if (scope === 'all') {
      await this.msgs.update({ id: messageId, senderId: userId }, { deletedForAll: true });
    }
    // "me" scope: client hides it locally — no server action needed for E2EE model
  }
}
