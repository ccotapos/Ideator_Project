// 1. Asignar variables de entorno para entorno local antes de requerir la DB
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5433';

require('dotenv').config();

const request = require('supertest');
const express = require('express');
const authRoutes = require('./auth');
const pool = require('../config/db');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Endpoints (Register & Login)', () => {
  const testUser = {
    name: 'Test User',
    email: `test_${Date.now()}@example.com`,
    password: 'Password123!'
  };

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM users WHERE email = $1', [testUser.email.toLowerCase()]);
    } catch (error) {
      console.error('Error limpiando base de datos:', error);
    } finally {
      await pool.end();
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
        password: testUser.password
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
        password: 'wrongpassword'
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Credenciales inválidas.');
  });

  test('POST /api/auth/login - Debería retornar 401 ante un usuario inexistente', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'noexisto@example.com',
        password: 'somepassword'
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Credenciales inválidas.');
  });
});