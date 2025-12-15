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
 *
 * 1. MODE TRADITIONNEL (isEncrypted = false) - NON zero-knowledge
 *    - Fichier reçu EN CLAIR par le serveur (via HTTPS)
 *    - Serveur CHIFFRE le fichier avec SA clé (SERVER_ENCRYPTION_KEY)
 *    - Serveur PEUT déchiffrer quand nécessaire
 *    - Métadonnées (nom, taille) stockées EN CLAIR en BDD
 *    - Fichier chiffré sur disque au format "iv:authTag:ciphertext"
 *
 * 2. MODE ZERO-KNOWLEDGE (isEncrypted = true)
 *    - Fichier chiffré CÔTÉ CLIENT avec mot de passe unique
 *    - Serveur reçoit un BLOB CHIFFRÉ qu'il ne peut PAS déchiffrer
 *    - Salt stocké côté serveur pour dérivation de clé
 *    - Métadonnées AUSSI chiffrées (nom de fichier chiffré)
 *    - Serveur ne peut JAMAIS voir le contenu sans le mot de passe
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

  // Mode de chiffrement :
  // - false = Mode traditionnel (serveur chiffre avec sa clé)
  // - true = Mode zero-knowledge (client chiffre avec mot de passe unique)
  @Column({ type: 'boolean', default: false })
  isEncrypted: boolean;

  // Salt pour le chiffrement côté client (UNIQUEMENT si isEncrypted = true)
  // Permet au client de re-dériver la clé de chiffrement avec Argon2id
  @Column({ type: 'text', nullable: true })
  salt: string;

  // Nom du fichier EN CLAIR (UNIQUEMENT si isEncrypted = false, mode traditionnel)
  // Visible par le serveur et les admins
  @Column({ type: 'varchar', length: 500, nullable: true })
  originalFilename: string;

  // Nom du fichier CHIFFRÉ (UNIQUEMENT si isEncrypted = true, mode zero-knowledge)
  // Chiffré côté client avec le mot de passe unique, serveur ne peut pas le lire
  @Column({ type: 'text', nullable: true })
  encryptedFilename: string;

  // Chemin du fichier sur le disque
  // Le fichier stocké est TOUJOURS chiffré (par le serveur ou par le client selon le mode)
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
