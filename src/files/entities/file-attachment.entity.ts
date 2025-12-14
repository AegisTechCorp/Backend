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
 * Entité FileAttachment - Stockage de fichiers (Mode Hybride)
 *
 * Deux modes de stockage :
 * 1. Mode centralisé (isEncrypted = false) : fichiers non chiffrés
 * 2. Mode zero-knowledge (isEncrypted = true) : fichiers chiffrés avec mot de passe unique
 *
 * Pour les fichiers chiffrés :
 * - Le fichier est chiffré côté client avec un mot de passe unique
 * - Le salt est stocké côté serveur
 * - Le serveur ne peut jamais voir le contenu sans le mot de passe
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

  // Indique si le fichier est chiffré avec un mot de passe unique (zero-knowledge)
  @Column({ type: 'boolean', default: false })
  isEncrypted: boolean;

  // Salt pour le chiffrement (uniquement si isEncrypted = true)
  @Column({ type: 'text', nullable: true })
  salt: string;

  // Nom du fichier en clair (uniquement si isEncrypted = false, mode centralisé)
  @Column({ type: 'varchar', length: 500, nullable: true })
  originalFilename: string;

  // Nom du fichier chiffré (uniquement si isEncrypted = true, mode zero-knowledge, chiffré avec le mot de passe unique)
  @Column({ type: 'text', nullable: true })
  encryptedFilename: string;

  // Chemin du fichier sur le disque (chiffré ou non selon isEncrypted)
  @Column({ type: 'varchar', length: 500 })
  filepath: string;

  // Nom du médecin prescripteur (optionnel)
  @Column({ type: 'varchar', length: 200, nullable: true })
  doctorName: string;

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
      isEncrypted: this.isEncrypted,
      salt: this.salt,
      originalFilename: this.originalFilename,
      encryptedFilename: this.encryptedFilename,
      mimeType: this.mimeType,
      encryptedSize: this.encryptedSize,
      originalSize: this.originalSize,
      doctorName: this.doctorName,
      createdAt: this.createdAt,
    };
  }
}
