import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: true, // TypeORM crée/modifie les tables automatiquement
    logging: process.env.NODE_ENV === 'development',
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    // Configuration pour Neon DB (cold start) et Cloud Run
    connectTimeoutMS: 30000,
    extra: {
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      max: 5,
    },
    retryAttempts: 5,
    retryDelay: 3000,
  }),
);
