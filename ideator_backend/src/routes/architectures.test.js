const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../services/architectureRecommender', () => ({
  recommendArchitecture: jest.fn(),
  listScenarios: jest.fn(() => [{ id: 'monolito-capas', name: 'Monolito en capas' }]),
}));

const pool = require('../config/db');
const { recommendArchitecture } = require('../services/architectureRecommender');
const routes = require('./architectures');

const app = express();
app.use(express.json());
app.use('/api/projects', routes);

describe('Recomendación de arquitectura', () => {
  const token = jwt.sign({ id: 7, email: 'owner@example.com' }, process.env.JWT_SECRET || 'secret_key');

  beforeEach(() => jest.clearAllMocks());

  test('403 si el usuario no pertenece al proyecto', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get('/api/projects/10/architecture')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
  });

  test('409 si faltan etapas previas', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // authorize
      .mockResolvedValueOnce({ rows: [] }) // sections
      .mockResolvedValueOnce({ rows: [] }) // features
      .mockResolvedValueOnce({ rows: [] }) // journey
      .mockResolvedValueOnce({ rows: [] }) // model
      .mockResolvedValueOnce({ rows: [] }) // endpoints
      .mockResolvedValueOnce({ rows: [] }) // screens
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }); // roles

    const response = await request(app)
      .post('/api/projects/10/architecture/recommend')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(409);
    expect(response.body.missing).toEqual(
      expect.arrayContaining([
        'definición inicial',
        'modelo de datos',
        'especificación de endpoints',
        'mapa de pantallas',
      ])
    );
  });

  test('un viewer no puede recomendar la arquitectura', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ rol: 'viewer' }] });

    const response = await request(app)
      .post('/api/projects/10/architecture/recommend')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
  });

  test('201 recomienda y persiste la arquitectura con todas las etapas', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    client.query.mockResolvedValue({});

    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // authorize
      .mockResolvedValueOnce({ rows: [{ seccion: 'problem', respuesta: 'x' }] }) // sections
      .mockResolvedValueOnce({ rows: [{ alcance: 'in', descripcion: 'y' }] }) // features
      .mockResolvedValueOnce({ rows: [{ descripcion: 'z' }] }) // journey
      .mockResolvedValueOnce({ rows: [{ id: 20, estado: 'approved' }] }) // model
      .mockResolvedValueOnce({ rows: [{ metodo: 'GET', ruta: '/api/x' }] }) // endpoints
      .mockResolvedValueOnce({ rows: [{ clave: 'inicio', nombre: 'Inicio', roles: ['owner'] }] }) // screens
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // roles
      .mockResolvedValueOnce({ rows: [{ id: 31, nombre: 'proyectos' }] }) // entities
      .mockResolvedValueOnce({ rows: [] }) // attributes
      .mockResolvedValueOnce({ rows: [] }) // relationships
      .mockResolvedValueOnce({ rows: [{ id: 50, escenario: 'monolito-capas', justificacion: 'Explicación', tecnologias: {}, operacion: {}, alternativas: [], estado: 'draft' }] });

    recommendArchitecture.mockResolvedValue({
      scenario: 'monolito-capas',
      rationale: 'Justificación suficientemente larga para explicar el porqué de la arquitectura elegida.',
      technologies: { frontend: 'React', backend: 'Node.js', database: 'PostgreSQL' },
      operational: { docker: 'Docker Compose' },
      alternatives: [],
    });

    const response = await request(app)
      .post('/api/projects/10/architecture/recommend')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(201);
    expect(response.body.architecture.scenario).toBe('monolito-capas');
    expect(recommendArchitecture).toHaveBeenCalledWith(
      expect.objectContaining({
        dataModel: expect.objectContaining({ estado: 'approved' }),
        endpoints: expect.any(Array),
        screens: expect.any(Array),
      })
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO arquitecturas'),
      expect.any(Array)
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('el owner aprueba la recomendación', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // authorize
      .mockResolvedValueOnce({ rows: [{ id: 50, estado: 'approved' }] }) // UPDATE
      .mockResolvedValueOnce({}) // recordActivity
      .mockResolvedValueOnce({ rows: [{ id: 50, escenario: 'monolito-capas', justificacion: 'Explicación', tecnologias: {}, operacion: {}, alternativas: [], estado: 'approved' }] });

    const response = await request(app)
      .post('/api/projects/10/architecture/approve')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.architecture.estado).toBe('approved');
  });
});
