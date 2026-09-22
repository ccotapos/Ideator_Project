const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { recordActivity } = require('../services/activity');

const router = express.Router();

const questions = {
  problem: [
    '¿Qué problema concreto quieren resolver?',
    '¿Qué consecuencias tiene hoy ese problema?',
  ],
  context: [
    '¿En qué contexto ocurre el problema?',
    '¿Qué restricciones o condiciones deben considerar?',
  ],
  target_users: [
    '¿Quiénes viven este problema directamente?',
    '¿Qué necesitan lograr esos usuarios?',
  ],
};

async function getMembership(userId, projectId, queryable = pool) {
  const result = await queryable.query(
    `SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;`,
    [userId, projectId]
  );
  return result.rows[0]?.rol || null;
}

function canEdit(role) {
  return role === 'owner' || role === 'editor';
}

// GET /api/projects/:id/definition/questions - Flujo de preguntas por sección
router.get('/:id/definition/questions', authenticateToken, async (req, res) => {
  try {
    const role = await getMembership(req.user.id, req.params.id);
    if (!role) {
      return res.status(403).json({ message: 'Acceso denegado. No perteneces a este proyecto.' });
    }

    return res.status(200).json({ questions });
  } catch (error) {
    console.error('Error al obtener preguntas de definición:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// PUT /api/projects/:id/definition/sections - Guarda problema, contexto y usuarios objetivo
router.put('/:id/definition/sections', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;
  const answers = {
    problem: req.body.problem,
    context: req.body.context,
    target_users: req.body.targetUsers,
  };

  if (Object.values(answers).some((answer) => !answer || !answer.trim())) {
    return res.status(400).json({
      message: 'Problema, contexto y usuarios objetivo son obligatorios.',
    });
  }

  const client = await pool.connect();

  try {
    const role = await getMembership(userId, projectId, client);
    if (!canEdit(role)) {
      return res.status(403).json({ message: 'No tienes permisos para editar la definición.' });
    }

    await client.query('BEGIN');
    const savedSections = [];

    for (const [section, answer] of Object.entries(answers)) {
      const result = await client.query(
        `INSERT INTO definicion_secciones
           (proyecto_id, seccion, respuesta, respondido_por)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (proyecto_id, seccion)
         DO UPDATE SET respuesta = EXCLUDED.respuesta,
                       respondido_por = EXCLUDED.respondido_por,
                       updated_at = CURRENT_TIMESTAMP
         RETURNING id, seccion, respuesta, respondido_por, updated_at;`,
        [projectId, section, answer.trim(), userId]
      );
      savedSections.push(result.rows[0]);
    }

    await recordActivity(client, {
      projectId,
      userId,
      action: 'definition_sections_updated',
      details: { sections: Object.keys(answers) },
    });
    await client.query('COMMIT');

    return res.status(200).json({ sections: savedSections });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al guardar definición:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

// PUT /api/projects/:id/definition/mvp - Reemplaza alcance y recorrido principal
router.put('/:id/definition/mvp', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;
  const { inScope, outOfScope, journey } = req.body;

  const validLists = [inScope, outOfScope, journey].every(
    (list) => Array.isArray(list) && list.length > 0 && list.every((item) => typeof item === 'string' && item.trim())
  );
  if (!validLists) {
    return res.status(400).json({
      message: 'Debes indicar funcionalidades dentro y fuera del MVP y al menos un paso del recorrido.',
    });
  }

  const client = await pool.connect();

  try {
    const role = await getMembership(userId, projectId, client);
    if (!canEdit(role)) {
      return res.status(403).json({ message: 'No tienes permisos para editar el MVP.' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM mvp_funcionalidades WHERE proyecto_id = $1;', [projectId]);
    await client.query('DELETE FROM recorrido_principal WHERE proyecto_id = $1;', [projectId]);

    for (const [scope, features] of [['in', inScope], ['out', outOfScope]]) {
      for (const [position, description] of features.entries()) {
        await client.query(
          `INSERT INTO mvp_funcionalidades
             (proyecto_id, alcance, descripcion, posicion, creado_por)
           VALUES ($1, $2, $3, $4, $5);`,
          [projectId, scope, description.trim(), position, userId]
        );
      }
    }

    for (const [position, description] of journey.entries()) {
      await client.query(
        `INSERT INTO recorrido_principal
           (proyecto_id, posicion, descripcion, creado_por)
         VALUES ($1, $2, $3, $4);`,
        [projectId, position, description.trim(), userId]
      );
    }

    await recordActivity(client, {
      projectId,
      userId,
      action: 'mvp_definition_updated',
      details: {
        inScopeCount: inScope.length,
        outOfScopeCount: outOfScope.length,
        journeyStepCount: journey.length,
      },
    });
    await client.query('COMMIT');

    return res.status(200).json({
      mvp: {
        inScope: inScope.map((item) => item.trim()),
        outOfScope: outOfScope.map((item) => item.trim()),
        journey: journey.map((item) => item.trim()),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al guardar MVP:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

// GET /api/projects/:id/definition - Definición completa persistida
router.get('/:id/definition', authenticateToken, async (req, res) => {
  const projectId = req.params.id;

  try {
    const role = await getMembership(req.user.id, projectId);
    if (!role) {
      return res.status(403).json({ message: 'Acceso denegado. No perteneces a este proyecto.' });
    }

    const [sectionsResult, featuresResult, journeyResult] = await Promise.all([
      pool.query(
        `SELECT seccion, respuesta, respondido_por, updated_at
         FROM definicion_secciones WHERE proyecto_id = $1;`,
        [projectId]
      ),
      pool.query(
        `SELECT alcance, descripcion, posicion
         FROM mvp_funcionalidades
         WHERE proyecto_id = $1 ORDER BY alcance, posicion;`,
        [projectId]
      ),
      pool.query(
        `SELECT descripcion, posicion
         FROM recorrido_principal
         WHERE proyecto_id = $1 ORDER BY posicion;`,
        [projectId]
      ),
    ]);

    const sections = Object.fromEntries(
      sectionsResult.rows.map((row) => [row.seccion, row])
    );
    const inScope = featuresResult.rows
      .filter((row) => row.alcance === 'in')
      .map((row) => row.descripcion);
    const outOfScope = featuresResult.rows
      .filter((row) => row.alcance === 'out')
      .map((row) => row.descripcion);

    return res.status(200).json({
      definition: {
        sections,
        mvp: {
          inScope,
          outOfScope,
          journey: journeyResult.rows.map((row) => row.descripcion),
        },
      },
    });
  } catch (error) {
    console.error('Error al obtener definición:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

module.exports = router;
