const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { getIdeatorReply } = require('../config/gemini');

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
      `SELECT m.id, m.remitente, m.contenido, m.created_at, u.name AS usuario_nombre
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

    // Guarda el mensaje del usuario
    const userMessageResult = await pool.query(
      `INSERT INTO mensajes (proyecto_id, usuario_id, remitente, contenido)
       VALUES ($1, $2, 'usuario', $3)
       RETURNING id, remitente, contenido, created_at;`,
      [projectId, userId, content.trim()]
    );
    const userMessage = userMessageResult.rows[0];

    // Recupera los últimos mensajes del proyecto como contexto para la IA
    const historyResult = await pool.query(
      `SELECT remitente, contenido FROM mensajes
       WHERE proyecto_id = $1
       ORDER BY created_at DESC
       LIMIT $2;`,
      [projectId, HISTORY_LIMIT]
    );

    const conversationHistory = historyResult.rows.reverse().map((row) => ({
      role: row.remitente === 'usuario' ? 'user' : 'assistant',
      content: row.contenido,
    }));

    // Llama a Claude con el historial reciente
    const ideatorText = await getIdeatorReply(conversationHistory);

    // Guarda la respuesta de Ideator
    const ideatorMessageResult = await pool.query(
      `INSERT INTO mensajes (proyecto_id, usuario_id, remitente, contenido)
       VALUES ($1, NULL, 'ideator', $2)
       RETURNING id, remitente, contenido, created_at;`,
      [projectId, ideatorText]
    );
    const ideatorMessage = ideatorMessageResult.rows[0];

    return res.status(201).json({ userMessage, ideatorMessage });
  } catch (error) {
    console.error('Error al procesar el mensaje del chat:', error);
    return res.status(500).json({ message: 'No se pudo obtener respuesta de Ideator. Intenta nuevamente.' });
  }
});

module.exports = router;