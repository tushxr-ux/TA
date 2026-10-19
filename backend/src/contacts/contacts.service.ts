import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { createHash } from 'crypto';
import { ContactRequest, Contact } from './contact.entity';
import { User } from '../users/user.entity';
import { ChatGateway } from '../gateway/chat.gateway';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(ContactRequest) private requests: Repository<ContactRequest>,
    @InjectRepository(Contact) private contacts: Repository<Contact>,
    @InjectRepository(User) private users: Repository<User>,
    private gateway: ChatGateway,
    private ds: DataSource,
  ) {}

  private sha256(val: string) {
    return createHash('sha256').update(val.toUpperCase()).digest('hex');
  }

  /** Submit a contact request using the other user's personal code or username */
  async requestByCode(fromUserId: string, code: string) {
    const raw = (code || '').trim();
    if (!raw) {
      throw new BadRequestException({ error: { code: 'INVALID_CODE', message: 'Please enter a secret code or username' } });
    }

    const hash = this.sha256(raw);
    let target = await this.users.findOne({ where: { contactCodeHash: hash, isActive: true } });

    // Also support finding by username (with or without @)
    if (!target) {
      const cleanUsername = raw.replace(/^@/, '').toLowerCase();
      target = await this.users.createQueryBuilder('u')
        .where('LOWER(u.username) = :uname AND u.isActive = true', { uname: cleanUsername })
        .getOne();
    }

    if (!target) {
      throw new BadRequestException({ error: { code: 'INVALID_CODE', message: 'User or secret code not found' } });
    }
    if (target.id === fromUserId) {
      throw new BadRequestException({ error: { code: 'SELF_REQUEST', message: 'Cannot add yourself' } });
    }

    // Already contacts?
    const already = await this.contacts.findOne({ where: { userId: fromUserId, contactId: target.id } });
    if (already && !already.blocked) {
      throw new BadRequestException({ error: { code: 'ALREADY_CONTACTS', message: 'Already connected as contacts' } });
    }

    // If target user already sent a pending request to fromUserId, automatically accept it!
    const inverse = await this.requests.findOne({ where: { fromUserId: target.id, toUserId: fromUserId, status: 'pending' } });
    if (inverse) {
      await this.acceptRequest(inverse.id, fromUserId);
      return {
        requestId: inverse.id,
        status: 'accepted',
        autoAccepted: true,
        targetName: target.displayName || target.username,
        targetUsername: target.username,
      };
    }

    // Upsert request
    const existing = await this.requests.findOne({ where: { fromUserId, toUserId: target.id } });
    if (existing) {
      await this.requests.update(existing.id, { status: 'pending' });
      const sender = await this.users.findOne({ where: { id: fromUserId } });
      this.gateway?.notifyUser?.(target.id, 'contact:request', {
        requestId: existing.id,
        fromUserId,
        fromName: sender?.displayName || sender?.username || 'Someone',
        fromUsername: sender?.username,
      });
      return {
        requestId: existing.id,
        status: 'pending',
        targetName: target.displayName || target.username,
        targetUsername: target.username,
      };
    }

    const req = this.requests.create({ fromUserId, toUserId: target.id });
    await this.requests.save(req);
    const sender = await this.users.findOne({ where: { id: fromUserId } });
    this.gateway?.notifyUser?.(target.id, 'contact:request', {
      requestId: req.id,
      fromUserId,
      fromName: sender?.displayName || sender?.username || 'Someone',
      fromUsername: sender?.username,
    });
    return {
      requestId: req.id,
      status: 'pending',
      targetName: target.displayName || target.username,
      targetUsername: target.username,
    };
  }

  async getRequests(userId: string) {
    const list = await this.requests.find({
      where: [
        { toUserId: userId, status: 'pending' },
      ],
      order: { createdAt: 'DESC' },
    });
    if (!list.length) return [];
    const fromIds = list.map(r => r.fromUserId);
    const users = await this.users.find({ where: { id: In(fromIds) } });
    const userMap = new Map(users.map(u => [u.id, u]));

    return list.map(r => {
      const u = userMap.get(r.fromUserId);
      return {
        ...r,
        fromName: u?.displayName || u?.username || 'Partner',
        fromUsername: u?.username,
      };
    });
  }

  async acceptRequest(requestId: string, userId: string) {
    const req = await this.requests.findOne({ where: { id: requestId, toUserId: userId, status: 'pending' } });
    if (!req) throw new NotFoundException();

    await this.ds.transaction(async em => {
      await em.update(ContactRequest, requestId, { status: 'accepted' });
      // Create bidirectional contact rows
      await em.upsert(Contact, [
        { userId: req.toUserId, contactId: req.fromUserId },
        { userId: req.fromUserId, contactId: req.toUserId },
      ], ['userId', 'contactId']);

      // Ensure a direct conversation exists between the two users
      const existingConv = await em.query(`
        SELECT cm1.conversation_id FROM conversation_members cm1
        JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
        WHERE cm1.user_id = $1 AND cm2.user_id = $2
        LIMIT 1
      `, [req.toUserId, req.fromUserId]);

      if (!existingConv || existingConv.length === 0) {
        const convRes = await em.query(`
          INSERT INTO conversations (type, created_by)
          VALUES ('direct', $1)
          RETURNING id
        `, [req.toUserId]);
        if (convRes && convRes[0]?.id) {
          await em.query(`
            INSERT INTO conversation_members (conversation_id, user_id)
            VALUES ($1, $2), ($1, $3)
          `, [convRes[0].id, req.toUserId, req.fromUserId]);
        }
      }
    });

    this.gateway?.notifyUser?.(req.fromUserId, 'contact:accepted', { byUserId: userId });

    return { accepted: true };
  }

  async rejectRequest(requestId: string, userId: string) {
    await this.requests.update({ id: requestId, toUserId: userId }, { status: 'rejected' });
    return { rejected: true };
  }

  async listContacts(userId: string) {
    const list = await this.contacts.find({ where: { userId, blocked: false } });
    if (!list.length) return [];
    const contactIds = list.map(c => c.contactId);
    const users = await this.users.find({ where: { id: In(contactIds) } });
    const userMap = new Map(users.map(u => [u.id, u]));
    return list.map(c => {
      const u = userMap.get(c.contactId);
      return {
        ...c,
        displayName: c.nickname || u?.displayName || u?.username || 'Contact',
        username: u?.username,
        lastSeenAt: u?.lastSeenAt,
      };
    });
  }

  async block(userId: string, contactId: string) {
    await this.contacts.update({ userId, contactId }, { blocked: true });
    return { blocked: true };
  }

  async unblock(userId: string, contactId: string) {
    await this.contacts.update({ userId, contactId }, { blocked: false });
    return { blocked: false };
  }

  async remove(userId: string, contactId: string) {
    await this.contacts.delete({ userId, contactId });
    await this.contacts.delete({ userId: contactId, contactId: userId });
  }
}
