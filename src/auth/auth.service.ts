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
import { TwoFactorService } from './two-factor.service';
import {
  hashPassword,
  verifyPassword,
  generateAuthSalt,
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
    private readonly twoFactorService: TwoFactorService,
  ) {}

  /**
   * Inscription d'un nouvel utilisateur avec architecture Hybride
   * (Authentification classique + Vault Zero-Knowledge)
   *
   * @param registerDto - Données d'inscription (email, password)
   * @returns Tokens JWT (access + refresh), utilisateur et authSalt
   */
  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, dateOfBirth } = registerDto;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    // 1. Hasher le mot de passe avec Bcrypt pour l'authentification
    const passwordHash = await hashPassword(password);

    // 2. Générer un sel aléatoire pour la dérivation de la masterKey (côté client)
    const authSalt = generateAuthSalt();

    // 3. Créer l'utilisateur
    const user = this.userRepository.create({
      email,
      passwordHash,
      authSalt,
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    });

    await this.userRepository.save(user);

    // 4. Générer les tokens JWT
    const tokens = await this.generateTokens(user);

    return {
      user: user.toJSON(),
      authSalt, // Retourner le salt au client pour dérivation de la masterKey
      ...tokens,
    };
  }

  /**
   * Connexion d'un utilisateur avec architecture Hybride
   * (Authentification classique + Vault Zero-Knowledge)
   *
   * @param loginDto - Données de connexion (email, password)
   * @param ipAddress - Adresse IP du client (optionnel, pour tracking)
   * @param userAgent - User agent du client (optionnel, pour tracking)
   * @returns Tokens JWT (access + refresh), utilisateur et authSalt
   */
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { email, password } = loginDto;

    // Trouver l'utilisateur
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Message générique pour éviter l'énumération d'utilisateurs (User Enumeration)
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Vérifier si l'utilisateur est actif
    if (!user.isActive) {
      throw new UnauthorizedException('Votre compte est désactivé');
    }

    // Vérifier le mot de passe avec Bcrypt
    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Si 2FA activé, ne pas donner les tokens complets
    if (user.twoFactorEnabled) {
      const tempToken = this.generateTempToken(user.id);
      return {
        requires2FA: true,
        tempToken,
        message: 'Veuillez fournir votre code 2FA',
      };
    }

    // Login normal sans 2FA
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    return {
      user: user.toJSON(),
      authSalt: user.authSalt, // Retourner le salt pour dérivation de la masterKey
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
  private async generateTokens(
    user: User,
    ipAddress?: string,
    userAgent?: string,
  ) {
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

  /**
   * Générer un token temporaire pour le flux 2FA
   * (courte durée de vie : 5 minutes)
   */
  private generateTempToken(userId: string): string {
    return this.jwtService.sign(
      { userId, type: '2fa-temp' },
      {
        secret: this.configService.get('jwt.accessToken.secret'),
        expiresIn: '5m',
      },
    );
  }

  /**
   * Vérifier et décoder un token temporaire 2FA
   */
  private verifyTempToken(tempToken: string): string {
    try {
      const payload = this.jwtService.verify<{ type: string; userId: string }>(
        tempToken,
        {
          secret: this.configService.get('jwt.accessToken.secret'),
        },
      );

      if (payload.type !== '2fa-temp') {
        throw new UnauthorizedException('Token invalide');
      }

      return payload.userId;
    } catch {
      throw new UnauthorizedException('Token 2FA expiré ou invalide');
    }
  }

  /**
   * Activer le 2FA pour un utilisateur (étape 1 : génération du QR code)
   */
  async enable2FA(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    // Générer un nouveau secret
    const { secret, otpauth_url } = this.twoFactorService.generateSecret(
      user.email,
    );

    // Stocker temporairement le secret (pas encore activé)
    user.twoFactorSecret = secret;
    await this.userRepository.save(user);

    // Générer le QR code
    const qrCode = await this.twoFactorService.generateQRCode(otpauth_url);

    return { qrCode, secret };
  }

  /**
   * Vérifier et activer définitivement le 2FA (étape 2 : validation du code)
   */
  async verify2FA(userId: string, token: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException("Veuillez d'abord activer le 2FA");
    }

    // Vérifier le code
    const isValid = this.twoFactorService.verifyToken(
      user.twoFactorSecret,
      token,
    );

    if (!isValid) {
      throw new UnauthorizedException('Code 2FA invalide');
    }

    // Activer définitivement le 2FA
    user.twoFactorEnabled = true;
    await this.userRepository.save(user);

    return { success: true, message: '2FA activé avec succès' };
  }

  /**
   * Valider le 2FA lors du login et retourner les tokens complets
   */
  async validate2FALogin(
    tempToken: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Vérifier le token temporaire
    const userId = this.verifyTempToken(tempToken);

    // Récupérer l'utilisateur
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA non configuré');
    }

    // Vérifier le code 2FA
    const isValid = this.twoFactorService.verifyToken(
      user.twoFactorSecret,
      code,
    );

    if (!isValid) {
      throw new UnauthorizedException('Code 2FA invalide');
    }

    // Générer les tokens complets
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    return {
      user: user.toJSON(),
      authSalt: user.authSalt,
      ...tokens,
    };
  }

  /**
   * Désactiver le 2FA pour un utilisateur
   */
  async disable2FA(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = '';
    await this.userRepository.save(user);

    return { success: true, message: '2FA désactivé avec succès' };
  }
}
