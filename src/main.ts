import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CloudLoggingLogger } from './common/logger/cloud-logging.logger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  // Utiliser le logger Cloud Logging en production
  const isProduction = process.env.NODE_ENV === 'production';
  
  const startTime = Date.now();
  console.log('========================================');
  console.log('[STARTUP] Starting Aegis API...');
  console.log(`[STARTUP] Time: ${new Date().toISOString()}`);
  console.log(`[STARTUP] PORT=${process.env.PORT}`);
  console.log(`[STARTUP] NODE_ENV=${process.env.NODE_ENV}`);
  console.log(`[STARTUP] DATABASE_HOST=${process.env.DATABASE_HOST}`);
  console.log('========================================');
  
  console.log('[STARTUP] Creating NestFactory... (this connects to DB)');
  
  const app = await NestFactory.create(AppModule, {
    logger: isProduction 
      ? new CloudLoggingLogger('NestJS')
      : ['error', 'warn', 'log', 'debug'],
  });
  
  console.log(`[STARTUP] NestFactory created in ${Date.now() - startTime}ms`);

  const configService = app.get(ConfigService);

  // Global Logging Interceptor (logs sécurisés sans données sensibles)
  app.useGlobalInterceptors(new LoggingInterceptor());

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
  const corsConfig = configService.get('security.cors') as {
    origin: string | string[];
    credentials: boolean;
  };
  app.enableCors(corsConfig);

  // Security Headers
  app.use(
    (
      req: { path?: string },
      res: { setHeader: (key: string, value: string) => void },
      next: () => void,
    ) => {
      // Protection XSS
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // CSP - Content Security Policy renforcée
      if (req.path?.startsWith('/api/docs')) {
        // CSP assouplie pour Swagger UI uniquement
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
        );
      } else if (req.path?.startsWith('/api')) {
        // CSP stricte pour les endpoints API (JSON uniquement, pas de JS/CSS)
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none';",
        );
        // Disable caching for sensitive endpoints
        res.setHeader(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        );
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }

      next();
    },
  );

  // Global prefix pour toutes les routes API
  app.setGlobalPrefix('api/v1');

  // Configuration Swagger
  const config = new DocumentBuilder()
    .setTitle('Aegis API')
    .setDescription(
      'API Zero-Knowledge pour la gestion sécurisée des dossiers médicaux.\n\n' +
        "**Principe de sécurité :** Toutes les données sensibles sont chiffrées côté client (AES-GCM) avant d'être envoyées au serveur. " +
        'Le backend ne stocke que des blobs chiffrés et ne peut jamais accéder aux données en clair.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag(
      'Authentication',
      "Endpoints pour l'inscription, connexion et gestion des tokens",
    )
    .addTag(
      'Medical Records',
      'Endpoints pour la gestion des dossiers médicaux chiffrés',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Aegis API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = process.env.PORT || 3000;
  
  console.log(`[STARTUP] Starting HTTP server on port ${port}...`);
  
  await app.listen(port, '0.0.0.0');

  console.log('========================================');
  console.log(`[STARTUP] SERVER READY - Listening on port ${port}`);
  console.log(`[STARTUP] Total startup time: ${Date.now() - startTime}ms`);
  console.log(`Aegis API: http://0.0.0.0:${port}/api/v1`);
  console.log(`Swagger: http://0.0.0.0:${port}/api/docs`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('========================================');
}

bootstrap().catch((error) => {
  console.error('========================================');
  console.error('[STARTUP] FATAL ERROR - Application failed to start');
  console.error('[STARTUP] Error:', error.message);
  console.error('[STARTUP] Stack:', error.stack);
  console.error('========================================');
  process.exit(1);
});
