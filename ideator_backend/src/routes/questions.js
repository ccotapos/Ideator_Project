// ideator_backend/src/routes/questions.js
const { Router } = require('express');
const { canCloseStage } = require('../services/questionService');
// (Opcional) Importa tu middleware de autenticación si lo requiere, ej: const auth = require('../middleware/auth');

const router = Router();

// Endpoint para validar si se puede cerrar la etapa evaluando las preguntas bloqueantes
router.post('/validate-stage', async (req, res) => {
    try {
        const { questions } = req.body;
        
        if (!questions || !Array.isArray(questions)) {
            return res.status(400).json({ error: 'Se requiere un arreglo de preguntas.' });
        }

        const validation = canCloseStage(questions);

        if (!validation.allowed) {
            return res.status(400).json({ error: validation.message });
        }

        return res.status(200).json({ success: true, message: validation.message });
    } catch (error) {
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;