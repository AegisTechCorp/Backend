import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO pour l'upload de fichiers chiffrés
 *
 * IMPORTANT : Le fichier est déjà chiffré côté client avec AES-GCM
 * Le serveur ne reçoit que le blob chiffré
 */
export class UploadFileDto {
  @ApiProperty({
    description: 'Nom du fichier chiffré (chiffré côté client avec AES-GCM)',
    example: 'U2FsdGVkX1+encrypted_filename...',
  })
  @IsString()
  @IsNotEmpty()
  encryptedFilename: string;

  @ApiProperty({
    description: 'Type MIME du fichier ORIGINAL (avant chiffrement)',
    example: 'application/pdf',
  })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({
    description: 'Taille du fichier ORIGINAL en bytes (avant chiffrement)',
    example: 1048576,
  })
  @IsNumber()
  @Min(0)
  originalSize: number;
}
