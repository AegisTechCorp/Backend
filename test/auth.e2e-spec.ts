import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import jwtConfig from '../src/config/jwt.config';
import securityConfig from '../src/config/security.config';

describe('Auth Controller (E2E)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;

  // Test user data
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
  };

  beforeAll(async () => {
    // Set test environment variables for JWT
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-e2e-testing';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-e2e-testing';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig, securityConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [User, RefreshToken],
          synchronize: true,
          dropSchema: true,
        }),
        AuthModule,
        UsersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same pipes as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.setGlobalPrefix('api/v1');

    await app.init();
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('/api/v1/auth/register (POST)', () => {
    it('should register a new user successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect((res) => {
          if (res.status !== 201) {
            console.log('Register failed:', res.body);
          }
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body.user.email).toBe(testUser.email);
          expect(res.body.accessToken).toBeDefined();

          // Save tokens for later tests
          accessToken = res.body.accessToken;

          // Check for refreshToken cookie
          const cookies = res.headers['set-cookie'];
          expect(cookies).toBeDefined();
          const refreshCookie = Array.isArray(cookies)
            ? cookies.find((c: string) => c.startsWith('refreshToken='))
            : null;
          expect(refreshCookie).toBeDefined();

          // Extract refresh token from cookie
          if (refreshCookie) {
            refreshToken = refreshCookie.split(';')[0].split('=')[1];
          }
        });
    });

    it('should fail with duplicate email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('should fail with invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
        })
        .expect(400);
    });

    it('should fail with missing password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test2@example.com',
        })
        .expect(400);
    });

    it('should fail with short password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test3@example.com',
          password: 'short',
        })
        .expect(400);
    });
  });

  describe('/api/v1/auth/login (POST)', () => {
    // Wait to ensure JWT timestamps are different (JWTs have second precision)
    beforeAll(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      // Also logout to clean up old token
      if (refreshToken) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/logout')
          .send({ refreshToken });
      }
    });

    it('should login successfully with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body.user.email).toBe(testUser.email);

          // Update tokens
          accessToken = res.body.accessToken;

          const cookies = res.headers['set-cookie'];
          expect(cookies).toBeDefined();

          // Update refresh token from cookie
          const refreshCookie = Array.isArray(cookies)
            ? cookies.find((c: string) => c.startsWith('refreshToken='))
            : null;
          if (refreshCookie) {
            refreshToken = refreshCookie.split(';')[0].split('=')[1];
          }
        });
    });

    it('should fail with wrong password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should fail with non-existent email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        })
        .expect(401);
    });

    it('should fail with invalid email format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid',
          password: 'TestPassword123!',
        })
        .expect(400);
    });
  });

  describe('/api/v1/auth/refresh (POST)', () => {
    // Wait to ensure JWT timestamps are different
    beforeAll(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it('should refresh tokens successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: refreshToken,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body.accessToken).toBeDefined();

          // Update tokens
          accessToken = res.body.accessToken;
        });
    });

    it('should fail with invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);
    });

    it('should fail with missing refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(400);
    });
  });

  describe('/api/v1/auth/logout (POST)', () => {
    it('should logout successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({
          refreshToken: refreshToken,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Déconnexion');
        });
    });

    it('should fail to use refresh token after logout', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: refreshToken,
        })
        .expect(401);
    });
  });
});
