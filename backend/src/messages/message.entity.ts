import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';

// Circular imports avoided by using string relation references
@Entity('messages')
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') conversationId: string;
  @Column('uuid') senderId: string;
  @Column() clientMsgId: string;
  @Column({ default: 'text' }) type: string;
  @Column({ type: 'bytea', nullable: true }) body: Buffer;
  @Column({ nullable: true }) mediaId: string;
  @Column({ nullable: true }) replyTo: string;
  @Column({ default: false }) deletedForAll: boolean;
  @Column({ nullable: true }) expiresAt: Date;
  @Column({ nullable: true }) editedAt: Date;
  @CreateDateColumn() createdAt: Date;

  // Joined from media table for size estimates
  mediaSizeBytes?: number;
}
