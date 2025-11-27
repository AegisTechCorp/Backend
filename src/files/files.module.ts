import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FileAttachment } from './entities/file-attachment.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FileAttachment, MedicalRecord])],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
