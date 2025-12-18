import { LoggerService, LogLevel } from '@nestjs/common';

/**
 * Logger personnalisé pour Google Cloud Logging
 * 
 * Produit des logs JSON structurés avec les niveaux de sévérité
 * compatibles avec Cloud Logging (CRITICAL, ERROR, WARNING, INFO, DEBUG)
 * 
 * @see https://cloud.google.com/logging/docs/structured-logging
 */
export class CloudLoggingLogger implements LoggerService {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  /**
   * Mapping des niveaux NestJS vers les sévérités Cloud Logging
   */
  private getSeverity(level: string): string {
    const severityMap: Record<string, string> = {
      error: 'ERROR',
      warn: 'WARNING',
      log: 'INFO',
      debug: 'DEBUG',
      verbose: 'DEBUG',
      fatal: 'CRITICAL',
    };
    return severityMap[level] || 'INFO';
  }

  /**
   * Format le message en JSON structuré pour Cloud Logging
   */
  private formatMessage(
    level: string,
    message: any,
    context?: string,
    trace?: string,
    metadata?: Record<string, any>,
  ): string {
    const logEntry = {
      severity: this.getSeverity(level),
      message: typeof message === 'string' ? message : JSON.stringify(message),
      timestamp: new Date().toISOString(),
      context: context || this.context || 'Application',
      ...(trace && { stack_trace: trace }),
      ...(metadata && { ...metadata }),
      // Labels pour le filtrage dans Cloud Logging
      'logging.googleapis.com/labels': {
        application: 'aegis-backend',
        environment: process.env.NODE_ENV || 'development',
      },
    };

    return JSON.stringify(logEntry);
  }

  log(message: any, context?: string): void {
    console.log(this.formatMessage('log', message, context));
  }

  error(message: any, trace?: string, context?: string): void {
    console.error(this.formatMessage('error', message, context, trace));
  }

  warn(message: any, context?: string): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  debug(message: any, context?: string): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  verbose(message: any, context?: string): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.formatMessage('verbose', message, context));
    }
  }

  fatal(message: any, context?: string): void {
    console.error(this.formatMessage('fatal', message, context));
  }

  setLogLevels?(levels: LogLevel[]): void {
    // Optionnel : implémenter si nécessaire
  }

  /**
   * Log une requête HTTP avec métadonnées structurées
   */
  logHttpRequest(data: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    ip?: string;
    userAgent?: string;
    userId?: string;
    error?: string;
  }): void {
    const severity = data.statusCode >= 500 ? 'ERROR' 
      : data.statusCode >= 400 ? 'WARNING' 
      : 'INFO';

    const logEntry = {
      severity,
      message: `${data.method} ${data.url} ${data.statusCode} ${data.duration}ms`,
      timestamp: new Date().toISOString(),
      context: 'HTTP',
      httpRequest: {
        requestMethod: data.method,
        requestUrl: data.url,
        status: data.statusCode,
        latency: `${data.duration / 1000}s`,
        remoteIp: data.ip,
        userAgent: data.userAgent,
      },
      ...(data.userId && { userId: data.userId }),
      ...(data.error && { error: data.error }),
      'logging.googleapis.com/labels': {
        application: 'aegis-backend',
        environment: process.env.NODE_ENV || 'development',
      },
    };

    if (data.statusCode >= 500) {
      console.error(JSON.stringify(logEntry));
    } else if (data.statusCode >= 400) {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }
}
