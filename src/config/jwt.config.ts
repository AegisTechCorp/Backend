import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  // Access Token
  accessToken: {
    secret: process.env.JWT_ACCESS_SECRET,
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  },

  // Refresh Token
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Configuration des cookies
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true en production (HTTPS uniquement)
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours en millisecondes
  },
}));
