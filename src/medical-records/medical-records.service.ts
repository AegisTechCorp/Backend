import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalRecord } from './entities/medical-record.entity';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';

@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
  ) {}

  /**
   * Créer un nouveau dossier médical chiffré
   */
  async create(userId: string, createMedicalRecordDto: CreateMedicalRecordDto): Promise<MedicalRecord> {
    const medicalRecord = this.medicalRecordRepository.create({
      userId,
      ...createMedicalRecordDto,
    });

    return await this.medicalRecordRepository.save(medicalRecord);
  }

  /**
   * Récupérer tous les dossiers médicaux d'un utilisateur
   */
  async findAll(userId: string): Promise<MedicalRecord[]> {
    return await this.medicalRecordRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Récupérer un dossier médical spécifique
   */
  async findOne(id: string, userId: string): Promise<MedicalRecord> {
    const record = await this.medicalRecordRepository.findOne({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Dossier médical non trouvé');
    }

    // Vérifier que le dossier appartient bien à l'utilisateur
    if (record.userId !== userId) {
      throw new ForbiddenException('Accès interdit à ce dossier');
    }

    return record;
  }

  /**
   * Mettre à jour un dossier médical
   */
  async update(id: string, userId: string, updateMedicalRecordDto: UpdateMedicalRecordDto): Promise<MedicalRecord> {
    const record = await this.findOne(id, userId);

    Object.assign(record, updateMedicalRecordDto);

    return await this.medicalRecordRepository.save(record);
  }

  /**
   * Supprimer un dossier médical
   */
  async remove(id: string, userId: string): Promise<void> {
    const record = await this.findOne(id, userId);

    await this.medicalRecordRepository.remove(record);
  }

  /**
   * Compter le nombre de dossiers par type pour un utilisateur
   */
  async getStatistics(userId: string): Promise<Record<string, number>> {
    const records = await this.findAll(userId);

    const stats = records.reduce((acc, record) => {
      acc[record.recordType] = (acc[record.recordType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return stats;
  }
}
