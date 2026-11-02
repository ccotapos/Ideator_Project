const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../services/consistencyValidator', () => ({
  validateSpecConsistency: jest.fn(() => ({ consistent: true, issues: [] })),
}));
jest.mock('../services/contradictionDetector', () => ({ detectContradictions: jest.fn() }));
jest.mock('../services/documentGenerator', () => ({
  generateSpecification: jest.fn(),
  generateArchitecture: jest.fn(),
}));

const pool = require('../config/db');
const { detectContradictions } = require('../services/contradictionDetector');
const { generateSpecification, generateArchitecture } = require('../services/documentGenerator');
const routes = require('./finalDocuments');

const app = express();
app.use(express.json());
app.use('/api/projects', routes);

describe('Documentos finales y contradicciones', () => {
  const token = jwt.sign({ id: 7, email: 'owner@example.com' }, process.env.JWT_SECRET || 'secret_key');

  beforeEach(() => jest.clearAllMocks());

  test('403 si el usuario no pertenece al proyecto', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get('/api/projects/10/contradictions')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
  });

  test('bloquea la generación si hay contradicciones y las reporta', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] })
      .mockResolvedValue({ rows: [] });

    detectContradictions.mockReturnValue({
      hasContradictions: true,
      contradictions: [{
        code: 'modelo_no_aprobado',
        stage: 'modelo',
        tab: 'modelo',
        stages: ['modelo'],
        message: 'El modelo de datos no está aprobado.',
      }],
    });

    const response = await request(app)
      .post('/api/projects/10/final-documents/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'especificacion' });

    expect(response.statusCode).toBe(409);
    expect(response.body.contradictions).toHaveLength(1);
    expect(response.body.contradictions[0].stage).toBe('modelo');
    expect(generateSpecification).not.toHaveBeenCalled();
  });

  test('genera y persiste la especificación y la arquitectura sin contradicciones', async () => {
    const client = { query: jest.fn().mockResolvedValue({}), release: jest.fn() };
    pool.connect.mockResolvedValue(client);

    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // authorize
      .mockResolvedValueOnce({ rows: [] }) // sections
      .mockResolvedValueOnce({ rows: [] }) // features
      .mockResolvedValueOnce({ rows: [] }) // journey
      .mockResolvedValueOnce({ rows: [] }) // model
      .mockResolvedValueOnce({ rows: [] }) // spec
      .mockResolvedValueOnce({ rows: [] }) // map
      .mockResolvedValueOnce({ rows: [] }) // architecture
      .mockResolvedValueOnce({ rows: [] }) // decisions
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // roles
      .mockResolvedValueOnce({ rows: [] }) // blocking questions
      .mockResolvedValueOnce({ rows: [ // loadDocuments
        { tipo: 'especificacion', contenido_md: '# Especificación', updated_at: '2026-01-01' },
        { tipo: 'arquitectura', contenido_md: '# Arquitectura', updated_at: '2026-01-01' },
      ] });

    detectContradictions.mockReturnValue({ hasContradictions: false, contradictions: [] });
    generateSpecification.mockResolvedValue('# Especificación completa');
    generateArchitecture.mockResolvedValue('# Arquitectura definitiva');

    const response = await request(app)
      .post('/api/projects/10/final-documents/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.statusCode).toBe(201);
    expect(generateSpecification).toHaveBeenCalled();
    expect(generateArchitecture).toHaveBeenCalled();
    expect(response.body.documents.especificacion.contenido).toBe('# Especificación');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO documentos_finales'),
      expect.any(Array)
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('devuelve los documentos finales guardados', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'editor' }] })
      .mockResolvedValueOnce({ rows: [{ tipo: 'arquitectura', contenido_md: '# Arquitectura', updated_at: '2026-01-01' }] });

    const response = await request(app)
      .get('/api/projects/10/final-documents')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.documents.arquitectura.contenido).toBe('# Arquitectura');
    expect(response.body.documents.especificacion).toBeNull();
  });
});
