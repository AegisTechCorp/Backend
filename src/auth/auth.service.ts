import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  hashAuthHash,
  verifyAuthHash,
  isValidAuthHashFormat,
} from './utils/crypto.utils';
import * as crypto from 'crypto';


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

  /**
   * Inscription d'un nouvel utilisateur avec architecture Zero-Knowledge
   * @param registerDto - Données d'inscription
   * @returns Tokens JWT (access + refresh) et utilisateur
   */
  async register(registerDto: RegisterDto) {
    const { email, authHash, firstName, lastName, dateOfBirth } = registerDto;

    // Validation du format de l'authHash
    if (!isValidAuthHashFormat(authHash)) {
      throw new UnauthorizedException(
        "Format d'authHash invalide. Assurez-vous d'utiliser le bon algorithme côté client.",
      );
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    // Hasher l'authHash avec Argon2id (double hashage pour sécurité maximale)
    const finalHash = await hashAuthHash(authHash);

    // Créer l'utilisateur
    const user = this.userRepository.create({
      email,
      authHash: finalHash,
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    });

    await this.userRepository.save(user);

    // Générer les tokens JWT
    const tokens = await this.generateTokens(user);

    return {
      user: user.toJSON(),
      ...tokens,
    };
  }

  /**
   * Connexion d'un utilisateur avec architecture Zero-Knowledge
   * @param loginDto - Données de connexion
   * @param ipAddress - Adresse IP du client (optionnel, pour tracking)
   * @param userAgent - User agent du client (optionnel, pour tracking)
   * @returns Tokens JWT (access + refresh) et utilisateur
   */
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { email, authHash } = loginDto;

    // Validation du format de l'authHash
    if (!isValidAuthHashFormat(authHash)) {
      throw new UnauthorizedException(
        "Format d'authHash invalide. Assurez-vous d'utiliser le bon algorithme côté client.",
      );
    }

    // Trouver l'utilisateur
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Vérifier si l'utilisateur est actif
    if (!user.isActive) {
      throw new UnauthorizedException('Votre compte est désactivé');
    }

    // Vérifier l'authHash avec Argon2
    const isValid = await verifyAuthHash(user.authHash, authHash);
    if (!isValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Générer les tokens JWT
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    return {
      user: user.toJSON(),
      ...tokens,
    };
  }

  /**
   * Rafraîchit les tokens en utilisant un refresh token valide
   * @param refreshToken - Refresh token
   * @returns Nouveaux tokens (access + refresh)
   */
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

  /**
   * Déconnexion d'un utilisateur (révoque le refresh token)
   * @param refreshToken - Refresh token à révoquer
   */
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

  /**
   * Génère les tokens JWT (access + refresh)
   * @param user - Utilisateur
   * @param ipAddress - Adresse IP (optionnel)
   * @param userAgent - User agent (optionnel)
   * @returns Access token et refresh token
   */
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

    // Stocker le refresh token en BDD (hashé avec SHA-256)
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

  /**
   * Hashe un token avec SHA-256
   * @param token - Token à hasher
   * @returns Hash du token
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Nettoie les refresh tokens expirés ou révoqués
   * À appeler régulièrement via un cron job
   */
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

  /**
   * Valide un utilisateur depuis son ID (utilisé par les guards JWT)
   * @param userId - ID de l'utilisateur
   * @returns L'utilisateur
   */
  async validateUser(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non trouvé ou désactivé');
    }
    return user;
  }
}
