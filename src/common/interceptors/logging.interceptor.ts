import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { CloudLoggingLogger } from '../logger/cloud-logging.logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new CloudLoggingLogger('HTTP');

  // Liste des champs sensibles à ne JAMAIS logger
  private readonly SENSITIVE_FIELDS = [
    'password',
    'passwordHash',
    'authHash',
    'accessToken',
    'refreshToken',
    'token',
    'secret',
    'apiKey',
    'authorization',
    'currentPassword',
    'newPassword',
    'confirmPassword',
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, body } = request;
    const userAgent = request.get('user-agent') || 'Unknown';
    const startTime = Date.now();
    
    // Récupérer l'userId si authentifié (pour traçabilité)
    const userId = request.user?.sub || request.user?.id || undefined;

    // Nettoyer le body avant de logger (gérer le cas où body est null/undefined pour les GET)
    const sanitizedBody = body ? this.sanitizeObject(body) : {};

    // Log de la requête entrante (sans données sensibles) - uniquement en dev
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`Incoming → ${method} ${url}`);
      if (sanitizedBody && Object.keys(sanitizedBody).length > 0) {
        this.logger.debug(`Body: ${JSON.stringify(sanitizedBody)}`);
      }
    }

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        const httpResponse = context.switchToHttp().getResponse();
        const statusCode = httpResponse.statusCode;

        // Log structuré pour Cloud Logging
        this.logger.logHttpRequest({
          method,
          url,
          statusCode,
          duration: responseTime,
          ip,
          userAgent: userAgent.substring(0, 100),
          userId,
        });
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Log structuré avec erreur
        this.logger.logHttpRequest({
          method,
          url,
          statusCode,
          duration: responseTime,
          ip,
          userAgent: userAgent.substring(0, 100),
          userId,
          error: error.message,
        });

        throw error;
      }),
    );
  }

  /**
   * Nettoie un objet en remplaçant les champs sensibles par [REDACTED]
   */
  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const key in obj) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        sanitized[key] = this.sanitizeObject(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }

    return sanitized;
  }

  /**
   * Vérifie si un champ est sensible (mot de passe, token, etc.)
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return this.SENSITIVE_FIELDS.some((sensitive) =>
      lowerField.includes(sensitive.toLowerCase()),
    );
  }
}
