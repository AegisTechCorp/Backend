import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entité User pour architecture Zero-Knowledge
 *
 * Le serveur ne stocke JAMAIS le mot de passe ou la masterKey.
 * Seul l'authHash (déjà hashé côté client) est stocké après un double hashage Argon2id.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  authHash: string; // Hash Argon2id de l'authHash (Zero-Knowledge)

  @Column({ length: 100, nullable: true })
  firstName: string;

  @Column({ length: 100, nullable: true })
  lastName: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  recoveryKeyHash: string; // Hash de la clé de récupération (optionnel)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Méthode pour retourner l'utilisateur sans les données sensibles
  toJSON() {
    const { authHash, recoveryKeyHash, ...user } = this;
    return user;
  }
}
