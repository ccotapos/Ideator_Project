process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
process.env.SSO_ISSUER_URL = 'https://mock-provider.test';
process.env.SSO_CLIENT_ID = 'mock-client-id';
process.env.SSO_CLIENT_SECRET = 'mock-client-secret';
process.env.SSO_REDIRECT_URI = 'http://localhost:3000/api/auth/sso/callback';
process.env.SSO_PROVIDER_NAME = 'mock-provider';

const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({
  connect: jest.fn(),
}));

const mockAuthorizationUrl = jest.fn(() => 'https://mock-provider.test/authorize?state=abc');
const mockCallback = jest.fn();
const mockCallbackParams = jest.fn((req) => req.query);

jest.mock('openid-client', () => ({
  Issuer: {
    discover: jest.fn().mockResolvedValue({
      Client: jest.fn().mockImplementation(() => ({
        authorizationUrl: mockAuthorizationUrl,
        callback: mockCallback,
        callbackParams: mockCallbackParams,
      })),
    }),
  },
  generators: {
    state: () => 'mock-state',
    nonce: () => 'mock-nonce',
  },
}));

const pool = require('../config/db');
const ssoRoutes = require('./sso');

const app = express();
app.use(express.json());
app.use('/api/auth/sso', ssoRoutes);

const mockClient = { query: jest.fn(), release: jest.fn() };

describe('SSO Endpoints (proveedor mock)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.connect.mockResolvedValue(mockClient);
  });

  test('GET /login redirige al proveedor externo con un state', async () => {
    const res = await request(app).get('/api/auth/sso/login');

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('mock-provider.test');
    expect(mockAuthorizationUrl).toHaveBeenCalled();
  });

  test('GET /callback crea un usuario nuevo, lo vincula al proveedor y emite un token propio', async () => {
    await request(app).get('/api/auth/sso/login'); // registra el state pendiente

    mockCallback.mockResolvedValueOnce({
      claims: () => ({ sub: 'provider-user-1', email: 'nuevo@example.com', name: 'Usuario Nuevo' }),
    });

    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // sin identidad previa
      .mockResolvedValueOnce({ rows: [] }) // sin usuario con ese correo
      .mockResolvedValueOnce({ rows: [{ id: 42 }] }) // INSERT INTO users
      .mockResolvedValueOnce({}) // INSERT INTO identidades_externas
      .mockResolvedValueOnce({ rows: [{ id: 42, name: 'Usuario Nuevo', email: 'nuevo@example.com' }] })
      .mockResolvedValueOnce({}); // COMMIT

    const res = await request(app).get('/api/auth/sso/callback?state=mock-state&code=abc123');

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/\/sso\/callback\?token=/);
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('GET /callback retorna 400 si el state es inválido o ya fue usado', async () => {
    const res = await request(app).get('/api/auth/sso/callback?state=state-inexistente&code=abc123');

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/inválido/i);
  });
});