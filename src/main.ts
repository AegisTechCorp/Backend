import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);

  // Global Validation Pipe (protection contre les injections)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés non-déclarées dans les DTOs
      forbidNonWhitelisted: true, // Rejette les requêtes avec des propriétés non-autorisées
      transform: true, // Transforme automatiquement les types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Cookie Parser (pour les JWT dans les cookies HttpOnly)
  app.use(cookieParser());

  // CORS Configuration
  const corsConfig = configService.get('security.cors');
  app.enableCors(corsConfig);

  // Security Headers
  app.use((req, res, next) => {
    // Protection XSS
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // CSP (Content Security Policy) - Strict pour API JSON
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'",
    );

    // Disable caching for sensitive endpoints
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
  });

  // Global prefix pour toutes les routes API
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Aegis API is running on: http://localhost:${port}/api/v1`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
