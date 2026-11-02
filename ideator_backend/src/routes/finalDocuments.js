const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { recordActivity } = require('../services/activity');
const { getScenario } = require('../config/architectureScenarios');
const { validateSpecConsistency } = require('../services/consistencyValidator');
const { detectContradictions } = require('../services/contradictionDetector');
const { generateSpecification, generateArchitecture } = require('../services/documentGenerator');

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

function mapDocument(row) {
  if (!row) return null;
  return { tipo: row.tipo, contenido: row.contenido_md, updatedAt: row.updated_at };
}

async function loadDocuments(queryable, projectId) {
  const result = await queryable.query(
    'SELECT tipo, contenido_md, updated_at FROM documentos_finales WHERE proyecto_id = $1;',
    [projectId]
  );
  const documents = { especificacion: null, arquitectura: null };
  result.rows.forEach((row) => {
    documents[row.tipo] = mapDocument(row);
  });
  return documents;
}

async function loadContext(queryable, projectId) {
  const [sections, features, journey, modelRow, specRow, mapRow, archRow, decisions, roles] = await Promise.all([
    queryable.query('SELECT seccion, respuesta FROM definicion_secciones WHERE proyecto_id = $1;', [projectId]),
    queryable.query("SELECT alcance, descripcion FROM mvp_funcionalidades WHERE proyecto_id = $1 ORDER BY alcance, posicion;", [projectId]),
    queryable.query('SELECT descripcion FROM recorrido_principal WHERE proyecto_id = $1 ORDER BY posicion;', [projectId]),
    queryable.query('SELECT * FROM modelos_datos WHERE proyecto_id = $1;', [projectId]),
    queryable.query('SELECT * FROM especificaciones_endpoints WHERE proyecto_id = $1;', [projectId]),
    queryable.query('SELECT * FROM mapas_pantallas WHERE proyecto_id = $1;', [projectId]),
    queryable.query('SELECT * FROM arquitecturas WHERE proyecto_id = $1;', [projectId]),
    queryable.query('SELECT d.titulo, d.contenido FROM decisiones d JOIN sesiones s ON s.id = d.sesion_id WHERE s.proyecto_id = $1 ORDER BY d.created_at;', [projectId]),
    queryable.query('SELECT DISTINCT rol FROM proyecto_usuario WHERE proyecto_id = $1;', [projectId]),
  ]);

  let dataModel = null;
  if (modelRow.rows[0]) {
    const row = modelRow.rows[0];
    const [entities, attributes, relationships] = await Promise.all([
      queryable.query('SELECT id, nombre FROM modelo_entidades WHERE modelo_id = $1 ORDER BY posicion, id;', [row.id]),
      queryable.query('SELECT a.* FROM modelo_atributos a JOIN modelo_entidades e ON e.id = a.entidad_id WHERE e.modelo_id = $1 ORDER BY a.id;', [row.id]),
      queryable.query('SELECT r.*, eo.nombre AS entidad_origen, ed.nombre AS entidad_destino FROM modelo_relaciones r JOIN modelo_entidades eo ON eo.id = r.entidad_origen_id JOIN modelo_entidades ed ON ed.id = r.entidad_destino_id WHERE r.modelo_id = $1 ORDER BY r.id;', [row.id]),
    ]);
    dataModel = {
      id: row.id,
      estado: row.estado,
      approvedAt: row.approved_at,
      entities: entities.rows.map((entity) => ({
        ...entity,
        attributes: attributes.rows.filter((attribute) => attribute.entidad_id === entity.id),
      })),
      relationships: relationships.rows,
    };
  }

  let endpointSpec = null;
  if (specRow.rows[0]) {
    const row = specRow.rows[0];
    const result = await queryable.query(
      'SELECT metodo, ruta, operacion, entidad, atributos FROM endpoints WHERE especificacion_id = $1 ORDER BY posicion, id;',
      [row.id]
    );
    endpointSpec = { id: row.id, estado: row.estado, modeloId: row.modelo_id, updatedAt: row.updated_at, endpoints: result.rows };
  }

  let screenMap = null;
  if (mapRow.rows[0]) {
    const row = mapRow.rows[0];
    const result = await queryable.query(
      'SELECT clave, nombre, roles, controles FROM pantallas WHERE mapa_id = $1 ORDER BY posicion, id;',
      [row.id]
    );
    screenMap = { id: row.id, updatedAt: row.updated_at, screens: result.rows };
  }

  let architecture = null;
  if (archRow.rows[0]) {
    const row = archRow.rows[0];
    architecture = {
      id: row.id,
      estado: row.estado,
      createdAt: row.created_at,
      scenario: row.escenario,
      scenarioName: getScenario(row.escenario)?.name || row.escenario,
      technologies: row.tecnologias,
      operational: row.operacion,
    };
  }

  const consistency = endpointSpec && dataModel
    ? validateSpecConsistency({ endpoints: endpointSpec.endpoints }, dataModel)
    : { consistent: true, issues: [] };

  return {
    definition: {
      sections: sections.rows,
      features: features.rows,
      journey: journey.rows.map((row) => row.descripcion),
    },
    dataModel,
    endpointSpec,
    screenMap,
    architecture,
    decisions: decisions.rows,
    roles: roles.rows.map((row) => row.rol),
    consistency,
  };
}

// GET /api/projects/:id/contradictions - Reporte de contradicciones entre etapas
router.get('/:id/contradictions', authenticateToken, async (req, res) => {
  try {
    if (!await membership(pool, req.user.id, req.params.id)) {
      return res.status(403).json({ message: 'No perteneces a este proyecto.' });
    }
    const context = await loadContext(pool, req.params.id);
    return res.json(detectContradictions(context));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron detectar contradicciones.' });
  }
});

// GET /api/projects/:id/final-documents - Documentos finales guardados
router.get('/:id/final-documents', authenticateToken, async (req, res) => {
  try {
    if (!await membership(pool, req.user.id, req.params.id)) {
      return res.status(403).json({ message: 'No perteneces a este proyecto.' });
    }
    return res.json({ documents: await loadDocuments(pool, req.params.id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'No se pudieron obtener los documentos.' });
  }
});

// POST /api/projects/:id/final-documents/generate - Genera los documentos Markdown
router.post('/:id/final-documents/generate', authenticateToken, async (req, res) => {
  if (!await authorize(req, res)) return;

  try {
    const context = await loadContext(pool, req.params.id);
    const report = detectContradictions(context);
    if (report.hasContradictions) {
      return res.status(409).json({
        message: 'No se puede generar la documentación final mientras existan contradicciones sin resolver.',
        contradictions: report.contradictions,
      });
    }

    const requested = req.body?.tipo;
    const generateSpec = requested !== 'arquitectura';
    const generateArch = requested !== 'especificacion';

    const specContext = {
      definition: context.definition,
      dataModel: context.dataModel,
      endpoints: context.endpointSpec?.endpoints || [],
      screens: context.screenMap?.screens || [],
      decisions: context.decisions,
      roles: context.roles,
    };
    const archContext = {
      architecture: context.architecture,
      dataModelSummary: context.dataModel
        ? { entities: context.dataModel.entities.map((entity) => entity.nombre) }
        : null,
      endpointsSummary: (context.endpointSpec?.endpoints || []).map((endpoint) => ({
        method: endpoint.metodo,
        route: endpoint.ruta,
        operation: endpoint.operacion,
      })),
      screensSummary: (context.screenMap?.screens || []).map((screen) => ({
        key: screen.clave,
        name: screen.nombre,
        roles: screen.roles,
      })),
      roles: context.roles,
      auth: { strategy: 'JWT + SSO con Google OIDC', roles: ['owner', 'editor', 'viewer'] },
    };

    const generated = {};
    if (generateSpec) generated.especificacion = await generateSpecification(specContext);
    if (generateArch) generated.arquitectura = await generateArchitecture(archContext);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [tipo, contenido] of Object.entries(generated)) {
        await client.query(
          `INSERT INTO documentos_finales (proyecto_id, tipo, contenido_md, generado_por)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (proyecto_id, tipo)
           DO UPDATE SET contenido_md = EXCLUDED.contenido_md,
                         generado_por = EXCLUDED.generado_por,
                         updated_at = CURRENT_TIMESTAMP;`,
          [req.params.id, tipo, contenido, req.user.id]
        );
      }
      await recordActivity(client, {
        projectId: req.params.id,
        userId: req.user.id,
        action: 'final_documents_generated',
        details: { tipos: Object.keys(generated) },
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return res.status(201).json({ documents: await loadDocuments(pool, req.params.id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message || 'No se pudieron generar los documentos.' });
  }
});

module.exports = router;
