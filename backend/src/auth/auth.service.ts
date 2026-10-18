import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { nanoid } from 'nanoid';
import { User } from '../users/user.entity';
import { Device } from '../users/device.entity';
import { InviteCode } from '../admin/invite-code.entity';

// Safe alphabet: no 0/O, 1/I confusion
const CONTACT_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function genContactCode() {
  return nanoid(10).split('').map(c => CONTACT_ALPHABET[c.charCodeAt(0) % CONTACT_ALPHABET.length]).join('');
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Device) private devices: Repository<Device>,
    @InjectRepository(InviteCode) private invites: Repository<InviteCode>,
    private jwt: JwtService,
  ) {}

  private sha256(val: string) {
    return createHash('sha256').update(val).digest('hex');
  }

  async register(dto: { inviteCode: string; username: string; displayName: string; password: string }) {
    // Validate invite
    const hash = this.sha256(dto.inviteCode.toUpperCase().replace(/-/g, ''));
    const invite = await this.invites.findOne({ where: { codeHash: hash, revoked: false } });
    if (!invite || (invite.expiresAt && invite.expiresAt < new Date()) || invite.usedCount >= invite.maxUses) {
      throw new BadRequestException({ error: { code: 'INVALID_CODE', message: 'Invalid or expired invite code' } });
    }

    // Check username unique
    const existing = await this.users.findOne({ where: { username: dto.username } });
    if (existing) throw new BadRequestException({ error: { code: 'USERNAME_TAKEN', message: 'Username already taken' } });

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const contactCode = genContactCode();
    const contactCodeHash = this.sha256(contactCode);

    const user = this.users.create({
      username: dto.username,
      displayName: dto.displayName,
      passwordHash,
      contactCode,       // stored plaintext so owner can retrieve it
      contactCodeHash,
    });
    await this.users.save(user);

    // Mark invite used
    await this.invites.increment({ id: invite.id }, 'usedCount', 1);

    return this.issueTokens(user.id);
  }

  async login(dto: { username: string; password: string }) {
    const user = await this.users.findOne({ where: { username: dto.username, isActive: true } });
    if (!user) throw new UnauthorizedException({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });

    await this.users.update(user.id, { lastSeenAt: new Date() });
    return this.issueTokens(user.id);
  }

  private issueTokens(userId: string) {
    const access = this.jwt.sign({ sub: userId }, { expiresIn: '30d' });
    const refresh = this.jwt.sign({ sub: userId, type: 'refresh' }, { expiresIn: '90d' });
    return { access_token: access, refresh_token: refresh };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{ sub: string; type: string }>(refreshToken);
      if (payload.type !== 'refresh') throw new Error();
      return this.issueTokens(payload.sub);
    } catch {
      throw new UnauthorizedException({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' } });
    }
  }
}
