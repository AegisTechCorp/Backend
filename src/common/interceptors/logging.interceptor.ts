import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

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

    // Nettoyer le body avant de logger
    const sanitizedBody = this.sanitizeObject(body);

    // Log de la requête entrante (sans données sensibles)
    this.logger.log(
      `Incoming → ${method} ${url} | IP: ${ip} | UA: ${userAgent.substring(0, 50)}`,
    );

    if (Object.keys(sanitizedBody).length > 0) {
      this.logger.debug(`Body: ${JSON.stringify(sanitizedBody)}`);
    }

    return next.handle().pipe(
      tap((response) => {
        const responseTime = Date.now() - startTime;
        const httpResponse = context.switchToHttp().getResponse();
        const statusCode = httpResponse.statusCode;

        // Log de la réponse réussie
        this.logger.log(
          `Success ← ${method} ${url} | Status: ${statusCode} | ${responseTime}ms`,
        );
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Log des erreurs (sécurisé)
        if (statusCode === 401) {
          // Échec d'authentification (potentielle tentative de brute force)
          this.logger.warn(
            `Auth Failed ← ${method} ${url} | IP: ${ip} | ${responseTime}ms`,
          );
        } else if (statusCode >= 500) {
          // Erreur serveur (bug à corriger)
          this.logger.error(
            `Server Error ← ${method} ${url} | Status: ${statusCode} | Error: ${error.message} | ${responseTime}ms`,
          );
        } else if (statusCode >= 400) {
          // Erreur client (validation, etc.)
          this.logger.warn(
            `Client Error ← ${method} ${url} | Status: ${statusCode} | ${responseTime}ms`,
          );
        }

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
