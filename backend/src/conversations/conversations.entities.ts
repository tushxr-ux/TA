import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, PrimaryColumn } from 'typeorm';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ default: 'direct' }) type: string;
  @Column('uuid', { nullable: true }) createdBy: string;
  @Column({ nullable: true }) disappearingSeconds: number;
  @CreateDateColumn() createdAt: Date;
}

@Entity('conversation_members')
export class ConversationMember {
  @PrimaryColumn('uuid') conversationId: string;
  @PrimaryColumn('uuid') userId: string;
  @Column({ nullable: true }) mutedUntil: Date;
  @Column({ default: false }) archived: boolean;
  @Column({ default: false }) pinned: boolean;
  @Column({ nullable: true }) lastReadMessageId: string;
  @CreateDateColumn() joinedAt: Date;
}
