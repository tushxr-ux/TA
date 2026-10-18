import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { InviteCode } from './invite-code.entity';

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(@InjectRepository(InviteCode) private codes: Repository<InviteCode>) {}

  /** Seed bootstrap and testing invite codes on startup */
  async onModuleInit() {
    const testCodes = ['TEST-CODE-2026', 'TOGETHER-2026'];
    if (process.env.BOOTSTRAP_INVITE) testCodes.push(process.env.BOOTSTRAP_INVITE);

    for (const code of testCodes) {
      const hash = this.sha256(code.toUpperCase().replace(/-/g, ''));
      const exists = await this.codes.findOne({ where: { codeHash: hash } });
      if (!exists) {
        await this.codes.save(this.codes.create({ codeHash: hash, maxUses: 99999, usedCount: 0 }));
      } else if (exists.revoked || exists.usedCount >= exists.maxUses) {
        await this.codes.update(exists.id, { maxUses: 99999, revoked: false });
      }
    }
    console.log('Invite codes seeded for testing.');
  }

  private sha256(val: string) {
    return createHash('sha256').update(val).digest('hex');
  }

  /** Generate a new invite code — returns plaintext once, stores hash */
  async createInvite(createdById: string, maxUses = 1, expiresAt?: Date) {
    const plain = this.generateCode();
    const hash = this.sha256(plain.replace(/-/g, ''));
    await this.codes.save(this.codes.create({ codeHash: hash, createdById, maxUses, expiresAt }));
    return { code: plain }; // plaintext returned ONCE to the admin
  }

  async listInvites() {
    return this.codes.find({ order: { createdAt: 'DESC' } });
  }

  async revokeInvite(id: string) {
    await this.codes.update(id, { revoked: true });
    return { revoked: true };
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(12);
    const raw = Array.from(bytes).map(b => chars[b % chars.length]).join('');
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  }
}
