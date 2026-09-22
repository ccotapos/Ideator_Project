const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({
  connect: jest.fn(),
  query: jest.fn(),
}));

const pool = require('../config/db');
const definitionRoutes = require('./definition');

const app = express();
app.use(express.json());
app.use('/api/projects', definitionRoutes);

describe('Definición guiada del proyecto', () => {
  const token = jwt.sign(
    { id: 7, email: 'owner@example.com' },
    process.env.JWT_SECRET || 'secret_key'
  );
  const client = { query: jest.fn(), release: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    pool.connect.mockResolvedValue(client);
  });

  test('ID-31 recorre y persiste problema, contexto y usuarios objetivo', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ rol: 'owner' }] });

    const questionsResponse = await request(app)
      .get('/api/projects/10/definition/questions')
      .set('Authorization', `Bearer ${token}`);

    expect(questionsResponse.statusCode).toBe(200);
    expect(Object.keys(questionsResponse.body.questions)).toEqual([
      'problem',
      'context',
      'target_users',
    ]);

    client.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ seccion: 'problem' }] })
      .mockResolvedValueOnce({ rows: [{ seccion: 'context' }] })
      .mockResolvedValueOnce({ rows: [{ seccion: 'target_users' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const saveResponse = await request(app)
      .put('/api/projects/10/definition/sections')
      .set('Authorization', `Bearer ${token}`)
      .send({
        problem: 'Los equipos pierden acuerdos importantes.',
        context: 'Trabajo remoto con varias herramientas.',
        targetUsers: 'Equipos pequeños de producto.',
      });

    expect(saveResponse.statusCode).toBe(200);
    expect(saveResponse.body.sections).toHaveLength(3);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO definicion_secciones'),
      ['10', 'target_users', 'Equipos pequeños de producto.', 7]
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('ID-32 persiste alcance del MVP y recorrido en orden', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [{ rol: 'editor' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const response = await request(app)
      .put('/api/projects/10/definition/mvp')
      .set('Authorization', `Bearer ${token}`)
      .send({
        inScope: ['Crear proyecto', 'Definir problema'],
        outOfScope: ['Facturación'],
        journey: ['Crear proyecto', 'Responder preguntas', 'Revisar definición'],
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.mvp.inScope).toEqual(['Crear proyecto', 'Definir problema']);
    expect(response.body.mvp.outOfScope).toEqual(['Facturación']);
    expect(response.body.mvp.journey).toEqual([
      'Crear proyecto',
      'Responder preguntas',
      'Revisar definición',
    ]);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO recorrido_principal'),
      ['10', 2, 'Revisar definición', 7]
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });
});
