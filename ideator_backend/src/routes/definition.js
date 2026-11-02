const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { recordActivity } = require('../services/activity');
const { validateProjectConsistency } = require('../services/consistencyValidator');

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

async function lockDefinitionRevision(client, projectId, expectedRevision, res) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    res.status(400).json({ message: 'La revisión esperada de la definición es obligatoria.' });
    return null;
  }
  const result = await client.query(
    'SELECT definicion_revision FROM proyectos WHERE id = $1 FOR UPDATE;',
    [projectId]
  );
  if (!result.rows[0]) {
    res.status(404).json({ message: 'Proyecto no encontrado.' });
    return null;
  }
  if (result.rows[0].definicion_revision !== expectedRevision) {
    res.status(409).json({
      message: 'Otro integrante modificó la definición. Recarga la página antes de guardar nuevamente.',
      currentRevision: result.rows[0].definicion_revision,
    });
    return null;
  }
  return result.rows[0].definicion_revision;
}

async function incrementDefinitionRevision(client, projectId) {
  const result = await client.query(
    `UPDATE proyectos SET definicion_revision = definicion_revision + 1
     WHERE id = $1 RETURNING definicion_revision;`,
    [projectId]
  );
  return result.rows[0].definicion_revision;
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
  const expectedRevision = req.body.expectedRevision;

  if (Object.values(answers).some((answer) => !answer || !answer.trim())) {
    return res.status(400).json({
      message: 'Problema, contexto y usuarios objetivo son obligatorios.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const role = await getMembership(userId, projectId, client);
    if (!canEdit(role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'No tienes permisos para editar la definición.' });
    }
    if (await lockDefinitionRevision(client, projectId, expectedRevision, res) === null) {
      await client.query('ROLLBACK');
      return;
    }
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
    const revision = await incrementDefinitionRevision(client, projectId);
    await client.query('COMMIT');

    return res.status(200).json({ sections: savedSections, revision });
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
  const expectedRevision = req.body.expectedRevision;

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
    await client.query('BEGIN');
    const role = await getMembership(userId, projectId, client);
    if (!canEdit(role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'No tienes permisos para editar el MVP.' });
    }
    if (await lockDefinitionRevision(client, projectId, expectedRevision, res) === null) {
      await client.query('ROLLBACK');
      return;
    }
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
    const revision = await incrementDefinitionRevision(client, projectId);
    await client.query('COMMIT');

    return res.status(200).json({
      mvp: {
        inScope: inScope.map((item) => item.trim()),
        outOfScope: outOfScope.map((item) => item.trim()),
        journey: journey.map((item) => item.trim()),
      },
      revision,
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

    const [sectionsResult, featuresResult, journeyResult, revisionResult] = await Promise.all([
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
      pool.query('SELECT definicion_revision FROM proyectos WHERE id = $1;', [projectId]),
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
        revision: revisionResult.rows[0]?.definicion_revision || 0,
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

// GET /api/projects/:id/definition/validate - Valida la consistencia global del proyecto antes de la generación
router.get('/:id/definition/validate', authenticateToken, async (req, res) => {
  const projectId = req.params.id;

  try {
    const role = await getMembership(req.user.id, projectId);
    if (!role) {
      return res.status(403).json({ message: 'Acceso denegado. No perteneces a este proyecto.' });
    }

    const [sectionsResult, featuresResult, journeyResult, modelResult, endpointsResult, screensResult, architectureResult, blockingResult] = await Promise.all([
      pool.query(`SELECT seccion, respuesta FROM definicion_secciones WHERE proyecto_id = $1;`, [projectId]),
      pool.query(`SELECT alcance, descripcion FROM mvp_funcionalidades WHERE proyecto_id = $1;`, [projectId]),
      pool.query(`SELECT descripcion FROM recorrido_principal WHERE proyecto_id = $1;`, [projectId]),
      pool.query(`SELECT id, estado FROM modelos_datos WHERE proyecto_id = $1;`, [projectId]),
      pool.query(`SELECT e.metodo, e.ruta, e.operacion, e.entidad, e.atributos
                  FROM endpoints e
                  JOIN especificaciones_endpoints s ON s.id = e.especificacion_id
                  WHERE s.proyecto_id = $1 ORDER BY e.posicion, e.id;`, [projectId]),
      pool.query(`SELECT p.clave, p.nombre, p.roles, p.controles
                  FROM pantallas p
                  JOIN mapas_pantallas m ON m.id = p.mapa_id
                  WHERE m.proyecto_id = $1 ORDER BY p.posicion, p.id;`, [projectId]),
      pool.query(`SELECT escenario, estado FROM arquitecturas WHERE proyecto_id = $1;`, [projectId]),
      pool.query(
        `SELECT categoria, pregunta FROM preguntas_bloqueantes
         WHERE proyecto_id = $1 AND resuelta = FALSE ORDER BY created_at;`,
        [projectId]
      ),
    ]);

    let entities = [];
    if (modelResult.rows[0]) {
      const [entityResult, attributeResult] = await Promise.all([
        pool.query('SELECT id, nombre FROM modelo_entidades WHERE modelo_id = $1;', [modelResult.rows[0].id]),
        pool.query(`SELECT a.* FROM modelo_atributos a
                    JOIN modelo_entidades e ON e.id = a.entidad_id
                    WHERE e.modelo_id = $1;`, [modelResult.rows[0].id]),
      ]);
      entities = entityResult.rows.map((entity) => ({
        ...entity,
        attributes: attributeResult.rows.filter((attribute) => attribute.entidad_id === entity.id),
      }));
    }

    const projectData = {
      architecture: architectureResult.rows[0] || null,
      dataModel: { entities },
      spec: { endpoints: endpointsResult.rows },
      screens: { views: screensResult.rows },
      definition: {
        sections: sectionsResult.rows,
        mvp: {
          inScope: featuresResult.rows.filter(r => r.alcance === 'in').map(r => r.descripcion),
          outOfScope: featuresResult.rows.filter(r => r.alcance === 'out').map(r => r.descripcion),
          journey: journeyResult.rows.map(r => r.descripcion)
        }
      }
    };

    const validation = validateProjectConsistency(projectData);
    if (blockingResult.rows.length > 0) {
      validation.valid = false;
      validation.errors.push(
        ...blockingResult.rows.map((item) =>
          `Pregunta bloqueante pendiente (${item.categoria}): ${item.pregunta}`
        )
      );
    }

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Se encontraron inconsistencias entre las etapas del proyecto.',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    return res.status(200).json({
      success: true,
      message: 'El proyecto es consistente y está listo para la generación.',
      warnings: validation.warnings
    });

  } catch (error) {
    console.error('Error al validar la consistencia del proyecto:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

module.exports = router;
