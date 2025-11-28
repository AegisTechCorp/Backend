import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import * as fs from 'fs';

/**
 * Contrôleur de gestion des fichiers chiffrés (Zero-Knowledge)
 */
@ApiTags('Files')
@ApiBearerAuth('JWT-auth')
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('medical-records/:medicalRecordId/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB max -> on peut augmenter si besoin
      },
    }),
  )
  @ApiOperation({
    summary: 'Upload un fichier chiffré vers un dossier médical',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Fichier CHIFFRÉ (déjà chiffré côté client avec AES-GCM)',
        },
        encryptedFilename: {
          type: 'string',
          description: 'Nom du fichier chiffré',
        },
        mimeType: {
          type: 'string',
          description: 'Type MIME du fichier original',
        },
        originalSize: {
          type: 'number',
          description: 'Taille du fichier original en bytes',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Fichier uploadé avec succès' })
  @ApiResponse({ status: 400, description: 'Fichier invalide ou manquant' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Dossier médical non trouvé' })
  async uploadFile(
    @CurrentUser() user: User,
    @Param('medicalRecordId') medicalRecordId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    return await this.filesService.uploadFile(
      user.id,
      medicalRecordId,
      file,
      uploadDto,
    );
  }

  @Get('medical-records/:medicalRecordId')
  @ApiOperation({
    summary: "Récupérer tous les fichiers d'un dossier médical",
  })
  @ApiResponse({ status: 200, description: 'Liste des fichiers' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Dossier médical non trouvé' })
  async getFiles(
    @CurrentUser() user: User,
    @Param('medicalRecordId') medicalRecordId: string,
  ) {
    return await this.filesService.getFilesByMedicalRecord(
      user.id,
      medicalRecordId,
    );
  }

  @Get(':fileId/download')
  @ApiOperation({ summary: 'Télécharger un fichier chiffré' })
  @ApiResponse({
    status: 200,
    description: 'Fichier chiffré retourné',
    content: {
      'application/octet-stream': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  @ApiResponse({ status: 404, description: 'Fichier non trouvé' })
  async downloadFile(
    @CurrentUser() user: User,
    @Param('fileId') fileId: string,
    @Res() response: Response,
  ) {
    const { filepath, filename } = await this.filesService.downloadFile(
      user.id,
      fileId,
    );

    // Envoyer le fichier chiffré
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );

    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(response);
  }

  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un fichier' })
  @ApiResponse({ status: 204, description: 'Fichier supprimé avec succès' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  @ApiResponse({ status: 404, description: 'Fichier non trouvé' })
  async deleteFile(@CurrentUser() user: User, @Param('fileId') fileId: string) {
    await this.filesService.deleteFile(user.id, fileId);
  }
}
