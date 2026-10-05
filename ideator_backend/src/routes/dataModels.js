const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { recordActivity } = require('../services/activity');
const { generateDataModel } = require('../services/dataModelGenerator');

const router = express.Router();

async function membership(queryable, userId, projectId) {
  const result = await queryable.query('SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;', [userId, projectId]);
  return result.rows[0]?.rol;
}

async function loadModel(queryable, projectId) {
  const modelResult = await queryable.query('SELECT * FROM modelos_datos WHERE proyecto_id = $1;', [projectId]);
  const model = modelResult.rows[0];
  if (!model) return null;
  const [entitiesResult, attributesResult, relationsResult] = await Promise.all([
    queryable.query('SELECT * FROM modelo_entidades WHERE modelo_id = $1 ORDER BY posicion, id;', [model.id]),
    queryable.query(`SELECT a.* FROM modelo_atributos a JOIN modelo_entidades e ON e.id = a.entidad_id WHERE e.modelo_id = $1 ORDER BY a.id;`, [model.id]),
    queryable.query(`SELECT r.*, eo.nombre AS entidad_origen, ed.nombre AS entidad_destino FROM modelo_relaciones r JOIN modelo_entidades eo ON eo.id = r.entidad_origen_id JOIN modelo_entidades ed ON ed.id = r.entidad_destino_id WHERE r.modelo_id = $1 ORDER BY r.id;`, [model.id]),
  ]);
  model.entities = entitiesResult.rows.map((entity) => ({ ...entity, attributes: attributesResult.rows.filter((attribute) => attribute.entidad_id === entity.id) }));
  model.relationships = relationsResult.rows;
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

async function requireDraft(projectId, res) {
  const result = await pool.query('SELECT id, estado FROM modelos_datos WHERE proyecto_id = $1;', [projectId]);
  if (!result.rows[0]) { res.status(404).json({ message: 'Primero genera un modelo de datos.' }); return null; }
  if (result.rows[0].estado === 'approved') { res.status(409).json({ message: 'El modelo aprobado está bloqueado para edición.' }); return null; }
  return result.rows[0];
}

router.get('/:id/data-model', authenticateToken, async (req, res) => {
  try {
    if (!await membership(pool, req.user.id, req.params.id)) return res.status(403).json({ message: 'No perteneces a este proyecto.' });
    return res.json({ model: await loadModel(pool, req.params.id) });
  } catch (error) { console.error(error); return res.status(500).json({ message: 'No se pudo obtener el modelo.' }); }
});

router.post('/:id/data-model/generate', authenticateToken, async (req, res) => {
  if (!await authorize(req, res)) return;
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT estado FROM modelos_datos WHERE proyecto_id = $1;', [req.params.id]);
    if (existing.rows[0]?.estado === 'approved') return res.status(409).json({ message: 'El modelo aprobado está bloqueado.' });
    const [sections, features, journey] = await Promise.all([
      client.query('SELECT seccion, respuesta FROM definicion_secciones WHERE proyecto_id = $1;', [req.params.id]),
      client.query("SELECT descripcion FROM mvp_funcionalidades WHERE proyecto_id = $1 AND alcance = 'in' ORDER BY posicion;", [req.params.id]),
      client.query('SELECT descripcion FROM recorrido_principal WHERE proyecto_id = $1 ORDER BY posicion;', [req.params.id]),
    ]);
    const generated = await generateDataModel({ sections: sections.rows, features: features.rows, journey: journey.rows });
    await client.query('BEGIN');
    await client.query('DELETE FROM modelos_datos WHERE proyecto_id = $1;', [req.params.id]);
    const modelResult = await client.query(`INSERT INTO modelos_datos (proyecto_id, generado_por) VALUES ($1, $2) RETURNING *;`, [req.params.id, req.user.id]);
    const modelId = modelResult.rows[0].id;
    const entityIds = new Map();
    for (const [position, entity] of generated.entities.entries()) {
      const entityResult = await client.query(`INSERT INTO modelo_entidades (modelo_id, nombre, descripcion, posicion) VALUES ($1, $2, $3, $4) RETURNING id;`, [modelId, entity.name, entity.description || null, position]);
      entityIds.set(entity.name, entityResult.rows[0].id);
      for (const attribute of entity.attributes) await client.query(`INSERT INTO modelo_atributos (entidad_id, nombre, tipo_dato, nullable, es_pk) VALUES ($1, $2, $3, $4, $5);`, [entityResult.rows[0].id, attribute.name, attribute.type, attribute.nullable, attribute.primaryKey]);
    }
    for (const relation of generated.relationships) await client.query(`INSERT INTO modelo_relaciones (modelo_id, entidad_origen_id, entidad_destino_id, nombre, cardinalidad_origen, cardinalidad_destino) VALUES ($1, $2, $3, $4, $5, $6);`, [modelId, entityIds.get(relation.fromEntity), entityIds.get(relation.toEntity), relation.name, relation.fromCardinality, relation.toCardinality]);
    await recordActivity(client, { projectId: req.params.id, userId: req.user.id, action: 'data_model_generated' });
    await client.query('COMMIT');
    return res.status(201).json({ model: await loadModel(pool, req.params.id) });
  } catch (error) { await client.query('ROLLBACK'); console.error(error); return res.status(500).json({ message: error.message || 'No se pudo generar el modelo.' }); }
  finally { client.release(); }
});

router.post('/:id/data-model/entities', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    const model = await requireDraft(req.params.id, res); if (!model) return;
    if (!req.body.name?.trim()) return res.status(400).json({ message: 'El nombre es obligatorio.' });
    const result = await pool.query(`INSERT INTO modelo_entidades (modelo_id, nombre, descripcion, posicion) VALUES ($1, $2, $3, (SELECT COUNT(*) FROM modelo_entidades WHERE modelo_id = $1)) RETURNING *;`, [model.id, req.body.name.trim(), req.body.description?.trim() || null]);
    return res.status(201).json({ entity: { ...result.rows[0], attributes: [] } });
  } catch (error) { return res.status(500).json({ message: 'No se pudo crear la entidad.' }); }
});

router.put('/:id/data-model/entities/:entityId', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    const model = await requireDraft(req.params.id, res); if (!model) return;
    const result = await pool.query(`UPDATE modelo_entidades SET nombre = COALESCE($1, nombre), descripcion = COALESCE($2, descripcion) WHERE id = $3 AND modelo_id = $4 RETURNING *;`, [req.body.name?.trim() || null, req.body.description?.trim() || null, req.params.entityId, model.id]);
    return result.rows[0] ? res.json({ entity: result.rows[0] }) : res.status(404).json({ message: 'Entidad no encontrada.' });
  } catch (error) { return res.status(500).json({ message: 'No se pudo editar la entidad.' }); }
});

router.delete('/:id/data-model/entities/:entityId', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    const model = await requireDraft(req.params.id, res); if (!model) return;
    const result = await pool.query('DELETE FROM modelo_entidades WHERE id = $1 AND modelo_id = $2 RETURNING id;', [req.params.entityId, model.id]);
    return result.rows[0] ? res.status(204).end() : res.status(404).json({ message: 'Entidad no encontrada.' });
  } catch (error) { return res.status(500).json({ message: 'No se pudo eliminar la entidad.' }); }
});

router.post('/:id/data-model/entities/:entityId/attributes', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    const model = await requireDraft(req.params.id, res); if (!model) return;
    const { name, type, nullable = true, primaryKey = false } = req.body;
    if (!name?.trim() || !type?.trim()) return res.status(400).json({ message: 'Nombre y tipo son obligatorios.' });
    const result = await pool.query(`INSERT INTO modelo_atributos (entidad_id, nombre, tipo_dato, nullable, es_pk) SELECT e.id, $1, $2, $3, $4 FROM modelo_entidades e WHERE e.id = $5 AND e.modelo_id = $6 RETURNING *;`, [name.trim(), type.trim(), nullable, primaryKey, req.params.entityId, model.id]);
    return result.rows[0] ? res.status(201).json({ attribute: result.rows[0] }) : res.status(404).json({ message: 'Entidad no encontrada.' });
  } catch (error) { return res.status(500).json({ message: 'No se pudo crear el atributo.' }); }
});

router.put('/:id/data-model/attributes/:attributeId', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    const model = await requireDraft(req.params.id, res); if (!model) return;
    const result = await pool.query(`UPDATE modelo_atributos a SET nombre = COALESCE($1, a.nombre), tipo_dato = COALESCE($2, a.tipo_dato), nullable = COALESCE($3, a.nullable), es_pk = COALESCE($4, a.es_pk) FROM modelo_entidades e WHERE a.id = $5 AND a.entidad_id = e.id AND e.modelo_id = $6 RETURNING a.*;`, [req.body.name || null, req.body.type || null, req.body.nullable, req.body.primaryKey, req.params.attributeId, model.id]);
    return result.rows[0] ? res.json({ attribute: result.rows[0] }) : res.status(404).json({ message: 'Atributo no encontrado.' });
  } catch (error) { return res.status(500).json({ message: 'No se pudo editar el atributo.' }); }
});

router.delete('/:id/data-model/attributes/:attributeId', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    const model = await requireDraft(req.params.id, res); if (!model) return;
    const result = await pool.query(`DELETE FROM modelo_atributos a USING modelo_entidades e WHERE a.id = $1 AND a.entidad_id = e.id AND e.modelo_id = $2 RETURNING a.id;`, [req.params.attributeId, model.id]);
    return result.rows[0] ? res.status(204).end() : res.status(404).json({ message: 'Atributo no encontrado.' });
  } catch (error) { return res.status(500).json({ message: 'No se pudo eliminar el atributo.' }); }
});

router.post('/:id/data-model/relationships', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    const model = await requireDraft(req.params.id, res); if (!model) return;
    const { fromEntityId, toEntityId, name, fromCardinality = '1', toCardinality = 'N' } = req.body;
    const result = await pool.query(`INSERT INTO modelo_relaciones (modelo_id, entidad_origen_id, entidad_destino_id, nombre, cardinalidad_origen, cardinalidad_destino) SELECT $1, eo.id, ed.id, $2, $3, $4 FROM modelo_entidades eo JOIN modelo_entidades ed ON ed.modelo_id = eo.modelo_id WHERE eo.id = $5 AND ed.id = $6 AND eo.modelo_id = $1 RETURNING *;`, [model.id, name || 'relacion', fromCardinality, toCardinality, fromEntityId, toEntityId]);
    return result.rows[0] ? res.status(201).json({ relationship: result.rows[0] }) : res.status(400).json({ message: 'Entidades inválidas.' });
  } catch (error) { return res.status(500).json({ message: 'No se pudo crear la relación.' }); }
});

router.put('/:id/data-model/relationships/:relationshipId', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    const model = await requireDraft(req.params.id, res); if (!model) return;
    const result = await pool.query(`UPDATE modelo_relaciones SET nombre = COALESCE($1, nombre), cardinalidad_origen = COALESCE($2, cardinalidad_origen), cardinalidad_destino = COALESCE($3, cardinalidad_destino) WHERE id = $4 AND modelo_id = $5 RETURNING *;`, [req.body.name || null, req.body.fromCardinality || null, req.body.toCardinality || null, req.params.relationshipId, model.id]);
    return result.rows[0] ? res.json({ relationship: result.rows[0] }) : res.status(404).json({ message: 'Relación no encontrada.' });
  } catch (error) { return res.status(500).json({ message: 'No se pudo editar la relación.' }); }
});

router.delete('/:id/data-model/relationships/:relationshipId', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    const model = await requireDraft(req.params.id, res); if (!model) return;
    const result = await pool.query('DELETE FROM modelo_relaciones WHERE id = $1 AND modelo_id = $2 RETURNING id;', [req.params.relationshipId, model.id]);
    return result.rows[0] ? res.status(204).end() : res.status(404).json({ message: 'Relación no encontrada.' });
  } catch (error) { return res.status(500).json({ message: 'No se pudo eliminar la relación.' }); }
});

router.post('/:id/data-model/approve', authenticateToken, async (req, res) => {
  try {
    if (!await authorize(req, res, { ownerOnly: true })) return;
    const result = await pool.query(`UPDATE modelos_datos SET estado = 'approved', aprobado_por = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE proyecto_id = $2 AND estado = 'draft' RETURNING *;`, [req.user.id, req.params.id]);
    if (!result.rows[0]) return res.status(409).json({ message: 'No hay un borrador disponible para aprobar.' });
    await recordActivity(pool, { projectId: req.params.id, userId: req.user.id, action: 'data_model_approved' });
    return res.json({ model: await loadModel(pool, req.params.id) });
  } catch (error) { return res.status(500).json({ message: 'No se pudo aprobar el modelo.' }); }
});

module.exports = router;
