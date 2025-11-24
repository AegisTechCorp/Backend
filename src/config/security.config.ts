import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  // Configuration Argon2 pour le hachage des mots de passe
  argon2: {
    type: 2, // Argon2id (résistant aux attaques GPU et side-channel)
    memoryCost: 65536, // 64 MB
    timeCost: 3, // Nombre d'itérations
    parallelism: 4, // Nombre de threads
  },

  // Rate Limiting (protection anti-bruteforce)
  rateLimit: {
    login: {
      maxAttempts: 5, // Nombre max de tentatives
      windowMs: 60 * 1000, // Fenêtre de temps (1 minute)
      blockDurationMs: 15 * 60 * 1000, // Durée de blocage (15 minutes)
    },
    api: {
      maxRequests: 100, // Requêtes max par fenêtre
      windowMs: 60 * 1000, // 1 minute
    },
  },

  // CORS Configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // à remplacer par URL du frontend React
    credentials: true, // Permet l'envoi de cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },

  // Configuration générale
  bcryptSaltRounds: 10, // Fallback si Argon2 échoue (ne pas utiliser en prod)
  passwordMinLength: 12, // Longueur minimale du mot de passe
}));
