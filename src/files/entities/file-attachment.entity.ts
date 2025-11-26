import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Entité FileAttachment - Stockage de fichiers chiffrés (Zero-Knowledge)
 *
 * Les fichiers sont TOUJOURS chiffrés côté client AVANT l'upload
 * Le serveur ne stocke que des blobs chiffrés et ne peut JAMAIS voir le contenu
 */
@Entity('file_attachments')
export class FileAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  medicalRecordId: string;

  @ManyToOne(() => MedicalRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medicalRecordId' })
  medicalRecord: MedicalRecord;

  // Nom du fichier chiffré (pour affichage, chiffré côté client)
  @Column({ type: 'text' })
  encryptedFilename: string;

  // Chemin du fichier chiffré sur le disque
  @Column({ type: 'varchar', length: 500 })
  filepath: string;

  // Type MIME du fichier ORIGINAL (avant chiffrement)
  // Stocké en clair car non sensible (ex: "application/pdf", "image/jpeg")
  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  // Taille du fichier CHIFFRÉ en bytes
  @Column({ type: 'bigint' })
  encryptedSize: number;

  // Taille du fichier ORIGINAL en bytes (avant chiffrement)
  // Permet d'afficher la vraie taille à l'utilisateur
  @Column({ type: 'bigint' })
  originalSize: number;

  @CreateDateColumn()
  createdAt: Date;

  // Méthode pour nettoyer les données avant de les retourner
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      medicalRecordId: this.medicalRecordId,
      encryptedFilename: this.encryptedFilename,
      mimeType: this.mimeType,
      encryptedSize: this.encryptedSize,
      originalSize: this.originalSize,
      createdAt: this.createdAt,
    };
  }
}
