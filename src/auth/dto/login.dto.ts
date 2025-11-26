import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * DTO pour la connexion avec authentification classique
 */
export class LoginDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(1, { message: 'Le mot de passe ne peut pas être vide' })
  @MaxLength(128, { message: 'Le mot de passe ne peut pas dépasser 128 caractères' })
  password: string;
}
