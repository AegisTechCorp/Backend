import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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

    // Rate Limiting (anti brute-force)
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute 
      },
    ]),

    // Configuration TypeORM avec injection de config
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        ...(await Promise.resolve(configService.get('database'))),
      }),
      inject: [ConfigService],
    }),

    // Modules métier
    AuthModule,
    UsersModule,
    MedicalRecordsModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
//
