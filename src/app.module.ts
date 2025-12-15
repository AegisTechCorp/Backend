import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { FilesModule } from './files/files.module';

import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import securityConfig from './config/security.config';

@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, securityConfig],
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    // Configuration TypeORM avec injection de config
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        console.log('[DB] Configuring TypeORM...');
        console.log(`[DB] Host: ${configService.get('database.host')}`);
        console.log('[DB] Attempting database connection...');
        const config = configService.get('database');
        return config;
      },
      inject: [ConfigService],
    }),

    // Modules métier
    AuthModule,
    UsersModule,
    MedicalRecordsModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
//
