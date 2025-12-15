import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  getHello(): object {
    return {
      status: 'ok',
      message: 'Aegis API Running',
      version: '1.0.0',
    };
  }

  /**
   * Health check complet pour Cloud Run / Monitoring
   * Vérifie la connexion à la base de données
   */
  async healthCheck(): Promise<object> {
    const health: {
      status: string;
      timestamp: string;
      uptime: number;
      database: { status: string; latency?: number; error?: string };
      memory: { used: number; total: number; percentage: number };
    } = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: { status: 'unknown' },
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
    };

    // Vérifier la connexion DB
    try {
      const startTime = Date.now();
      await this.dataSource.query('SELECT 1');
      health.database = {
        status: 'connected',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      health.status = 'unhealthy';
      health.database = {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Mémoire utilisée
    const memUsage = process.memoryUsage();
    health.memory = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    };

    return health;
  }
}
