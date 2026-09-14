const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// POST /api/projects - Crear un proyecto nuevo
router.post('/', authenticateToken, async (req, res) => {
  const { nombre, descripcion } = req.body;
  const userId = req.user.id;

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre del proyecto es obligatorio.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const projectResult = await client.query(
      `INSERT INTO proyectos (nombre, descripcion, is_private)
       VALUES ($1, $2, TRUE)
       RETURNING id, nombre, descripcion, is_private, created_at;`,
      [nombre, descripcion || null]
    );

    const project = projectResult.rows[0];

    await client.query(
      `INSERT INTO proyecto_usuario (usuario_id, proyecto_id, rol)
       VALUES ($1, $2, 'owner');`,
      [userId, project.id]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Proyecto creado exitosamente',
      project,
      role: 'owner',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando proyecto:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

// GET /api/projects - Listar los proyectos donde el usuario es owner o colaborador
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT p.id, p.nombre, p.descripcion, p.is_private, p.updated_at, pu.rol
       FROM proyectos p
       JOIN proyecto_usuario pu ON pu.proyecto_id = p.id
       WHERE pu.usuario_id = $1
       ORDER BY p.updated_at DESC;`,
      [userId]
    );

    return res.status(200).json({ projects: result.rows });
  } catch (error) {
    console.error('Error al listar proyectos:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/projects/:id/members - Listar participantes y sus roles
router.get('/:id/members', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;

  try {
    // Validar si el usuario solicitante pertenece al proyecto
    const memberCheck = await pool.query(
      `SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;`,
      [userId, projectId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Acceso denegado. No perteneces a este proyecto.' });
    }

    // Obtener miembros del proyecto
    const membersResult = await pool.query(
      `SELECT u.id, u.name, u.email, pu.rol, pu.created_at
       FROM proyecto_usuario pu
       JOIN users u ON pu.usuario_id = u.id
       WHERE pu.proyecto_id = $1
       ORDER BY pu.created_at ASC;`,
      [projectId]
    );

    return res.status(200).json({ members: membersResult.rows });
  } catch (error) {
    console.error('Error al listar miembros:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/projects/:id - Obtener el detalle de un proyecto
router.get('/:id', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;

  try {
    const memberCheck = await pool.query(
      `SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;`,
      [userId, projectId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Acceso denegado. No perteneces a este proyecto.' });
    }

    const projectResult = await pool.query(
      `SELECT id, nombre, descripcion, is_private, created_at, updated_at
       FROM proyectos WHERE id = $1;`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Proyecto no encontrado.' });
    }

    return res.status(200).json({
      project: projectResult.rows[0],
      role: memberCheck.rows[0].rol,
    });
  } catch (error) {
    console.error('Error al obtener el proyecto:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// PUT /api/projects/:id - Editar nombre/descripción (solo el owner)
router.put('/:id', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;
  const { nombre, descripcion } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ message: 'El nombre del proyecto es obligatorio.' });
  }

  try {
    const memberCheck = await pool.query(
      `SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;`,
      [userId, projectId]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].rol !== 'owner') {
      return res.status(403).json({ message: 'Acceso denegado. Solo el dueño del proyecto puede editarlo.' });
    }

    const updateResult = await pool.query(
      `UPDATE proyectos SET nombre = $1, descripcion = $2
       WHERE id = $3
       RETURNING id, nombre, descripcion, is_private, created_at, updated_at;`,
      [nombre.trim(), descripcion?.trim() || null, projectId]
    );

    return res.status(200).json({ project: updateResult.rows[0] });
  } catch (error) {
    console.error('Error al actualizar el proyecto:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/projects/:id/invite - Invitar a un colaborador por correo
router.post('/:id/invite', authenticateToken, async (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.id;
  const { email, role } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'El correo electrónico del usuario es obligatorio.' });
  }

  const assignedRole = role || 'collaborator';

  try {
    // Validar permisos: solo el 'owner' puede invitar
    const ownerCheck = await pool.query(
      `SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;`,
      [userId, projectId]
    );

    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].rol !== 'owner') {
      return res.status(403).json({ message: 'Acceso denegado. Solo el dueño del proyecto puede realizar invitaciones.' });
    }

    // Buscar el usuario objetivo por correo
    const targetUserResult = await pool.query(
      `SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1);`,
      [email]
    );

    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({ message: 'El usuario con ese correo no existe.' });
    }

    const targetUser = targetUserResult.rows[0];

    // Verificar si ya es miembro del proyecto
    const existingMemberCheck = await pool.query(
      `SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;`,
      [targetUser.id, projectId]
    );

    if (existingMemberCheck.rows.length > 0) {
      return res.status(409).json({ message: 'El usuario ya pertenece a este proyecto.' });
    }

    const projectResult = await client.query(
      `INSERT INTO proyectos (nombre, descripcion, is_private)
       VALUES ($1, $2, TRUE)
       RETURNING id, nombre, descripcion, is_private, created_at, updated_at;`,
      [nombre, descripcion || null]
    );

    // Asignar al proyecto
    await pool.query(
      `INSERT INTO proyecto_usuario (usuario_id, proyecto_id, rol)
       VALUES ($1, $2, $3);`,
      [targetUser.id, projectId, assignedRole]
    );

    return res.status(201).json({
      message: 'Usuario añadido al proyecto exitosamente.',
      member: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: assignedRole,
      },
    });
  } catch (error) {
    console.error('Error al invitar al proyecto:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

module.exports = router;
