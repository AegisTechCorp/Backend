import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Medical Records')
@ApiBearerAuth('JWT-auth')
@Controller('medical-records')
@UseGuards(JwtAuthGuard)
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouveau dossier médical chiffré' })
  @ApiResponse({ status: 201, description: 'Dossier médical créé avec succès' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async create(
    @CurrentUser() user: User,
    @Body() createMedicalRecordDto: CreateMedicalRecordDto,
  ) {
    return await this.medicalRecordsService.create(user.id, createMedicalRecordDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les dossiers médicaux de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Liste des dossiers médicaux' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async findAll(@CurrentUser() user: User) {
    return await this.medicalRecordsService.findAll(user.id);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Obtenir les statistiques des dossiers médicaux' })
  @ApiResponse({ status: 200, description: 'Statistiques par type de dossier' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getStatistics(@CurrentUser() user: User) {
    return await this.medicalRecordsService.getStatistics(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un dossier médical spécifique' })
  @ApiResponse({ status: 200, description: 'Dossier médical trouvé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  @ApiResponse({ status: 404, description: 'Dossier non trouvé' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return await this.medicalRecordsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un dossier médical' })
  @ApiResponse({ status: 200, description: 'Dossier médical mis à jour' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  @ApiResponse({ status: 404, description: 'Dossier non trouvé' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() updateMedicalRecordDto: UpdateMedicalRecordDto,
  ) {
    return await this.medicalRecordsService.update(id, user.id, updateMedicalRecordDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un dossier médical' })
  @ApiResponse({ status: 204, description: 'Dossier médical supprimé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  @ApiResponse({ status: 404, description: 'Dossier non trouvé' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.medicalRecordsService.remove(id, user.id);
  }
}
