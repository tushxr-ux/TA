import { Controller, Get, Patch, Post, Body, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

const CONTACT_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function genCode() {
  return nanoid(10).split('').map(c => CONTACT_ALPHABET[c.charCodeAt(0) % CONTACT_ALPHABET.length]).join('');
}
function sha256(v: string) { return createHash('sha256').update(v.toUpperCase()).digest('hex'); }

@Controller('me')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(@InjectRepository(User) private users: Repository<User>) {}

  @Get()
  async getMe(@Request() req: any) {
    const { passwordHash, contactCodeHash, ...user } = await this.users.findOneOrFail({ where: { id: req.user.userId } });
    return user;
  }

  @Patch()
  async updateMe(@Request() req: any, @Body() body: { displayName?: string; about?: string }) {
    await this.users.update(req.user.userId, body);
    return { ok: true };
  }

  @Get('contact-code')
  async getCode(@Request() req: any) {
    const u = await this.users.findOneOrFail({ where: { id: req.user.userId }, select: { contactCode: true } });
    return { code: u.contactCode };
  }

  @Patch('contact-code/regenerate')
  async regenerateCode(@Request() req: any) {
    const code = genCode();
    await this.users.update(req.user.userId, { contactCode: code, contactCodeHash: sha256(code) });
    return { code };
  }

  @Post('contact-code/regenerate')
  async regenerateCodePost(@Request() req: any) {
    return this.regenerateCode(req);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  exports: [TypeOrmModule],
})
export class UsersModule {}
