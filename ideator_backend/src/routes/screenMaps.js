const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { recordActivity } = require('../services/activity');
const { generateScreenMap, filterScreenMapForRole } = require('../services/screenMapGenerator');

const router = express.Router();

async function membership(queryable, userId, projectId) {
  const result = await queryable.query('SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;', [userId, projectId]);
  return result.rows[0]?.rol;
}

async function loadMap(queryable, projectId) {
  const mapResult = await queryable.query('SELECT * FROM mapas_pantallas WHERE proyecto_id = $1;', [projectId]);
  const map = mapResult.rows[0];
  if (!map) return null;
  const [screensResult, transitionsResult] = await Promise.all([
    queryable.query('SELECT * FROM pantallas WHERE mapa_id = $1 ORDER BY posicion, id;', [map.id]),
    queryable.query(`SELECT t.*, po.clave AS origen_clave, pd.clave AS destino_clave FROM transiciones_pantallas t JOIN pantallas po ON po.id = t.pantalla_origen_id JOIN pantallas pd ON pd.id = t.pantalla_destino_id WHERE t.mapa_id = $1 ORDER BY t.id;`, [map.id]),
  ]);
  return {
    ...map,
    screens: screensResult.rows.map((screen) => ({ ...screen, key: screen.clave, name: screen.nombre, description: screen.descripcion, entry: screen.es_entrada, result: screen.es_resultado, controls: screen.controles })),
    transitions: transitionsResult.rows.map((transition) => ({ ...transition, from: transition.origen_clave, to: transition.destino_clave, action: transition.accion })),
  };
}

router.get('/:id/screen-map', authenticateToken, async (req, res) => {
  try {
    const role = await membership(pool, req.user.id, req.params.id);
    if (!role) return res.status(403).json({ message: 'No perteneces a este proyecto.' });
    const map = await loadMap(pool, req.params.id);
    return res.json({ map: map ? filterScreenMapForRole(map, role) : null, role });
  } catch (error) { console.error(error); return res.status(500).json({ message: 'No se pudo obtener el mapa de pantallas.' }); }
});

router.post('/:id/screen-map/generate', authenticateToken, async (req, res) => {
  const role = await membership(pool, req.user.id, req.params.id);
  if (!['owner', 'editor'].includes(role)) return res.status(403).json({ message: 'No tienes permisos para generar mockups.' });
  const client = await pool.connect();
  try {
    // Lecturas secuenciales sobre el mismo cliente (evita consultas concurrentes).
    const sections = await client.query('SELECT seccion, respuesta FROM definicion_secciones WHERE proyecto_id = $1;', [req.params.id]);
    const features = await client.query("SELECT alcance, descripcion FROM mvp_funcionalidades WHERE proyecto_id = $1 ORDER BY alcance, posicion;", [req.params.id]);
    const journey = await client.query('SELECT descripcion FROM recorrido_principal WHERE proyecto_id = $1 ORDER BY posicion;', [req.params.id]);
    const endpoints = await client.query(`SELECT e.metodo, e.ruta, e.operacion FROM endpoints e JOIN especificaciones_endpoints s ON s.id = e.especificacion_id WHERE s.proyecto_id = $1 ORDER BY e.posicion;`, [req.params.id]);
    const members = await client.query('SELECT DISTINCT rol FROM proyecto_usuario WHERE proyecto_id = $1;', [req.params.id]);
    const generated = await generateScreenMap({ definition: sections.rows, features: features.rows, journey: journey.rows, endpoints: endpoints.rows, projectRoles: members.rows.map((item) => item.rol) });
    await client.query('BEGIN');
    await client.query('DELETE FROM mapas_pantallas WHERE proyecto_id = $1;', [req.params.id]);
    const mapResult = await client.query('INSERT INTO mapas_pantallas (proyecto_id, generado_por) VALUES ($1, $2) RETURNING *;', [req.params.id, req.user.id]);
    const screenIds = new Map();
    for (const screen of generated.screens) {
      const result = await client.query(`INSERT INTO pantallas (mapa_id, clave, nombre, descripcion, es_entrada, es_resultado, roles, controles, posicion) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9) RETURNING id;`, [mapResult.rows[0].id, screen.key, screen.name, screen.description || null, screen.entry, screen.result, JSON.stringify(screen.roles), JSON.stringify(screen.controls), screen.position]);
      screenIds.set(screen.key, result.rows[0].id);
    }
    for (const transition of generated.transitions) {
      await client.query(`INSERT INTO transiciones_pantallas (mapa_id, pantalla_origen_id, pantalla_destino_id, accion, roles) VALUES ($1, $2, $3, $4, $5::jsonb);`, [mapResult.rows[0].id, screenIds.get(transition.from), screenIds.get(transition.to), transition.action, JSON.stringify(transition.roles)]);
    }
    await recordActivity(client, { projectId: req.params.id, userId: req.user.id, action: 'screen_map_generated', details: { screenCount: generated.screens.length } });
    await client.query('COMMIT');
    const map = await loadMap(pool, req.params.id);
    return res.status(201).json({ map: filterScreenMapForRole(map, role), role });
  } catch (error) {
    await client.query('ROLLBACK'); console.error(error);
    return res.status(500).json({ message: error.message || 'No se pudo generar el mapa de pantallas.' });
  } finally { client.release(); }
});

module.exports = router;
