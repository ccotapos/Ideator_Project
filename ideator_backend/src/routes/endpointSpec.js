const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { recordActivity } = require('../services/activity');
const { generateEndpointSpec } = require('../services/endpointSpecGenerator');
const { validateSpecConsistency } = require('../services/consistencyValidator');

const router = express.Router();

async function membership(queryable, userId, projectId) {
  const result = await queryable.query(
    'SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;',
    [userId, projectId]
  );
  return result.rows[0]?.rol;
}

async function loadSpec(queryable, projectId) {
  const specResult = await queryable.query(
    'SELECT * FROM especificaciones_endpoints WHERE proyecto_id = $1;',
    [projectId]
  );
  const spec = specResult.rows[0];
  if (!spec) return null;
  const endpointsResult = await queryable.query(
    'SELECT * FROM endpoints WHERE especificacion_id = $1 ORDER BY posicion, id;',
    [spec.id]
  );
  spec.endpoints = endpointsResult.rows;
  return spec;
}

async function loadApprovedModel(queryable, projectId) {
  const modelResult = await queryable.query('SELECT * FROM modelos_datos WHERE proyecto_id = $1;', [projectId]);
  const model = modelResult.rows[0];
  if (!model) return null;
  const [entitiesResult, attributesResult] = await Promise.all([
    queryable.query('SELECT id, nombre FROM modelo_entidades WHERE modelo_id = $1 ORDER BY posicion, id;', [model.id]),
    queryable.query('SELECT a.* FROM modelo_atributos a JOIN modelo_entidades e ON e.id = a.entidad_id WHERE e.modelo_id = $1 ORDER BY a.id;', [model.id]),
  ]);
  model.entities = entitiesResult.rows.map((entity) => ({
    ...entity,
    attributes: attributesResult.rows.filter((attribute) => attribute.entidad_id === entity.id),
  }));
  return model;
}

async function authorize(req, res, { ownerOnly = false } = {}) {
  const role = await membership(pool, req.user.id, req.params.id);
  if (!role) { res.status(403).json({ message: 'No perteneces a este proyecto.' }); return null; }
  if (ownerOnly ? role !== 'owner' : !['owner', 'editor'].includes(role)) {
    res.status(403).json({ message: 'No tienes permisos suficientes.' }); return null;
  }
  return role;
}

// GET /api/projects/:id/endpoint-spec - Especificación persistida
router.get('/:id/endpoint-spec', authenticateToken, async (req, res) => {
  try {
    if (!await membership(pool, req.user.id, req.params.id)) {
      return res.status(403).json({ message: 'No perteneces a este proyecto.' });
    }
    return res.json({ spec: await loadSpec(pool, req.params.id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo obtener la especificación.' });
  }
});

// GET /api/projects/:id/endpoint-spec/validation - Reporte de consistencia con el modelo
router.get('/:id/endpoint-spec/validation', authenticateToken, async (req, res) => {
  try {
    if (!await membership(pool, req.user.id, req.params.id)) {
      return res.status(403).json({ message: 'No perteneces a este proyecto.' });
    }
    const spec = await loadSpec(pool, req.params.id);
    if (!spec) {
      return res.status(404).json({ message: 'Primero genera la especificación de endpoints.' });
    }
    const model = await loadApprovedModel(pool, req.params.id);
    return res.json({ validation: validateSpecConsistency(spec, model) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudo validar la consistencia.' });
  }
});

// POST /api/projects/:id/endpoint-spec/generate - Genera la especificación con IA
router.post('/:id/endpoint-spec/generate', authenticateToken, async (req, res) => {
  if (!await authorize(req, res)) return;
  const client = await pool.connect();
  try {
    const specState = await client.query(
      'SELECT estado FROM especificaciones_endpoints WHERE proyecto_id = $1;',
      [req.params.id]
    );
    if (specState.rows[0]?.estado === 'approved') {
      return res.status(409).json({ message: 'La especificación aprobada está bloqueada.' });
    }

    // La especificación solo puede generarse desde un modelo de datos aprobado.
    const modelResult = await client.query(
      'SELECT * FROM modelos_datos WHERE proyecto_id = $1;',
      [req.params.id]
    );
    const model = modelResult.rows[0];
    if (!model || model.estado !== 'approved') {
      return res.status(409).json({
        message: 'Aprueba el modelo de datos antes de generar la especificación de endpoints.',
      });
    }

    const [entities, attributes, relationships, sections, features, journey] = await Promise.all([
      client.query('SELECT id, nombre, descripcion FROM modelo_entidades WHERE modelo_id = $1 ORDER BY posicion, id;', [model.id]),
      client.query('SELECT a.* FROM modelo_atributos a JOIN modelo_entidades e ON e.id = a.entidad_id WHERE e.modelo_id = $1 ORDER BY a.id;', [model.id]),
      client.query('SELECT r.*, eo.nombre AS entidad_origen, ed.nombre AS entidad_destino FROM modelo_relaciones r JOIN modelo_entidades eo ON eo.id = r.entidad_origen_id JOIN modelo_entidades ed ON ed.id = r.entidad_destino_id WHERE r.modelo_id = $1 ORDER BY r.id;', [model.id]),
      client.query('SELECT seccion, respuesta FROM definicion_secciones WHERE proyecto_id = $1;', [req.params.id]),
      client.query("SELECT descripcion FROM mvp_funcionalidades WHERE proyecto_id = $1 AND alcance = 'in' ORDER BY posicion;", [req.params.id]),
      client.query('SELECT descripcion FROM recorrido_principal WHERE proyecto_id = $1 ORDER BY posicion;', [req.params.id]),
    ]);

    const approvedModel = {
      entities: entities.rows.map((entity) => ({
        ...entity,
        attributes: attributes.rows.filter((attribute) => attribute.entidad_id === entity.id),
      })),
      relationships: relationships.rows,
    };

    const generated = await generateEndpointSpec({
      model: approvedModel,
      definition: { sections: sections.rows, features: features.rows, journey: journey.rows },
    });

    await client.query('BEGIN');
    await client.query('DELETE FROM especificaciones_endpoints WHERE proyecto_id = $1;', [req.params.id]);
    const specResult = await client.query(
      `INSERT INTO especificaciones_endpoints (proyecto_id, modelo_id, generado_por)
       VALUES ($1, $2, $3) RETURNING *;`,
      [req.params.id, model.id, req.user.id]
    );
    const specId = specResult.rows[0].id;

    for (const [position, endpoint] of generated.endpoints.entries()) {
      await client.query(
        `INSERT INTO endpoints (especificacion_id, metodo, ruta, operacion, entidad, atributos, posicion)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7);`,
        [specId, endpoint.method, endpoint.route, endpoint.operation, endpoint.entity || null, JSON.stringify(endpoint.attributes || []), position]
      );
    }

    await recordActivity(client, {
      projectId: req.params.id,
      userId: req.user.id,
      action: 'endpoint_spec_generated',
      details: { endpointCount: generated.endpoints.length },
    });
    await client.query('COMMIT');

    return res.status(201).json({ spec: await loadSpec(pool, req.params.id) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: error.message || 'No se pudo generar la especificación.' });
  } finally {
    client.release();
  }
});

// POST /api/projects/:id/endpoint-spec/approve - Aprueba y bloquea el borrador
router.post('/:id/endpoint-spec/approve', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res, { ownerOnly: true })) return;

    const spec = await loadSpec(pool, req.params.id);
    if (!spec) {
      return res.status(404).json({ message: 'No hay una especificación para aprobar.' });
    }

    const model = await loadApprovedModel(pool, req.params.id);
    const validation = validateSpecConsistency(spec, model);
    if (!validation.consistent) {
      return res.status(409).json({
        message: 'La especificación tiene inconsistencias con el modelo de datos aprobado.',
        issues: validation.issues,
      });
    }

    const result = await pool.query(
      `UPDATE especificaciones_endpoints
       SET estado = 'approved', aprobado_por = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE proyecto_id = $2 AND estado = 'draft'
       RETURNING *;`,
      [req.user.id, req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(409).json({ message: 'No hay un borrador disponible para aprobar.' });
    }
    await recordActivity(pool, {
      projectId: req.params.id,
      userId: req.user.id,
      action: 'endpoint_spec_approved',
    });
    return res.json({ spec: await loadSpec(pool, req.params.id) });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo aprobar la especificación.' });
  }
});

module.exports = router;
