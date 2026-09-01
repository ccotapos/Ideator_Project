const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({
  connect: jest.fn(),
}));

const pool = require('../config/db');
const projectRoutes = require('./projects');

const app = express();
app.use(express.json());
app.use('/projects', projectRoutes);

describe('Projects Endpoints', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    pool.connect.mockResolvedValue(mockClient);
  });

  test('POST /projects - crea un proyecto privado y asigna al creador como owner', async () => {
    const token = jwt.sign(
      { id: 7, email: 'owner@example.com' },
      process.env.JWT_SECRET || 'secret_key',
    );

    const createdProject = {
      id: 15,
      nombre: 'Proyecto privado',
      descripcion: 'Definicion inicial',
      is_private: true,
      created_at: new Date().toISOString(),
    };

    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [createdProject] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Proyecto privado',
        descripcion: 'Definicion inicial',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.project).toMatchObject({
      id: 15,
      nombre: 'Proyecto privado',
      descripcion: 'Definicion inicial',
      is_private: true,
    });
    expect(res.body.role).toBe('owner');
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO proyectos'),
      ['Proyecto privado', 'Definicion inicial'],
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO proyecto_usuario'),
      [7, 15],
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('POST /projects - retorna 401 si no hay token valido', async () => {
    const res = await request(app)
      .post('/projects')
      .send({ nombre: 'Sin token' });

    expect(res.statusCode).toBe(401);
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
