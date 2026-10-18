const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../services/screenMapGenerator', () => {
  const actual = jest.requireActual('../services/screenMapGenerator');
  return { ...actual, generateScreenMap: jest.fn().mockResolvedValue({
    screens: [
      { key: 'inicio', name: 'Inicio', description: '', entry: true, result: false, roles: ['owner', 'viewer'], controls: [], position: 0 },
      { key: 'resultado', name: 'Resultado', description: '', entry: false, result: true, roles: ['owner', 'viewer'], controls: [], position: 1 },
    ],
    transitions: [{ from: 'inicio', to: 'resultado', action: 'Continuar', roles: ['owner', 'viewer'] }],
  }) };
});

const pool = require('../config/db');
const routes = require('./screenMaps');
const app = express();
app.use(express.json());
app.use('/api/projects', routes);

describe('Generación persistida de mockups', () => {
  const token = jwt.sign({ id: 7, email: 'owner@example.com' }, process.env.JWT_SECRET || 'secret_key');

  beforeEach(() => jest.clearAllMocks());

  test('genera, guarda y devuelve un recorrido navegable', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] })
      .mockResolvedValueOnce({ rows: [{ id: 50, proyecto_id: 10 }] })
      .mockResolvedValueOnce({ rows: [
        { id: 61, clave: 'inicio', nombre: 'Inicio', descripcion: '', es_entrada: true, es_resultado: false, roles: ['owner', 'viewer'], controles: [], posicion: 0 },
        { id: 62, clave: 'resultado', nombre: 'Resultado', descripcion: '', es_entrada: false, es_resultado: true, roles: ['owner', 'viewer'], controles: [], posicion: 1 },
      ] })
      .mockResolvedValueOnce({ rows: [{ id: 70, origen_clave: 'inicio', destino_clave: 'resultado', accion: 'Continuar', roles: ['owner', 'viewer'] }] });
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ alcance: 'in', descripcion: 'Definir producto' }] })
      .mockResolvedValueOnce({ rows: [{ descripcion: 'Abrir proyecto' }] })
      .mockResolvedValueOnce({ rows: [{ metodo: 'GET', ruta: '/projects', operacion: 'Listar' }] })
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }, { rol: 'viewer' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 50 }] })
      .mockResolvedValueOnce({ rows: [{ id: 61 }] })
      .mockResolvedValueOnce({ rows: [{ id: 62 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const response = await request(app).post('/api/projects/10/screen-map/generate').set('Authorization', `Bearer ${token}`);
    expect(response.statusCode).toBe(201);
    expect(response.body.map.screens).toHaveLength(2);
    expect(response.body.map.transitions[0]).toEqual(expect.objectContaining({ from: 'inicio', to: 'resultado' }));
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('impide que un viewer regenere los mockups', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ rol: 'viewer' }] });
    const response = await request(app).post('/api/projects/10/screen-map/generate').set('Authorization', `Bearer ${token}`);
    expect(response.statusCode).toBe(403);
  });
});
