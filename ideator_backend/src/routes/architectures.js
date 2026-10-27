const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { recordActivity } = require('../services/activity');
const { recommendArchitecture, listScenarios } = require('../services/architectureRecommender');

const router = express.Router();

async function membership(queryable, userId, projectId) {
  const result = await queryable.query(
    'SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;',
    [userId, projectId]
  );
  return result.rows[0]?.rol;
}

async function authorize(req, res, { ownerOnly = false } = {}) {
  const role = await membership(pool, req.user.id, req.params.id);
  if (!role) { res.status(403).json({ message: 'No perteneces a este proyecto.' }); return null; }
  if (ownerOnly ? role !== 'owner' : !['owner', 'editor'].includes(role)) {
    res.status(403).json({ message: 'No tienes permisos suficientes.' }); return null;
  }
  return role;
}

function mapArchitecture(row) {
  if (!row) return null;
  return {
    id: row.id,
    scenario: row.escenario,
    rationale: row.justificacion,
    technologies: row.tecnologias,
    operational: row.operacion,
    alternatives: row.alternativas,
    estado: row.estado,
  };
}

async function loadArchitecture(queryable, projectId) {
  const result = await queryable.query('SELECT * FROM arquitecturas WHERE proyecto_id = $1;', [projectId]);
  return mapArchitecture(result.rows[0]);
}

async function loadContext(queryable, projectId) {
  const [sections, features, journey, model, endpoints, screens, roles] = await Promise.all([
    queryable.query('SELECT seccion, respuesta FROM definicion_secciones WHERE proyecto_id = $1;', [projectId]),
    queryable.query("SELECT alcance, descripcion FROM mvp_funcionalidades WHERE proyecto_id = $1 ORDER BY alcance, posicion;", [projectId]),
    queryable.query('SELECT descripcion FROM recorrido_principal WHERE proyecto_id = $1 ORDER BY posicion;', [projectId]),
    queryable.query('SELECT * FROM modelos_datos WHERE proyecto_id = $1;', [projectId]),
    queryable.query(`SELECT e.metodo, e.ruta, e.operacion, e.entidad, e.atributos FROM endpoints e JOIN especificaciones_endpoints s ON s.id = e.especificacion_id WHERE s.proyecto_id = $1 ORDER BY e.posicion;`, [projectId]),
    queryable.query('SELECT p.clave, p.nombre, p.roles FROM pantallas p JOIN mapas_pantallas m ON m.id = p.mapa_id WHERE m.proyecto_id = $1 ORDER BY p.posicion;', [projectId]),
    queryable.query('SELECT DISTINCT rol FROM proyecto_usuario WHERE proyecto_id = $1;', [projectId]),
  ]);

  let dataModel = null;
  if (model.rows[0]) {
    const modelId = model.rows[0].id;
    const [entities, attributes, relationships] = await Promise.all([
      queryable.query('SELECT id, nombre FROM modelo_entidades WHERE modelo_id = $1 ORDER BY posicion, id;', [modelId]),
      queryable.query('SELECT a.* FROM modelo_atributos a JOIN modelo_entidades e ON e.id = a.entidad_id WHERE e.modelo_id = $1 ORDER BY a.id;', [modelId]),
      queryable.query('SELECT r.*, eo.nombre AS entidad_origen, ed.nombre AS entidad_destino FROM modelo_relaciones r JOIN modelo_entidades eo ON eo.id = r.entidad_origen_id JOIN modelo_entidades ed ON ed.id = r.entidad_destino_id WHERE r.modelo_id = $1 ORDER BY r.id;', [modelId]),
    ]);
    dataModel = {
      estado: model.rows[0].estado,
      entities: entities.rows.map((entity) => ({
        ...entity,
        attributes: attributes.rows.filter((attribute) => attribute.entidad_id === entity.id),
      })),
      relationships: relationships.rows,
    };
  }

  const missing = [];
  if (sections.rows.length === 0) missing.push('definición inicial');
  if (!dataModel) missing.push('modelo de datos');
  else if (dataModel.estado !== 'approved') missing.push('modelo de datos aprobado');
  if (endpoints.rows.length === 0) missing.push('especificación de endpoints');
  if (screens.rows.length === 0) missing.push('mapa de pantallas');

  return {
    missing,
    context: {
      definition: {
        sections: sections.rows,
        features: features.rows,
        journey: journey.rows.map((row) => row.descripcion),
      },
      dataModel,
      endpoints: endpoints.rows,
      screens: screens.rows,
      roles: roles.rows.map((row) => row.rol),
    },
  };
}

// GET /api/projects/:id/architecture - Recomendación persistida + catálogo
router.get('/:id/architecture', authenticateToken, async (req, res) => {
  try {
    if (!await membership(pool, req.user.id, req.params.id)) {
      return res.status(403).json({ message: 'No perteneces a este proyecto.' });
    }
    return res.json({
      architecture: await loadArchitecture(pool, req.params.id),
      scenarios: listScenarios(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo obtener la arquitectura.' });
  }
});

// POST /api/projects/:id/architecture/recommend - Recomienda la arquitectura con IA
router.post('/:id/architecture/recommend', authenticateToken, async (req, res) => {
  if (!await authorize(req, res)) return;

  try {
    const { missing, context } = await loadContext(pool, req.params.id);
    if (missing.length > 0) {
      return res.status(409).json({
        message: `Completa las etapas previas antes de recomendar una arquitectura: ${missing.join(', ')}.`,
        missing,
      });
    }

    const recommendation = await recommendArchitecture(context);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM arquitecturas WHERE proyecto_id = $1;', [req.params.id]);
      await client.query(
        `INSERT INTO arquitecturas (proyecto_id, escenario, justificacion, tecnologias, operacion, alternativas, generado_por)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7);`,
        [
          req.params.id,
          recommendation.scenario,
          recommendation.rationale,
          JSON.stringify(recommendation.technologies),
          JSON.stringify(recommendation.operational),
          JSON.stringify(recommendation.alternatives),
          req.user.id,
        ]
      );
      await recordActivity(client, {
        projectId: req.params.id,
        userId: req.user.id,
        action: 'architecture_recommended',
        details: { scenario: recommendation.scenario },
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return res.status(201).json({ architecture: await loadArchitecture(pool, req.params.id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message || 'No se pudo recomendar la arquitectura.' });
  }
});

// POST /api/projects/:id/architecture/approve - Aprueba y bloquea la recomendación
router.post('/:id/architecture/approve', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res, { ownerOnly: true })) return;
    const result = await pool.query(
      `UPDATE arquitecturas
       SET estado = 'approved', aprobado_por = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE proyecto_id = $2 AND estado = 'draft'
       RETURNING *;`,
      [req.user.id, req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(409).json({ message: 'No hay una recomendación en borrador para aprobar.' });
    }
    await recordActivity(pool, {
      projectId: req.params.id,
      userId: req.user.id,
      action: 'architecture_approved',
    });
    return res.json({ architecture: await loadArchitecture(pool, req.params.id) });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo aprobar la arquitectura.' });
  }
});

module.exports = router;
