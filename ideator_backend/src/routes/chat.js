const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { getIdeatorReply } = require('../config/gemini');
const { recordActivity } = require('../services/activity');

const router = express.Router();

const HISTORY_LIMIT = 20; // últimos mensajes que se envían como contexto a la IA

// Verifica que el usuario pertenezca al proyecto; retorna su rol o null.
async function getMembership(userId, projectId) {
  const result = await pool.query(
    `SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;`,
    [userId, projectId]
  );
  return result.rows[0]?.rol || null;
}

async function getOrCreateActiveSession(projectId, userId) {
  const activeSession = await pool.query(
    `SELECT id, proyecto_id, created_by, estado, started_at
     FROM sesiones
     WHERE proyecto_id = $1 AND estado = 'active'
     ORDER BY started_at DESC
     LIMIT 1;`,
    [projectId]
  );

  if (activeSession.rows[0]) {
    return activeSession.rows[0];
  }

  const createdSession = await pool.query(
    `INSERT INTO sesiones (proyecto_id, created_by)
     VALUES ($1, $2)
     RETURNING id, proyecto_id, created_by, estado, started_at;`,
    [projectId, userId]
  );

  return createdSession.rows[0];
}

// GET /api/projects/:id/sessions - Sesiones del proyecto
router.get('/:id/sessions', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;

  try {
    const role = await getMembership(userId, projectId);
    if (!role) {
      return res.status(403).json({ message: 'Acceso denegado. No perteneces a este proyecto.' });
    }

    const result = await pool.query(
      `SELECT s.id, s.estado, s.started_at, s.ended_at,
              u.id AS creador_id, u.name AS creador_nombre
       FROM sesiones s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.proyecto_id = $1
       ORDER BY s.started_at DESC, s.id DESC;`,
      [projectId]
    );

    return res.status(200).json({ sessions: result.rows });
  } catch (error) {
    console.error('Error al obtener sesiones:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/projects/:id/messages - Historial de la conversación, ordenado
router.get('/:id/messages', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;

  try {
    const role = await getMembership(userId, projectId);
    if (!role) {
      return res.status(403).json({ message: 'Acceso denegado. No perteneces a este proyecto.' });
    }

    const result = await pool.query(
      `SELECT m.id, m.sesion_id, m.remitente, m.contenido, m.created_at,
              u.name AS usuario_nombre
       FROM mensajes m
       LEFT JOIN users u ON u.id = m.usuario_id
       WHERE m.proyecto_id = $1
       ORDER BY m.created_at ASC;`,
      [projectId]
    );

    return res.status(200).json({ messages: result.rows });
  } catch (error) {
    console.error('Error al obtener historial de mensajes:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/projects/:id/messages - Envía un mensaje y obtiene la respuesta de Ideator
router.post('/:id/messages', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'El mensaje no puede estar vacío.' });
  }

  try {
    const role = await getMembership(userId, projectId);
    if (!role) {
      return res.status(403).json({ message: 'Acceso denegado. No perteneces a este proyecto.' });
    }

    const session = await getOrCreateActiveSession(projectId, userId);

    // Guarda el mensaje del usuario
    const userMessageResult = await pool.query(
      `INSERT INTO mensajes (proyecto_id, sesion_id, usuario_id, remitente, contenido)
       VALUES ($1, $2, $3, 'usuario', $4)
       RETURNING id, sesion_id, remitente, contenido, created_at;`,
      [projectId, session.id, userId, content.trim()]
    );
    const userMessage = userMessageResult.rows[0];

    // Recupera los últimos mensajes del proyecto como contexto para la IA
    const historyResult = await pool.query(
      `SELECT remitente, contenido FROM mensajes
       WHERE sesion_id = $1
       ORDER BY created_at DESC
       LIMIT $2;`,
      [session.id, HISTORY_LIMIT]
    );

    const conversationHistory = historyResult.rows.reverse().map((row) => ({
      role: row.remitente === 'usuario' ? 'user' : 'assistant',
      content: row.contenido,
    }));

    // Llama a Claude con el historial reciente
    const ideatorText = await getIdeatorReply(conversationHistory);

    // Guarda la respuesta de Ideator
    const ideatorMessageResult = await pool.query(
      `INSERT INTO mensajes (proyecto_id, sesion_id, usuario_id, remitente, contenido)
       VALUES ($1, $2, NULL, 'ideator', $3)
       RETURNING id, sesion_id, remitente, contenido, created_at;`,
      [projectId, session.id, ideatorText]
    );
    const ideatorMessage = ideatorMessageResult.rows[0];

    return res.status(201).json({ userMessage, ideatorMessage });
  } catch (error) {
    console.error('Error al procesar el mensaje del chat:', error);
    return res.status(500).json({ message: 'No se pudo obtener respuesta de Ideator. Intenta nuevamente.' });
  }
});

// GET /api/projects/:id/decisions - Decisiones con su autor
router.get('/:id/decisions', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;

  try {
    const role = await getMembership(userId, projectId);
    if (!role) {
      return res.status(403).json({ message: 'Acceso denegado. No perteneces a este proyecto.' });
    }

    const result = await pool.query(
      `SELECT d.id, d.sesion_id, d.titulo, d.contenido, d.created_at,
              u.id AS usuario_id, u.name AS usuario_nombre, u.email AS usuario_email
       FROM decisiones d
       JOIN sesiones s ON s.id = d.sesion_id
       JOIN users u ON u.id = d.usuario_id
       WHERE s.proyecto_id = $1
       ORDER BY d.created_at DESC, d.id DESC;`,
      [projectId]
    );

    return res.status(200).json({ decisions: result.rows });
  } catch (error) {
    console.error('Error al obtener decisiones:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/projects/:id/decisions - Registra una decisión en la sesión activa
router.post('/:id/decisions', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;
  const { title, content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'El contenido de la decisión es obligatorio.' });
  }

  try {
    const role = await getMembership(userId, projectId);
    if (!role) {
      return res.status(403).json({ message: 'Acceso denegado. No perteneces a este proyecto.' });
    }

    const session = await getOrCreateActiveSession(projectId, userId);
    const result = await pool.query(
      `INSERT INTO decisiones (sesion_id, usuario_id, titulo, contenido)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sesion_id, usuario_id, titulo, contenido, created_at;`,
      [session.id, userId, title?.trim() || null, content.trim()]
    );

    await recordActivity(pool, {
      projectId,
      userId,
      action: 'decision_created',
      details: { decisionId: result.rows[0].id, sessionId: session.id },
    });

    return res.status(201).json({ decision: result.rows[0] });
  } catch (error) {
    console.error('Error al registrar decisión:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

module.exports = router;
