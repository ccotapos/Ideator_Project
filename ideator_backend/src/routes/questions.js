const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { recordActivity } = require('../services/activity');
const { BLOCKING_CATEGORIES } = require('../services/questionService');

const router = express.Router();

async function membership(userId, projectId) {
  const result = await pool.query(
    'SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;',
    [userId, projectId]
  );
  return result.rows[0]?.rol || null;
}

async function requireEditor(req, res) {
  const role = await membership(req.user.id, req.params.id);
  if (!role) {
    res.status(403).json({ message: 'No perteneces a este proyecto.' });
    return null;
  }
  if (!['owner', 'editor'].includes(role)) {
    res.status(403).json({ message: 'El rol Lector no puede modificar preguntas bloqueantes.' });
    return null;
  }
  return role;
}

router.get('/:id/blocking-questions', authenticateToken, async (req, res) => {
  try {
    if (!await membership(req.user.id, req.params.id)) {
      return res.status(403).json({ message: 'No perteneces a este proyecto.' });
    }
    const result = await pool.query(
      `SELECT p.id, p.categoria, p.pregunta, p.respuesta, p.resuelta,
              p.created_at, p.resolved_at,
              creador.name AS creador_nombre,
              resolutor.name AS resolutor_nombre
       FROM preguntas_bloqueantes p
       JOIN users creador ON creador.id = p.creada_por
       LEFT JOIN users resolutor ON resolutor.id = p.resuelta_por
       WHERE p.proyecto_id = $1
       ORDER BY p.resuelta ASC, p.created_at ASC, p.id ASC;`,
      [req.params.id]
    );
    return res.json({ questions: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron obtener las preguntas bloqueantes.' });
  }
});

router.post('/:id/blocking-questions', authenticateToken, async (req, res) => {
  try {
    if (!await requireEditor(req, res)) return;
    const { category, question } = req.body;
    if (!BLOCKING_CATEGORIES.includes(category) || !question?.trim()) {
      return res.status(400).json({ message: 'Categoría y pregunta bloqueante válidas son obligatorias.' });
    }
    const result = await pool.query(
      `INSERT INTO preguntas_bloqueantes (proyecto_id, categoria, pregunta, creada_por)
       VALUES ($1, $2, $3, $4)
       RETURNING id, categoria, pregunta, respuesta, resuelta, created_at;`,
      [req.params.id, category, question.trim(), req.user.id]
    );
    await recordActivity(pool, {
      projectId: req.params.id,
      userId: req.user.id,
      action: 'blocking_question_created',
      details: { questionId: result.rows[0].id, category },
    });
    return res.status(201).json({ question: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo crear la pregunta bloqueante.' });
  }
});

router.patch('/:id/blocking-questions/:questionId/resolve', authenticateToken, async (req, res) => {
  try {
    if (!await requireEditor(req, res)) return;
    if (!req.body.answer?.trim()) return res.status(400).json({ message: 'La respuesta es obligatoria.' });
    const result = await pool.query(
      `UPDATE preguntas_bloqueantes
       SET respuesta = $1, resuelta = TRUE, resuelta_por = $2, resolved_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND proyecto_id = $4 AND resuelta = FALSE
       RETURNING id, categoria, pregunta, respuesta, resuelta, resolved_at;`,
      [req.body.answer.trim(), req.user.id, req.params.questionId, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Pregunta no encontrada o ya resuelta.' });
    await recordActivity(pool, {
      projectId: req.params.id,
      userId: req.user.id,
      action: 'blocking_question_resolved',
      details: { questionId: result.rows[0].id },
    });
    return res.json({ question: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo resolver la pregunta bloqueante.' });
  }
});

router.get('/:id/validate-stage', authenticateToken, async (req, res) => {
  try {
    if (!await membership(req.user.id, req.params.id)) {
      return res.status(403).json({ message: 'No perteneces a este proyecto.' });
    }
    const result = await pool.query(
      `SELECT id, categoria, pregunta FROM preguntas_bloqueantes
       WHERE proyecto_id = $1 AND resuelta = FALSE ORDER BY created_at, id;`,
      [req.params.id]
    );
    if (result.rows.length) {
      return res.status(409).json({
        allowed: false,
        message: 'No es posible cerrar la etapa: existen preguntas bloqueantes sin resolver.',
        questions: result.rows,
      });
    }
    return res.json({ allowed: true, message: 'Etapa lista para cerrarse.' });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo validar la etapa.' });
  }
});

module.exports = router;
