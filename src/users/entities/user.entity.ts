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
 * Architecture avec 2 salts distincts :
 * - authSalt : Salt pour dériver la clé d'authentification côté client 
 * - vaultSalt : Salt pour dériver la masterKey du vault côté client
 * - passwordHash : Hash Bcrypt du mot de passe pour l'authentification serveur
 *
 * Le mot de passe a 2 usages :
 * 1. Authentification : password → Bcrypt → passwordHash (stocké et vérifié côté serveur)
 * 2. Vault : password + vaultSalt → Argon2 → masterKey → chiffrement données (côté client)
 *
 * Note : authSalt est prévu pour une future migration vers Argon2 pour l'authentification
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  passwordHash: string; // Hash Bcrypt du password pour authentification

  @Column({ length: 255, nullable: true })
  authSalt: string; // Salt pour dérivation client-side de la authKey (ajouté récemment)

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

  @Column({ type: 'text', nullable: true })
  twoFactorSecret: string; // Secret TOTP pour le 2FA (Base32)

  @Column({ default: false })
  twoFactorEnabled: boolean; // Si le 2FA est activé pour cet utilisateur

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Méthode pour retourner l'utilisateur sans les données sensibles
  toJSON() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, recoveryKeyHash, twoFactorSecret, authSalt, ...user } = this;
    return user;
  }
}
