import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, dateOfBirth } = registerDto;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Créer l'utilisateur (le hash se fait automatiquement via @BeforeInsert)
    const user = this.userRepository.create({
      email,
      password,
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    });

    await this.userRepository.save(user);

    // Générer les tokens
    const tokens = await this.generateTokens(user);

    return {
      user: user.toJSON(),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { email, password } = loginDto;

    // Trouver l'utilisateur
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      throw new UnauthorizedException('Votre compte est désactivé');
    }

    // Générer les tokens
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    return {
      user: user.toJSON(),
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    // Hasher le token reçu pour le comparer
    const hashedToken = this.hashToken(refreshToken);

    // Trouver le refresh token en BDD
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: hashedToken },
      relations: ['user'],
    });

    if (!storedToken || !storedToken.isValid()) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    // Rotation : Révoquer l'ancien token
    storedToken.isRevoked = true;
    await this.refreshTokenRepository.save(storedToken);

    // Générer de nouveaux tokens
    const tokens = await this.generateTokens(storedToken.user);

    return {
      user: storedToken.user.toJSON(),
      ...tokens,
    };
  }

  async logout(refreshToken: string) {
    const hashedToken = this.hashToken(refreshToken);

    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: hashedToken },
    });

    if (storedToken) {
      storedToken.isRevoked = true;
      await this.refreshTokenRepository.save(storedToken);
    }

    return { message: 'Déconnexion réussie' };
  }

  // Générer Access Token + Refresh Token
  private async generateTokens(user: User, ipAddress?: string, userAgent?: string) {
    const payload = { sub: user.id, email: user.email };

    // Access Token (courte durée)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.accessToken.secret'),
      expiresIn: this.configService.get('jwt.accessToken.expiresIn'),
    });

    // Refresh Token (longue durée)
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshToken.secret'),
      expiresIn: this.configService.get('jwt.refreshToken.expiresIn'),
    });

    // Stocker le refresh token en BDD (hashé)
    const hashedRefreshToken = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 jours

    await this.refreshTokenRepository.save({
      token: hashedRefreshToken,
      userId: user.id,
      expiresAt,
      ipAddress,
      userAgent,
    });

    return { accessToken, refreshToken };
  }

  // Hasher le refresh token avant stockage
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Nettoyer les tokens expirés (à appeler régulièrement via cron)
  async cleanExpiredTokens() {
    await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now OR isRevoked = :revoked', {
        now: new Date(),
        revoked: true,
      })
      .execute();
  }
}
