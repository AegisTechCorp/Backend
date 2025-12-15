import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Login2FADto {
  @ApiProperty({
    description: 'Token temporaire reçu après login avec 2FA activé',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  tempToken: string;

  @ApiProperty({
    description: 'Code 2FA à 6 chiffres',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  token: string;
}
