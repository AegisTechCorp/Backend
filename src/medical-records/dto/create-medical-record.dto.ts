import { IsString, IsEnum, IsOptional, IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordType } from '../entities/medical-record.entity';

export class CreateMedicalRecordDto {
  @ApiProperty({
    description: 'Données médicales chiffrées (chiffrement côté client)',
    example: 'U2FsdGVkX1+...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Les données chiffrées sont requises' })
  encryptedData: string;

  @ApiProperty({
    description: 'Type de dossier médical',
    enum: RecordType,
    example: RecordType.CONSULTATION,
  })
  @IsEnum(RecordType, { message: 'Type de dossier invalide' })
  recordType: RecordType;

  @ApiPropertyOptional({
    description: 'Titre chiffré du dossier (pour affichage dans la liste)',
    example: 'U2FsdGVkX1+...',
  })
  @IsOptional()
  @IsString()
  encryptedTitle?: string;

  @ApiPropertyOptional({
    description: 'Métadonnées non sensibles (date du rendez-vous, etc.)',
    example: { appointmentDate: '2024-01-15', hospitalName: 'Hôpital Général' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
