import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, PrimaryColumn } from 'typeorm';

@Entity('contact_requests')
export class ContactRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'from_user_id', type: 'uuid' }) fromUserId: string;
  @Column({ name: 'to_user_id', type: 'uuid' }) toUserId: string;
  @Column({ default: 'pending' }) status: 'pending' | 'accepted' | 'rejected';
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('contacts')
export class Contact {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' }) userId: string;
  @PrimaryColumn({ name: 'contact_id', type: 'uuid' }) contactId: string;
  @Column({ nullable: true }) nickname: string;
  @Column({ default: false }) blocked: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
