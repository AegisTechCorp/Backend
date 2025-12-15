import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * DTO pour l'upload de fichiers (Mode Hybride)
 *
 * Deux modes supportés :
 * 1. Mode centralisé (isEncrypted = false) : fichier non chiffré
 * 2. Mode zero-knowledge (isEncrypted = true) : fichier chiffré avec mot de passe unique
 */
export class UploadFileDto {
  @ApiProperty({
    description:
      'Indique si le fichier est chiffré avec un mot de passe unique',
    example: true,
    default: false,
  })
  @Transform(({ value }) => {
    console.log(
      '🔄 Transform isEncrypted - value:',
      value,
      'type:',
      typeof value,
    );
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return false; // Par défaut
  })
  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean;

  @ApiProperty({
    description: 'Salt pour le chiffrement (requis si isEncrypted = true)',
    example: 'dGVzdHNhbHQxMjM=',
    required: false,
  })
  @IsString()
  @IsOptional()
  salt?: string;

  @ApiProperty({
    description: 'Nom du fichier en clair (utilisé si isEncrypted = false)',
    example: 'rapport_medical.pdf',
    required: false,
  })
  @IsString()
  @IsOptional()
  originalFilename?: string;

  @ApiProperty({
    description:
      'Nom du fichier chiffré (utilisé si isEncrypted = true, chiffré côté client)',
    example: 'U2FsdGVkX1+encrypted_filename...',
    required: false,
  })
  @IsString()
  @IsOptional()
  encryptedFilename?: string;

  @ApiProperty({
    description: 'Type MIME du fichier original',
    example: 'application/pdf',
  })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({
    description: 'Taille du fichier original en bytes',
    example: 1048576,
  })
  @IsNumber()
  @Min(0)
  @Transform(({ value }): number => parseInt(String(value), 10))
  originalSize: number;

  @ApiProperty({
    description: 'Nom du médecin prescripteur (optionnel)',
    example: 'Dr. Martin',
    required: false,
  })
  @IsString()
  @IsOptional()
  doctorName?: string;
}
