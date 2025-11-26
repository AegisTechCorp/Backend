import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';


/**
 * Hashe un mot de passe avec Argon2id pour stockage sécurisé
 * Utilisé pour l'AUTHENTIFICATION (vérification du mot de passe)
 *
 * @param password - Mot de passe en clair
 * @returns Hash Argon2id prêt pour le stockage en base de données
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,       // 3 itérations
      parallelism: 4,    // 4 threads
    });
  } catch (error) {
    throw new Error('Erreur lors du hashage du mot de passe');
  }
}

/**
 * Vérifie si un mot de passe correspond au hash stocké
 * Utilisé lors de la CONNEXION
 *
 * @param storedHash - Hash Argon2id stocké en base de données
 * @param password - Mot de passe fourni par l'utilisateur
 * @returns true si le mot de passe correspond, false sinon
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, password);
  } catch (error) {
    return false;
  }
}

/**
 * Génère un salt aléatoire pour le vault (Zero-Knowledge)
 * Ce salt est stocké côté serveur et retourné au client pour dériver la masterKey
 *
 * @returns Salt encodé en base64 (32 bytes)
 */
export function generateVaultSalt(): string {
  // Générer 32 bytes aléatoires (256 bits)
  return randomBytes(32).toString('base64');
}

/**
 * Génère une clé de récupération sécurisée pour l'utilisateur
 * Cette clé permet de récupérer l'accès en cas d'oubli du mot de passe
 * @returns Clé de récupération au format hexadécimal
 */
export function generateRecoveryKey(): string {
  const randomBytes = createHash('sha256')
    .update(Math.random().toString())
    .update(Date.now().toString())
    .digest('hex');

  return randomBytes;
}

/**
 * Hashe une clé de récupération pour stockage sécurisé
 * @param recoveryKey - Clé de récupération en clair
 * @returns Hash Argon2id de la clé de récupération
 */
export async function hashRecoveryKey(recoveryKey: string): Promise<string> {
  return await argon2.hash(recoveryKey, {
    type: argon2.argon2id,
    memoryCost: 32768, 
    timeCost: 2,
    parallelism: 2,
  });
}

/**
 * Vérifie une clé de récupération
 * @param storedHash - Hash de la clé de récupération stocké en base
 * @param recoveryKey - Clé de récupération fournie par l'utilisateur
 * @returns true si la clé correspond
 */
export async function verifyRecoveryKey(
  storedHash: string,
  recoveryKey: string,
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, recoveryKey);
  } catch (error) {
    return false;
  }
}
