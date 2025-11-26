import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString({ message: 'L\'authHash doit être une chaîne de caractères' })
  @Length(44, 44, { message: 'L\'authHash doit faire exactement 44 caractères' })
  @Matches(/^[A-Za-z0-9+/]+=*$/, { message: 'L\'authHash doit être au format base64 valide' })
  authHash: string;
}
