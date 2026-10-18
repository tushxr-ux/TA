import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true, length: 32 }) username: string;
  @Column({ length: 64 }) displayName: string;
  @Column() passwordHash: string;
  @Column({ nullable: true }) avatarUrl: string;
  @Column({ default: "Hey there! I am using this app." }) about: string;
  @Column({ nullable: true }) contactCode: string;      // plaintext, shown only to owner
  @Column({ nullable: true, unique: true }) contactCodeHash: string;
  @Column({ default: false }) isAdmin: boolean;
  @Column({ default: true }) isActive: boolean;
  @Column({ nullable: true }) lastSeenAt: Date;
  @CreateDateColumn() createdAt: Date;
}
