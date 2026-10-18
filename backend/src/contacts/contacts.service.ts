import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { createHash } from 'crypto';
import { ContactRequest, Contact } from './contact.entity';
import { User } from '../users/user.entity';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(ContactRequest) private requests: Repository<ContactRequest>,
    @InjectRepository(Contact) private contacts: Repository<Contact>,
    @InjectRepository(User) private users: Repository<User>,
    private ds: DataSource,
  ) {}

  private sha256(val: string) {
    return createHash('sha256').update(val.toUpperCase()).digest('hex');
  }

  /** Submit a contact request using the other user's personal code */
  async requestByCode(fromUserId: string, code: string) {
    const hash = this.sha256(code);
    const target = await this.users.findOne({ where: { contactCodeHash: hash, isActive: true } });

    // Generic error — never reveal whether code exists (SECURITY.md §4)
    if (!target) throw new BadRequestException({ error: { code: 'INVALID_CODE', message: 'Invalid or expired code' } });
    if (target.id === fromUserId) throw new BadRequestException({ error: { code: 'SELF_REQUEST', message: 'Cannot add yourself' } });

    // Already contacts?
    const already = await this.contacts.findOne({ where: { userId: fromUserId, contactId: target.id } });
    if (already && !already.blocked) throw new BadRequestException({ error: { code: 'ALREADY_CONTACTS', message: 'Already contacts' } });

    // Upsert request
    const existing = await this.requests.findOne({ where: { fromUserId, toUserId: target.id } });
    if (existing) {
      await this.requests.update(existing.id, { status: 'pending' });
      return { requestId: existing.id };
    }

    const req = this.requests.create({ fromUserId, toUserId: target.id });
    await this.requests.save(req);
    return { requestId: req.id };
  }

  async getRequests(userId: string) {
    return this.requests.find({ where: [{ toUserId: userId, status: 'pending' }, { fromUserId: userId }] });
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
    });

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
