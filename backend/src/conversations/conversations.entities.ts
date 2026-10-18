import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, PrimaryColumn } from 'typeorm';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ default: 'direct' }) type: string;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string;
  @Column({ name: 'disappearing_seconds', nullable: true }) disappearingSeconds: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('conversation_members')
export class ConversationMember {
  @PrimaryColumn({ name: 'conversation_id', type: 'uuid' }) conversationId: string;
  @PrimaryColumn({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ name: 'muted_until', nullable: true }) mutedUntil: Date;
  @Column({ default: false }) archived: boolean;
  @Column({ default: false }) pinned: boolean;
  @Column({ name: 'last_read_message_id', nullable: true }) lastReadMessageId: string;
  @CreateDateColumn({ name: 'joined_at' }) joinedAt: Date;
}
