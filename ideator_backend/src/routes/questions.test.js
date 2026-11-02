const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({ query: jest.fn() }));

const { evaluateQuestion, canCloseStage } = require('../services/questionService');
const pool = require('../config/db');
const routes = require('./questions');

const app = express();
app.use(express.json());
app.use('/api/projects', routes);

describe('Módulo de Detección de Preguntas Bloqueantes (Service & DoD)', () => {
    
    test('Debe identificar correctamente un caso bloqueante y uno no bloqueante', () => {
        const blockingInput = { id: 1, category: 'architecture', isResolved: false };
        const nonBlockingInput = { id: 2, category: 'general_feedback', isResolved: false };

        const evaluatedBlocking = evaluateQuestion(blockingInput);
        const evaluatedNonBlocking = evaluateQuestion(nonBlockingInput);

        expect(evaluatedBlocking.isBlocking).toBe(true);
        expect(evaluatedNonBlocking.isBlocking).toBe(false);
    });

    test('Debe impedir cerrar la etapa si hay una pregunta bloqueante sin resolver', () => {
        const questions = [
            { id: 1, category: 'data_model', isResolved: false },
            { id: 2, category: 'copywriting', isResolved: true }
        ];

        const result = canCloseStage(questions);
        expect(result.allowed).toBe(false);
        expect(result.message).toContain('preguntas bloqueantes sin resolver');
    });

    test('Debe permitir cerrar la etapa si todas las preguntas bloqueantes están resueltas', () => {
        const questions = [
            { id: 1, category: 'backend', isResolved: true },
            { id: 2, category: 'interface', isResolved: true }
        ];

        const result = canCloseStage(questions);
        expect(result.allowed).toBe(true);
    });
});

describe('API de preguntas bloqueantes', () => {
    const token = jwt.sign({ id: 7, email: 'editor@example.com' }, process.env.JWT_SECRET || 'secret_key');

    beforeEach(() => jest.clearAllMocks());

    test('guarda una pregunta válida y registra su autor', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ rol: 'editor' }] })
            .mockResolvedValueOnce({ rows: [{ id: 12, categoria: 'backend', pregunta: '¿Qué servicio envía correos?', resuelta: false }] })
            .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
            .post('/api/projects/10/blocking-questions')
            .set('Authorization', `Bearer ${token}`)
            .send({ category: 'backend', question: '¿Qué servicio envía correos?' });

        expect(response.statusCode).toBe(201);
        expect(pool.query).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('INSERT INTO preguntas_bloqueantes'),
            ['10', 'backend', '¿Qué servicio envía correos?', 7]
        );
    });

    test('impide cerrar una etapa con preguntas pendientes', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] })
            .mockResolvedValueOnce({ rows: [{ id: 12, categoria: 'backend', pregunta: 'Pregunta pendiente' }] });

        const response = await request(app)
            .get('/api/projects/10/validate-stage')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(409);
        expect(response.body.allowed).toBe(false);
    });

    test('un Lector no puede resolver preguntas', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ rol: 'viewer' }] });

        const response = await request(app)
            .patch('/api/projects/10/blocking-questions/12/resolve')
            .set('Authorization', `Bearer ${token}`)
            .send({ answer: 'Respuesta' });

        expect(response.statusCode).toBe(403);
    });
});
