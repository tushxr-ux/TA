import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column({ nullable: true }) deviceName: string;
  @Column({ nullable: true }) pushToken: string;
  @Column({ nullable: true }) identityPublicKey: string;
  @Column({ nullable: true }) signedPrekey: string;
  @CreateDateColumn() createdAt: Date;
}
