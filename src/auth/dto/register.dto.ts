import { IsEmail, IsString, Length, IsOptional, Matches, IsDateString, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString({ message: 'L\'authHash doit être une chaîne de caractères' })
  @Length(44, 44, { message: 'L\'authHash doit faire exactement 44 caractères' })
  @Matches(/^[A-Za-z0-9+/]+=*$/, { message: 'L\'authHash doit être au format base64 valide' })
  authHash: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Date de naissance invalide (format: YYYY-MM-DD)' })
  dateOfBirth?: string;
}
