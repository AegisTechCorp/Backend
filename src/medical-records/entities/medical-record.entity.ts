import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum RecordType {
  CONSULTATION = 'consultation',
  ORDONNANCE = 'ordonnance',
  ANALYSE = 'analyse',
  IMAGERIE = 'imagerie',
  VACCINATION = 'vaccination',
  HOSPITALISATION = 'hospitalisation',
  AUTRE = 'autre',
}

@Entity('medical_records')
export class MedicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Données chiffrées (blob JSON chiffré côté client)
  // Le backend ne peut JAMAIS déchiffrer ces données
  @Column({ type: 'text' })
  encryptedData: string;

  // Type de dossier médical
  @Column({
    type: 'enum',
    enum: RecordType,
    default: RecordType.AUTRE,
  })
  recordType: RecordType;

  // Titre chiffré du dossier (pour affichage dans la liste)
  @Column({ type: 'text', nullable: true })
  encryptedTitle: string;

  // Métadonnées non sensibles (optionnel)
  // Peut contenir: date du rendez-vous, nom de l'hôpital (si non sensible), etc.
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Méthode pour nettoyer les données avant de les retourner
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      encryptedData: this.encryptedData,
      recordType: this.recordType,
      encryptedTitle: this.encryptedTitle || null,
      metadata: this.metadata || null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
