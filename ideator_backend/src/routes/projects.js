const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

// POST /projects
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
      [nombre, descripcion || null],
    );

    const project = projectResult.rows[0];

    await client.query(
      `INSERT INTO proyecto_usuario (usuario_id, proyecto_id, rol)
       VALUES ($1, $2, 'owner');`,
      [userId, project.id],
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

module.exports = router;
