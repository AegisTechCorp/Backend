import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2FADto {
  @ApiProperty({
    description: "Code 2FA à 6 chiffres généré par l'application authenticator",
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'Le code 2FA doit contenir exactement 6 chiffres' })
  @Matches(/^\d{6}$/, {
    message: 'Le code 2FA doit contenir uniquement des chiffres',
  })
  token: string;
}
