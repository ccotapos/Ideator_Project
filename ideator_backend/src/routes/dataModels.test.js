const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../services/dataModelGenerator', () => ({
  generateDataModel: jest.fn().mockResolvedValue({
    entities: [
      { name: 'usuarios', attributes: [{ name: 'id', type: 'SERIAL', nullable: false, primaryKey: true }] },
      { name: 'proyectos', attributes: [{ name: 'id', type: 'SERIAL', nullable: false, primaryKey: true }] },
    ],
    relationships: [],
  }),
}));

const pool = require('../config/db');
const routes = require('./dataModels');
const app = express();
app.use(express.json());
app.use('/api/projects', routes);

describe('Modelo de datos colaborativo', () => {
  const token = jwt.sign({ id: 7, email: 'owner@example.com' }, process.env.JWT_SECRET || 'secret_key');

  beforeEach(() => jest.clearAllMocks());

  test('genera y persiste una propuesta completa sin errores', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, proyecto_id: 10, estado: 'draft', version: 1 }] })
      .mockResolvedValueOnce({ rows: [
        { id: 31, modelo_id: 20, nombre: 'usuarios', posicion: 0 },
        { id: 32, modelo_id: 20, nombre: 'proyectos', posicion: 1 },
      ] })
      .mockResolvedValueOnce({ rows: [
        { id: 41, entidad_id: 31, nombre: 'id', tipo_dato: 'SERIAL', es_pk: true },
        { id: 42, entidad_id: 32, nombre: 'id', tipo_dato: 'SERIAL', es_pk: true },
      ] })
      .mockResolvedValueOnce({ rows: [] });
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ seccion: 'problem', respuesta: 'Falta coordinación' }] })
      .mockResolvedValueOnce({ rows: [{ descripcion: 'Crear proyecto' }] })
      .mockResolvedValueOnce({ rows: [{ descripcion: 'Definir problema' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 20 }] })
      .mockResolvedValueOnce({ rows: [{ id: 31 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 32 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const response = await request(app).post('/api/projects/10/data-model/generate')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(201);
    expect(response.body.model.entities).toHaveLength(2);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('un editor puede crear una entidad en un borrador', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'editor' }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, estado: 'draft' }] })
      .mockResolvedValueOnce({ rows: [{ id: 30, nombre: 'decisiones' }] });
    const response = await request(app).post('/api/projects/10/data-model/entities')
      .set('Authorization', `Bearer ${token}`).send({ name: 'decisiones' });
    expect(response.statusCode).toBe(201);
    expect(response.body.entity.nombre).toBe('decisiones');
  });

  test('un editor puede editar y eliminar una entidad', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'editor' }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, estado: 'draft' }] })
      .mockResolvedValueOnce({ rows: [{ id: 30, nombre: 'decisiones_equipo' }] })
      .mockResolvedValueOnce({ rows: [{ rol: 'editor' }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, estado: 'draft' }] })
      .mockResolvedValueOnce({ rows: [{ id: 30 }] });

    const updateResponse = await request(app).put('/api/projects/10/data-model/entities/30')
      .set('Authorization', `Bearer ${token}`).send({ name: 'decisiones_equipo' });
    const deleteResponse = await request(app).delete('/api/projects/10/data-model/entities/30')
      .set('Authorization', `Bearer ${token}`);

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.entity.nombre).toBe('decisiones_equipo');
    expect(deleteResponse.statusCode).toBe(204);
  });

  test('un usuario sin permiso no puede editar', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ rol: 'viewer' }] });
    const response = await request(app).post('/api/projects/10/data-model/entities')
      .set('Authorization', `Bearer ${token}`).send({ name: 'decisiones' });
    expect(response.statusCode).toBe(403);
  });

  test('bloquea la edición después de aprobar', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] })
      .mockResolvedValueOnce({ rows: [{ id: 20, estado: 'approved' }] });
    const response = await request(app).delete('/api/projects/10/data-model/entities/30')
      .set('Authorization', `Bearer ${token}`);
    expect(response.statusCode).toBe(409);
    expect(response.body.message).toMatch(/bloqueado/);
  });
});
