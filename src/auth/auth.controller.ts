import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { Login2FADto } from './dto/login-2fa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

/**
 * Contrôleur d'authentification avec architecture Zero-Knowledge
 *
 * Le serveur reçoit un authHash (déjà hashé côté client avec SHA-256)
 * et ne voit JAMAIS le mot de passe ou la masterKey de l'utilisateur.
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Inscription d'un nouvel utilisateur",
    description:
      'Crée un compte utilisateur. Le client doit envoyer un authHash dérivé du mot de passe, jamais le mot de passe en clair.',
  })
  @ApiResponse({ status: 201, description: 'Utilisateur créé avec succès' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(registerDto);

    // Stocker le refresh token dans un cookie HttpOnly
    this.setRefreshTokenCookie(response, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
      authSalt: result.authSalt, // Nécessaire pour dérivation client-side de la authKey
      vaultSalt: result.vaultSalt, // Nécessaire pour dérivation client-side de la masterKey
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Connexion d'un utilisateur (Zero-Knowledge)",
    description:
      'Authentifie un utilisateur. Le client doit envoyer un authHash dérivé du mot de passe.',
  })
  @ApiResponse({ status: 200, description: 'Connexion réussie' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const ipAddress = request.ip;
    const userAgent = request.get('user-agent');

    const result = await this.authService.login(loginDto, ipAddress, userAgent);

    // Si 2FA requis, retourner uniquement le tempToken
    if ('requires2FA' in result && result.requires2FA) {
      return result;
    }

    // Login normal : stocker le refresh token dans un cookie HttpOnly
    if ('refreshToken' in result) {
      this.setRefreshTokenCookie(response, result.refreshToken);

      return {
        user: result.user,
        accessToken: result.accessToken,
        authSalt: result.authSalt, 
        vaultSalt: result.vaultSalt, 
      };
    }

    // Ne devrait jamais arriver ici
    throw new Error('État de login invalide');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refreshTokens(
      refreshTokenDto.refreshToken,
    );

    // Stocker le nouveau refresh token
    this.setRefreshTokenCookie(response, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(refreshTokenDto.refreshToken);

    // Supprimer le cookie
    response.clearCookie('refreshToken');

    return { message: 'Déconnexion réussie' };
  }

  // Méthode privée pour configurer le cookie du refresh token
  private setRefreshTokenCookie(response: Response, refreshToken: string) {
    const cookieConfig = this.configService.get('jwt.cookie') as {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'strict' | 'lax' | 'none';
      maxAge: number;
    };

    response.cookie('refreshToken', refreshToken, {
      httpOnly: cookieConfig.httpOnly,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      maxAge: cookieConfig.maxAge,
    });
  }

  // ==================== Routes 2FA ====================

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Activer le 2FA (étape 1 : génération du QR code)',
    description:
      'Génère un secret TOTP et un QR code à scanner avec Google Authenticator, Authy, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'QR code généré avec succès',
    schema: {
      example: {
        qrCode: 'data:image/png;base64,iVBORw0KG...',
        secret: 'JBSWY3DPEHPK3PXP',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async enable2FA(@CurrentUser() user: User) {
    return await this.authService.enable2FA(user.id);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Vérifier et activer définitivement le 2FA (étape 2)',
    description:
      'Vérifie le code 2FA fourni et active définitivement le 2FA pour l\'utilisateur',
  })
  @ApiResponse({
    status: 200,
    description: '2FA activé avec succès',
    schema: {
      example: {
        success: true,
        message: '2FA activé avec succès',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Code 2FA invalide' })
  async verify2FA(@CurrentUser() user: User, @Body() dto: Verify2FADto) {
    return await this.authService.verify2FA(user.id, dto.token);
  }

  @Post('2fa/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Valider le 2FA lors du login',
    description:
      'Valide le code 2FA après un login réussi et retourne les tokens complets',
  })
  @ApiResponse({
    status: 200,
    description: 'Login 2FA réussi',
    schema: {
      example: {
        user: { id: '...', email: '...' },
        authSalt: 'xyz789...',
        vaultSalt: 'abc123...',
        accessToken: 'eyJhbGci...',
        refreshToken: 'eyJhbGci...',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Code 2FA invalide ou token expiré' })
  async login2FA(
    @Body() dto: Login2FADto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    const result = await this.authService.validate2FALogin(
      dto.tempToken,
      dto.token,
      ipAddress,
      userAgent,
    );

    // Stocker le refresh token dans un cookie HttpOnly
    this.setRefreshTokenCookie(response, result.refreshToken);

    return {
      user: result.user,
      authSalt: result.authSalt,
      vaultSalt: result.vaultSalt,
      accessToken: result.accessToken,
    };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Désactiver le 2FA',
    description: 'Désactive le 2FA pour l\'utilisateur connecté',
  })
  @ApiResponse({
    status: 200,
    description: '2FA désactivé avec succès',
    schema: {
      example: {
        success: true,
        message: '2FA désactivé avec succès',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async disable2FA(@CurrentUser() user: User) {
    return await this.authService.disable2FA(user.id);
  }
}
