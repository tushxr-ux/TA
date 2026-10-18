import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('invite_codes')
export class InviteCode {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) codeHash: string;
  @Column({ nullable: true }) createdById: string;
  @Column({ default: 1 }) maxUses: number;
  @Column({ default: 0 }) usedCount: number;
  @Column({ nullable: true }) expiresAt: Date;
  @Column({ default: false }) revoked: boolean;
  @CreateDateColumn() createdAt: Date;
}
