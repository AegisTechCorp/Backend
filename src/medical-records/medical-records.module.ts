import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecord } from './entities/medical-record.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicalRecord]),
    PassportModule,
    AuthModule,
  ],
  providers: [MedicalRecordsService],
  controllers: [MedicalRecordsController],
  exports: [MedicalRecordsService],
})
export class MedicalRecordsModule {}
