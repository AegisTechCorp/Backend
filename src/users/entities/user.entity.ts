import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entité User pour architecture Hybride (Auth Classique + Vault Zero-Knowledge)
 *
 * Architecture :
 * - passwordHash : Hash Argon2id du mot de passe pour l'authentification (serveur)
 * - vaultSalt : Salt aléatoire utilisé côté client pour dériver la masterKey du vault
 *
 * Le mot de passe a 2 usages :
 * 1. Authentification : password → hashé serveur avec Argon2 → passwordHash
 * 2. Vault : password + vaultSalt → dérivation client Argon2 → masterKey → chiffrement données
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  passwordHash: string; // Hash Argon2id du password pour authentification

  @Column({ length: 255 })
  vaultSalt: string; // Salt pour dérivation client-side de la masterKey

  @Column({ length: 100, nullable: true })
  firstName: string;

  @Column({ length: 100, nullable: true })
  lastName: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  recoveryKeyHash: string; // Hash de la clé de récupération (à mettre en place si jamais)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Méthode pour retourner l'utilisateur sans les données sensibles
  toJSON() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, recoveryKeyHash, ...user } = this;
    return user;
  }
}
