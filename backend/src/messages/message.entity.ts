import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('messages')
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'conversation_id', type: 'uuid' }) conversationId: string;
  @Column({ name: 'sender_id', type: 'uuid' }) senderId: string;
  @Column({ name: 'client_msg_id' }) clientMsgId: string;
  @Column({ default: 'text' }) type: string;
  @Column({ type: 'bytea', nullable: true }) body: Buffer;
  @Column({ name: 'media_id', nullable: true }) mediaId: string;
  @Column({ name: 'reply_to', nullable: true }) replyTo: string;
  @Column({ name: 'deleted_for_all', default: false }) deletedForAll: boolean;
  @Column({ name: 'expires_at', nullable: true }) expiresAt: Date;
  @Column({ name: 'edited_at', nullable: true }) editedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  mediaSizeBytes?: number;
}
