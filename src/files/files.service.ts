import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FileAttachment } from './entities/file-attachment.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { UploadFileDto } from './dto/upload-file.dto';
import {
  encryptFileServerSide,
  decryptFileServerSide,
} from './utils/server-encryption.utils';
import * as fs from 'fs/promises'; // Revenir à fs/promises pour les méthodes asynchrones
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service de gestion des fichiers (Mode Hybride)
 * Supporte deux modes :
 *
 * 1. MODE TRADITIONNEL (isEncrypted = false) - NON zero-knowledge
 *    - Serveur reçoit le fichier EN CLAIR
 *    - Serveur CHIFFRE avec SA clé (SERVER_ENCRYPTION_KEY)
 *    - Serveur PEUT déchiffrer quand nécessaire
 *
 * 2. MODE ZERO-KNOWLEDGE (isEncrypted = true)
 *    - Client chiffre AVANT l'upload
 *    - Serveur reçoit un BLOB CHIFFRÉ
 *    - Serveur ne PEUT PAS déchiffrer
 */
@Injectable()
export class FilesService {
  // Dossier de stockage isolé (hors de src/)
  private readonly uploadDir = path.join(
    process.cwd(),
    'uploads',
    'encrypted-files',
  );

  constructor(
    @InjectRepository(FileAttachment)
    private readonly fileAttachmentRepository: Repository<FileAttachment>,
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    private readonly configService: ConfigService,
  ) {
    this.ensureUploadDirExists();
  }

  private async ensureUploadDirExists() {
    try {
      await fs.access(this.uploadDir).catch(async () => {
        await fs.mkdir(this.uploadDir, { recursive: true });
        console.log(`📂 Répertoire créé : ${this.uploadDir}`);
      });
    } catch (error) {
      console.error('❌ Erreur lors de la création du répertoire :', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  /**
   * Upload un fichier (chiffré ou non selon le mode)
   */
  async uploadFile(
    userId: string,
    medicalRecordId: string,
    file: Express.Multer.File,
    uploadDto: UploadFileDto,
  ): Promise<FileAttachment> {
    // Ajouter un log pour capturer les erreurs potentielles
    try {
      // 1. Vérifier que le dossier médical existe et appartient à l'utilisateur
      const medicalRecord = await this.medicalRecordRepository.findOne({
        where: { id: medicalRecordId, userId },
      });

      if (!medicalRecord) {
        throw new NotFoundException(
          'Dossier médical non trouvé ou accès interdit',
        );
      }
    } catch (error) {
      console.error('❌ Erreur lors de la vérification du dossier médical:', error);
      throw error;
    }

    // Ajouter un log pour capturer les erreurs lors de la génération du fichier
    try {
      // 2. Générer un UUID pour le fichier
      const fileUuid = uuidv4();
      const fileExtension = this.getExtensionFromMimeType(uploadDto.mimeType);
      const filename = `${fileUuid}${fileExtension}`;
      const filepath = path.join(this.uploadDir, filename);

      console.log('📂 Chemin du fichier généré:', filepath);
    } catch (error) {
      console.error('❌ Erreur lors de la génération du fichier:', error);
      throw error;
    }

    // Log pour debug
    console.log('📥 Backend - Upload DTO reçu:', {
      isEncrypted: uploadDto.isEncrypted,
      isEncryptedType: typeof uploadDto.isEncrypted,
      salt: uploadDto.salt ? 'présent' : 'absent',
      originalFilename: uploadDto.originalFilename,
      encryptedFilename: uploadDto.encryptedFilename,
    });

    // Convertir manuellement isEncrypted (car enableImplicitConversion peut mal le gérer)
    const isEncryptedRaw: string | boolean | number | undefined =
      uploadDto.isEncrypted as string | boolean | number | undefined; // Cast nécessaire car peut être string ou boolean
    let isEncrypted = false;
    if (
      isEncryptedRaw === true ||
      isEncryptedRaw === 'true' ||
      isEncryptedRaw === '1' ||
      isEncryptedRaw === 1
    ) {
      isEncrypted = true;
    } else {
      isEncrypted = false; // Par défaut (undefined, false, '0', 0, etc.)
    }

    console.log('✅ isEncrypted après conversion:', isEncrypted);

    // 2. Générer un UUID pour le fichier
    const fileUuid = uuidv4();
    const fileExtension = this.getExtensionFromMimeType(uploadDto.mimeType);
    const filename = `${fileUuid}${fileExtension}`;
    const filepath = path.join(this.uploadDir, filename);

    // 3. Préparer le contenu à sauvegarder selon le mode
    let fileContentToSave: Buffer | string;

    if (isEncrypted) {
      // MODE ZERO-KNOWLEDGE : Le fichier est déjà chiffré côté client
      // On le sauvegarde tel quel (blob chiffré)
      console.log('🔐 Mode zero-knowledge : fichier déjà chiffré côté client');
      fileContentToSave = file.buffer;
    } else {
      // MODE TRADITIONNEL : Le serveur doit chiffrer le fichier
      // avec SA propre clé avant de le stocker
      console.log('🔑 Mode traditionnel : chiffrement côté serveur');

      // Récupérer la clé de chiffrement serveur depuis les variables d'environnement
      const serverKey = this.configService.get<string>('SERVER_ENCRYPTION_KEY');
      if (!serverKey) {
        throw new Error(
          'SERVER_ENCRYPTION_KEY not configured in environment variables',
        );
      }

      // Chiffrer le fichier avec AES-256-GCM
      const encryptedData = encryptFileServerSide(file.buffer, serverKey);
      fileContentToSave = encryptedData; // Format : "iv:authTag:ciphertext"

      console.log(
        '✅ Fichier chiffré côté serveur (taille:',
        encryptedData.length,
        'caractères)',
      );
    }

    // 4. Sauvegarder le fichier chiffré sur le disque
    await fs.writeFile(filepath, fileContentToSave);

    // 5. Créer l'enregistrement en base de données
    const fileAttachment = this.fileAttachmentRepository.create({
      userId,
      medicalRecordId,
      isEncrypted: isEncrypted,
      salt: uploadDto.salt,
      originalFilename: uploadDto.originalFilename,
      encryptedFilename: uploadDto.encryptedFilename,
      filepath: filename,
      mimeType: uploadDto.mimeType,
      encryptedSize: file.size,
      originalSize: uploadDto.originalSize,
      doctorName: uploadDto.doctorName,
    });

    console.log('💾 Backend - Fichier créé:', {
      isEncrypted: fileAttachment.isEncrypted,
      originalFilename: fileAttachment.originalFilename,
      encryptedFilename: fileAttachment.encryptedFilename,
    });

    return await this.fileAttachmentRepository.save(fileAttachment);
  }

  /**
   * Récupérer tous les fichiers d'un dossier médical
   */
  async getFilesByMedicalRecord(
    userId: string,
    medicalRecordId: string,
  ): Promise<FileAttachment[]> {
    // Vérifier que le dossier médical appartient à l'utilisateur
    const medicalRecord = await this.medicalRecordRepository.findOne({
      where: { id: medicalRecordId, userId },
    });

    if (!medicalRecord) {
      throw new NotFoundException(
        'Dossier médical non trouvé ou accès interdit',
      );
    }

    return await this.fileAttachmentRepository.find({
      where: { medicalRecordId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Télécharger un fichier
   *
   * - Mode traditionnel (isEncrypted = false) : Le serveur DÉCHIFFRE le fichier avec sa clé
   * - Mode zero-knowledge (isEncrypted = true) : Le serveur retourne le blob chiffré tel quel
   */
  async downloadFile(
    userId: string,
    fileId: string,
  ): Promise<{
    data: Buffer;
    mimeType: string;
    filename: string;
    isEncrypted: boolean;
  }> {
    // 1. Récupérer le fichier et vérifier l'accès
    const file = await this.fileAttachmentRepository.findOne({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new NotFoundException('Fichier non trouvé ou accès interdit');
    }

    const fullPath = path.join(this.uploadDir, file.filepath);

    // 2. Vérifier que le fichier existe sur le disque
    try {
      await fs.access(fullPath);
    } catch {
      throw new NotFoundException('Fichier physique introuvable sur le disque');
    }

    // 3. Lire le fichier depuis le disque
    const fileContentOnDisk = await fs.readFile(fullPath);

    // 4. Traiter selon le mode
    let fileData: Buffer;
    let filename: string;

    if (file.isEncrypted) {
      // MODE ZERO-KNOWLEDGE : Retourner le blob chiffré tel quel
      // Le client devra le déchiffrer avec le mot de passe
      console.log('🔐 Mode zero-knowledge : retour du blob chiffré');
      fileData = fileContentOnDisk;
      filename = file.encryptedFilename || 'encrypted-file';
    } else {
      // MODE TRADITIONNEL : Déchiffrer le fichier côté serveur
      console.log('🔑 Mode traditionnel : déchiffrement côté serveur');

      // Récupérer la clé serveur
      const serverKey = this.configService.get<string>('SERVER_ENCRYPTION_KEY');
      if (!serverKey) {
        throw new Error(
          'SERVER_ENCRYPTION_KEY not configured in environment variables',
        );
      }

      // Le fichier sur disque est au format "iv:authTag:ciphertext" (string)
      const encryptedDataString = fileContentOnDisk.toString('utf-8');

      // Déchiffrer avec AES-256-GCM
      fileData = decryptFileServerSide(encryptedDataString, serverKey);
      filename = file.originalFilename || 'decrypted-file';

      console.log(
        '✅ Fichier déchiffré côté serveur (taille:',
        fileData.length,
        'bytes)',
      );
    }

    return {
      data: fileData,
      mimeType: file.mimeType,
      filename,
      isEncrypted: file.isEncrypted,
    };
  }

  /**
   * Supprimer un fichier
   */
  async deleteFile(userId: string, fileId: string): Promise<void> {
    // Récupérer le fichier et vérifier l'accès
    const file = await this.fileAttachmentRepository.findOne({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new NotFoundException('Fichier non trouvé ou accès interdit');
    }

    const fullPath = path.join(this.uploadDir, file.filepath);

    // Supprimer le fichier physique
    try {
      await fs.unlink(fullPath);
    } catch {
      // Le fichier n'existe peut-être plus, on continue quand même
      console.warn(
        `Fichier ${file.filepath} introuvable sur le disque lors de la suppression`,
      );
    }

    // Supprimer l'enregistrement en base
    await this.fileAttachmentRepository.remove(file);
  }

  /**
   * Obtenir l'extension de fichier à partir du MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        '.xlsx',
      'text/plain': '.txt',
    };

    return mimeToExt[mimeType] || '.bin';
  }
}
