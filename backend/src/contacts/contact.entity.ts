import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, PrimaryColumn } from 'typeorm';

@Entity('contact_requests')
export class ContactRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') fromUserId: string;
  @Column('uuid') toUserId: string;
  @Column({ default: 'pending' }) status: 'pending' | 'accepted' | 'rejected';
  @CreateDateColumn() createdAt: Date;
}

@Entity('contacts')
export class Contact {
  @PrimaryColumn('uuid') userId: string;
  @PrimaryColumn('uuid') contactId: string;
  @Column({ nullable: true }) nickname: string;
  @Column({ default: false }) blocked: boolean;
  @CreateDateColumn() createdAt: Date;
}
