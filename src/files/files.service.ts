import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileAttachment } from './entities/file-attachment.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { UploadFileDto } from './dto/upload-file.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service de gestion des fichiers (Mode Hybride)
 * Supporte deux modes :
 * 1. Mode centralisé : fichiers non chiffrés
 * 2. Mode zero-knowledge : fichiers chiffrés avec mot de passe unique
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
  ) {}

  /**
   * Upload un fichier (chiffré ou non selon le mode)
   */
  async uploadFile(
    userId: string,
    medicalRecordId: string,
    file: Express.Multer.File,
    uploadDto: UploadFileDto,
  ): Promise<FileAttachment> {
    // 1. Vérifier que le dossier médical existe et appartient à l'utilisateur
    const medicalRecord = await this.medicalRecordRepository.findOne({
      where: { id: medicalRecordId, userId },
    });

    if (!medicalRecord) {
      throw new NotFoundException(
        'Dossier médical non trouvé ou accès interdit',
      );
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
    const isEncryptedRaw = uploadDto.isEncrypted as any; // Cast nécessaire car peut être string ou boolean
    let isEncrypted = false;
    if (isEncryptedRaw === true || isEncryptedRaw === 'true' || isEncryptedRaw === '1' || isEncryptedRaw === 1) {
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

    // 3. Sauvegarder le fichier sur le disque
    await fs.writeFile(filepath, file.buffer);

    // 4. Créer l'enregistrement en base de données
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
   * Télécharger un fichier chiffré
   */
  async downloadFile(
    userId: string,
    fileId: string,
  ): Promise<{ filepath: string; mimeType: string; filename: string }> {
    // Récupérer le fichier et vérifier l'accès
    const file = await this.fileAttachmentRepository.findOne({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new NotFoundException('Fichier non trouvé ou accès interdit');
    }

    const fullPath = path.join(this.uploadDir, file.filepath);

    // Vérifier que le fichier existe sur le disque
    try {
      await fs.access(fullPath);
    } catch {
      throw new NotFoundException('Fichier physique introuvable sur le disque');
    }

    return {
      filepath: fullPath,
      mimeType: file.mimeType,
      filename: file.encryptedFilename,
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
