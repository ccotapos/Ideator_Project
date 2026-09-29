// ideator_backend/src/routes/questions.test.js
const { evaluateQuestion, canCloseStage } = require('../services/questionService');

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