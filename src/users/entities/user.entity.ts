import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import * as argon2 from 'argon2';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  password: string; // Hash Argon2id

  @Column({ length: 100, nullable: true })
  firstName: string;

  @Column({ length: 100, nullable: true })
  lastName: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Hook pour hasher le mot de passe avant insertion
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    // Ne hasher que si le mot de passe a été modifié
    if (this.password && !this.password.startsWith('$argon2')) {
      this.password = await argon2.hash(this.password, {
        type: argon2.argon2id, // Argon2id
        memoryCost: 65536, // 64 MB
        timeCost: 3, // 3 itérations
        parallelism: 4, // 4 threads
      });
    }
  }

  // Méthode pour vérifier le mot de passe
  async validatePassword(password: string): Promise<boolean> {
    try {
      return await argon2.verify(this.password, password);
    } catch (error) {
      return false;
    }
  }

  // Méthode pour retourner l'utilisateur sans le mot de passe
  toJSON() {
    const { password, ...user } = this;
    return user;
  }
}
