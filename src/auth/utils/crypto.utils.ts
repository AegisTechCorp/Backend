import * as argon2 from 'argon2';
import { createHash } from 'crypto';

/**
 * Utilitaires cryptographiques pour l'architecture Zero-Knowledge
 *
 * Architecture:
 * 1. Client dérive masterKey (pour chiffrement) et authKey (pour authentification) depuis le password
 * 2. Client hashe l'authKey avec SHA-256 avant envoi -> authHash
 * 3. Serveur reçoit authHash et le hashe avec Argon2id pour stockage -> finalHash
 * 4. La masterKey ne quitte jamais le client
 */

/**
 * Hashe l'authHash reçu du client avec Argon2id pour stockage sécurisé
 * @param authHash - Hash de l'authKey envoyé par le client (déjà hashé avec SHA-256)
 * @returns Hash Argon2id prêt pour le stockage en base de données
 */
export async function hashAuthHash(authHash: string): Promise<string> {
  try {
    return await argon2.hash(authHash, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,       // 3 itérations
      parallelism: 4,    // 4 threads
    });
  } catch (error) {
    throw new Error('Erreur lors du hashage de l\'authHash');
  }
}

/**
 * Vérifie si l'authHash fourni correspond au hash stocké
 * @param storedHash - Hash Argon2id stocké en base de données
 * @param authHash - authHash envoyé par le client lors de la connexion
 * @returns true si l'authHash correspond, false sinon
 */
export async function verifyAuthHash(
  storedHash: string,
  authHash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, authHash);
  } catch (error) {
    return false;
  }
}

/**
 * Utilitaire pour vérifier la validité du format d'un authHash
 * L'authHash doit être une chaîne base64 de 44 caractères (32 bytes encodés)
 * @param authHash - authHash à valider
 * @returns true si le format est valide
 */
export function isValidAuthHashFormat(authHash: string): boolean {
  // L'authHash doit être une chaîne base64 valide
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;

  // Un hash SHA-256 encodé en base64 fait 44 caractères
  return (
    typeof authHash === 'string' &&
    authHash.length === 44 &&
    base64Regex.test(authHash)
  );
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
