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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

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
    summary: 'Inscription d\'un nouvel utilisateur (Zero-Knowledge)',
    description: 'Crée un compte utilisateur. Le client doit envoyer un authHash dérivé du mot de passe, jamais le mot de passe en clair.',
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
      vaultSalt: result.vaultSalt, // Nécessaire pour dérivation client-side de la masterKey
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion d\'un utilisateur (Zero-Knowledge)',
    description: 'Authentifie un utilisateur. Le client doit envoyer un authHash dérivé du mot de passe.',
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

    // Stocker le refresh token dans un cookie HttpOnly
    this.setRefreshTokenCookie(response, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
      vaultSalt: result.vaultSalt, // Nécessaire pour dérivation client-side de la masterKey
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refreshTokens(refreshTokenDto.refreshToken);

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
    const cookieConfig = this.configService.get('jwt.cookie');

    response.cookie('refreshToken', refreshToken, {
      httpOnly: cookieConfig.httpOnly,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      maxAge: cookieConfig.maxAge,
    });
  }
}
