const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({ query: jest.fn() }));
jest.mock('../config/gemini', () => ({ getIdeatorReply: jest.fn() }));

const pool = require('../config/db');
const chatRoutes = require('./chat');

const app = express();
app.use(express.json());
app.use('/api/projects', chatRoutes);

describe('Modelo conversacional', () => {
  const secret = process.env.JWT_SECRET || 'secret_key';
  const token = jwt.sign({ id: 7, email: 'owner@example.com' }, secret);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registra la decisión con el usuario autenticado como autor', async () => {
    const decision = {
      id: 21,
      sesion_id: 4,
      usuario_id: 7,
      titulo: 'Base de datos',
      contenido: 'Usaremos PostgreSQL',
    };

    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] })
      .mockResolvedValueOnce({ rows: [{ id: 4, proyecto_id: 10, estado: 'active' }] })
      .mockResolvedValueOnce({ rows: [decision] })
      .mockResolvedValueOnce({});

    const response = await request(app)
      .post('/api/projects/10/decisions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Base de datos', content: 'Usaremos PostgreSQL' });

    expect(response.statusCode).toBe(201);
    expect(response.body.decision.usuario_id).toBe(7);
    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO decisiones'),
      [4, 7, 'Base de datos', 'Usaremos PostgreSQL']
    );
  });

  test('devuelve las decisiones con sus autores ordenadas por fecha', async () => {
    const decisions = [
      { id: 2, usuario_id: 7, usuario_nombre: 'Diego' },
      { id: 1, usuario_id: 3, usuario_nombre: 'Camila' },
    ];

    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'editor' }] })
      .mockResolvedValueOnce({ rows: decisions });

    const response = await request(app)
      .get('/api/projects/10/decisions')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.decisions).toEqual(decisions);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('ORDER BY d.created_at DESC'),
      ['10']
    );
  });
});
