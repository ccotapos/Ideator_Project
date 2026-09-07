// Configuración previa de variables de entorno para tests
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5433';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

require('dotenv').config();

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const authRoutes = require('./auth');
const pool = require('../config/db');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Cierre global del pool al finalizar TODAS las pruebas del archivo
afterAll(async () => {
  await pool.end();
});

describe('Auth Endpoints (Register, Login)', () => {
  const testUser = {
    name: 'Test User',
    email: `test_${Date.now()}@example.com`,
    password: 'Password123!',
  };

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM users WHERE email = $1', [testUser.email.toLowerCase()]);
    } catch (error) {
      console.error('Error limpiando base de datos:', error);
    }
  });

  test('POST /api/auth/register - Debería registrar un nuevo usuario exitosamente (201)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
  });

  test('POST /api/auth/login - Debería autenticar exitosamente y devolver un JWT válido (200)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(typeof res.body.token).toBe('string');
  });

  test('POST /api/auth/login - Debería retornar 401 ante una contraseña incorrecta', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword',
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Credenciales inválidas.');
  });

  test('POST /api/auth/login - Debería retornar 401 ante un usuario inexistente', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'noexisto@example.com',
        password: 'somepassword',
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Credenciales inválidas.');
  });
});

describe('GET /api/auth/me (Ruta protegida)', () => {
  const meUser = {
    name: 'Me User',
    email: `me_${Date.now()}@example.com`,
    password: 'Password123!',
  };
  let validToken;

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send(meUser);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: meUser.email, password: meUser.password });
    validToken = loginRes.body.token;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM users WHERE email = $1', [meUser.email.toLowerCase()]);
    } catch (error) {
      console.error('Error limpiando usuario me:', error);
    }
  });

  test('con un token válido responde 200 y los datos del usuario', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe(meUser.email.toLowerCase());
  });

  test('sin token responde 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.statusCode).toBe(401);
  });

  test('con un token expirado responde 401', async () => {
    const expiredToken = jwt.sign(
      { id: 1, email: meUser.email },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: -10 }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/expirad/i);
  });

  test('con un token corrupto responde 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token.corrupto.invalido');

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/inválido/i);
  });
});