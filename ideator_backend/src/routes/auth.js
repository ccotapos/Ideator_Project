const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }

    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ message: 'El correo electrónico ya está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUserQuery = `
      INSERT INTO users (name, email, password) 
      VALUES ($1, $2, $3) 
      RETURNING id, name, email, created_at;
    `;
    const result = await pool.query(newUserQuery, [name, email.toLowerCase(), hashedPassword]);

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error en registro:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son obligatorios.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/auth/me - Devuelve los datos reales del usuario autenticado
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1;',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    return res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener el perfil:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// PUT /api/auth/me - Editar nombre y/o correo del usuario autenticado
router.put('/me', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { name, email } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'El nombre es obligatorio.' });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'El correo electrónico es obligatorio.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Evita que el nuevo correo choque con el de otra cuenta
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2;',
      [normalizedEmail, userId]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ message: 'Ese correo electrónico ya está en uso por otra cuenta.' });
    }

    const updateResult = await pool.query(
      `UPDATE users SET name = $1, email = $2
       WHERE id = $3
       RETURNING id, name, email, created_at;`,
      [name.trim(), normalizedEmail, userId]
    );

    return res.status(200).json({ user: updateResult.rows[0] });
  } catch (error) {
    console.error('Error al actualizar el perfil:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

module.exports = router;