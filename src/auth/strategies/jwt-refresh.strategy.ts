import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      secretOrKey: configService.get<string>('jwt.refreshToken.secret'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.userRepository.findOne({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur introuvable ou désactivé');
    }

    return user;
  }
}
