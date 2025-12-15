import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Utilitaires de chiffrement côté serveur (Mode Traditionnel / NON zero-knowledge)
 *
 * Ce fichier implémente le chiffrement AES-256-GCM pour le mode traditionnel où :
 * - Le serveur reçoit les fichiers EN CLAIR via HTTPS
 * - Le serveur CHIFFRE les fichiers avec SA propre clé (stockée en .env)
 * - Le serveur PEUT déchiffrer les fichiers quand nécessaire
 * - Les métadonnées (nom, taille, etc.) sont stockées EN CLAIR en BDD
 *
 * ⚠️ DIFFÉRENCE avec le mode zero-knowledge :
 * - Mode traditionnel : Serveur contrôle le chiffrement (ce fichier)
 * - Mode zero-knowledge : Client contrôle le chiffrement (frontend/crypto.ts)
 */

/**
 * Algorithme : AES-256-GCM (Advanced Encryption Standard - Galois/Counter Mode)
 * - Chiffrement symétrique authentifié (AEAD)
 * - Clé de 256 bits (32 bytes)
 * - IV de 96 bits (12 bytes) généré aléatoirement pour chaque fichier
 * - Tag d'authentification de 128 bits (16 bytes)
 */

/**
 * Chiffre un fichier avec AES-256-GCM en utilisant la clé serveur
 *
 * Format de sortie : iv:authTag:ciphertext (tous en hex)
 * - iv : 12 bytes (24 caractères hex)
 * - authTag : 16 bytes (32 caractères hex)
 * - ciphertext : taille variable
 *
 * @param fileBuffer - Contenu du fichier à chiffrer (Buffer)
 * @param serverKey - Clé de chiffrement du serveur (hex string de 64 caractères / 32 bytes)
 * @returns Fichier chiffré au format "iv:authTag:ciphertext" (hex)
 */
export function encryptFileServerSide(
  fileBuffer: Buffer,
  serverKey: string,
): string {
  try {
    // 1. Vérifier que la clé serveur est valide (64 caractères hex = 32 bytes)
    if (!serverKey || serverKey.length !== 64) {
      throw new Error(
        'Invalid server encryption key: must be 64 hex characters (32 bytes)',
      );
    }

    // 2. Convertir la clé hex en Buffer
    const keyBuffer = Buffer.from(serverKey, 'hex');

    // 3. Générer un IV aléatoire unique pour ce fichier (12 bytes pour GCM)
    const iv = randomBytes(12);

    // 4. Créer le cipher AES-256-GCM
    const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv);

    // 5. Chiffrer le fichier
    const encrypted = Buffer.concat([
      cipher.update(fileBuffer),
      cipher.final(),
    ]);

    // 6. Récupérer le tag d'authentification (16 bytes)
    const authTag = cipher.getAuthTag();

    // 7. Retourner le résultat au format "iv:authTag:ciphertext" (hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (error) {
    throw new Error(
      `Server-side encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Déchiffre un fichier chiffré avec AES-256-GCM
 *
 * @param encryptedData - Données chiffrées au format "iv:authTag:ciphertext" (hex)
 * @param serverKey - Clé de chiffrement du serveur (hex string de 64 caractères / 32 bytes)
 * @returns Contenu du fichier déchiffré (Buffer)
 */
export function decryptFileServerSide(
  encryptedData: string,
  serverKey: string,
): Buffer {
  try {
    // 1. Vérifier que la clé serveur est valide
    if (!serverKey || serverKey.length !== 64) {
      throw new Error(
        'Invalid server encryption key: must be 64 hex characters (32 bytes)',
      );
    }

    // 2. Parser le format "iv:authTag:ciphertext"
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error(
        'Invalid encrypted data format: expected "iv:authTag:ciphertext"',
      );
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;

    // 3. Convertir les données hex en Buffer
    const keyBuffer = Buffer.from(serverKey, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    // 4. Vérifier les tailles
    if (iv.length !== 12) {
      throw new Error('Invalid IV length: expected 12 bytes');
    }
    if (authTag.length !== 16) {
      throw new Error('Invalid auth tag length: expected 16 bytes');
    }

    // 5. Créer le decipher AES-256-GCM
    const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv);

    // 6. Définir le tag d'authentification
    decipher.setAuthTag(authTag);

    // 7. Déchiffrer et vérifier l'authenticité
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted;
  } catch (error) {
    throw new Error(
      `Server-side decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Vérifie si une clé de chiffrement serveur est valide
 *
 * @param serverKey - Clé à vérifier
 * @returns true si la clé est valide, false sinon
 */
export function isValidServerKey(serverKey: string): boolean {
  return !!(serverKey && serverKey.length === 64 && /^[0-9a-f]+$/i.test(serverKey));
}
