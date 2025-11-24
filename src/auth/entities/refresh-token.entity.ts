import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  token: string; // Hash du refresh token (pour éviter stockage en clair)

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  isRevoked: boolean; // Pour révoquer un token

  @Column({ nullable: true })
  ipAddress: string; // Tracking pour sécurité

  @Column({ nullable: true })
  userAgent: string; // Tracking pour sécurité

  @CreateDateColumn()
  createdAt: Date;

  // Vérifier si le token est encore valide
  isValid(): boolean {
    return !this.isRevoked && new Date() < this.expiresAt;
  }
}
