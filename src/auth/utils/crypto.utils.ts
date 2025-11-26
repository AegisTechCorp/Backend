import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';


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
  } catch (error) {
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
  } catch (error) {
    return false;
  }
}
