import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/**
 * Hashe un mot de passe avec Bcrypt pour stockage sécurisé
 * Utilisé pour l'AUTHENTIFICATION
 *
 * Paramètres Bcrypt :
 * - saltRounds: 12 (2^12 = 4096 itérations, recommandé en 2024)
 * - Génère automatiquement un salt aléatoire unique par hash
 *
 * @param password
 * @returns Hash Bcrypt prêt pour le stockage en base de données
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const saltRounds = 12; // 2^12 = 4096 itérations
    return await bcrypt.hash(password, saltRounds);
  } catch {
    throw new Error('Erreur lors du hashage du mot de passe');
  }
}

/**
 * Vérifie si un mot de passe correspond au hash Bcrypt stocké
 * Utilisé lors de la CONNEXION
 *
 * @param storedHash - Hash Bcrypt stocké en base de données
 * @param password - Mot de passe fourni par l'utilisateur
 * @returns true si le mot de passe correspond, false sinon
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, storedHash);
  } catch {
    return false;
  }
}

/**
 * Génère un salt aléatoire unique pour l'utilisateur
 * Ce salt est stocké côté serveur et retourné au client pour dériver la masterKey
 * Utilisé avec Argon2id côté client : password + email + authSalt → masterKey
 *
 * @returns Salt encodé en base64 (32 bytes / 256 bits)
 */
export function generateAuthSalt(): string {
  return randomBytes(32).toString('base64');
}

/**
 * Génère une clé de récupération sécurisée pour l'utilisateur
 * Cette clé permet de récupérer l'accès en cas d'oubli du mot de passe
 *
 * Sécurité :
 * - Utilise crypto.randomBytes() pour une génération cryptographiquement sécurisée
 * - 32 bytes (256 bits) d'entropie pour résister aux attaques par force brute
 * - Format hexadécimal pour faciliter la copie/sauvegarde par l'utilisateur
 *
 * @returns Clé de récupération au format hexadécimal (64 caractères)
 */
export function generateRecoveryKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hashe une clé de récupération pour stockage sécurisé avec Bcrypt
 * @param recoveryKey - Clé de récupération en clair
 * @returns Hash Bcrypt de la clé de récupération
 */
export async function hashRecoveryKey(recoveryKey: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(recoveryKey, saltRounds);
}

/**
 * Vérifie une clé de récupération avec Bcrypt
 * @param storedHash - Hash Bcrypt de la clé de récupération stocké en base
 * @param recoveryKey - Clé de récupération fournie par l'utilisateur
 * @returns true si la clé correspond
 */
export async function verifyRecoveryKey(
  storedHash: string,
  recoveryKey: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(recoveryKey, storedHash);
  } catch {
    return false;
  }
}
