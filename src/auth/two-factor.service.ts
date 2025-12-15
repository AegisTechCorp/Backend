import { Injectable } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class TwoFactorService {
  /**
   * Générer un nouveau secret 2FA pour un utilisateur
   */
  generateSecret(email: string): { secret: string; otpauth_url: string } {
    const secret = speakeasy.generateSecret({
      name: `Aegis Medical (${email})`,
      issuer: 'Aegis',
      length: 32,
    });

    if (!secret.otpauth_url) {
      throw new Error('Échec de la génération du secret 2FA');
    }

    return {
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
    };
  }

  /**
   * Générer un QR code à partir de l'URL OTP
   * Le client scanne ce QR code avec Google Authenticator, Authy, etc.
   */
  async generateQRCode(otpauth_url: string): Promise<string> {
    return await QRCode.toDataURL(otpauth_url);
  }

  /**
   * Vérifier un code 2FA
   * @param secret - Le secret TOTP de l'utilisateur (Base32)
   * @param token - Le code à 6 chiffres fourni par l'utilisateur
   * @returns true si le code est valide
   */
  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2, // Accepte ±60 secondes de décalage (2 x 30s)
    });
  }
}
