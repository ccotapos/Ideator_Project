const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validar campos requeridos
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: 'Todos los campos (name, email, password) son obligatorios.' 
      });
    }

    // 2. Comprobar si el usuario ya existe
    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ message: 'El correo electrónico ya está registrado.' });
    }

    // 3. Hashear la contraseña (10 salt rounds)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. Insertar el nuevo usuario en la base de datos
    const newUserQuery = `
      INSERT INTO users (name, email, password) 
      VALUES ($1, $2, $3) 
      RETURNING id, name, email, created_at;
    `;
    const values = [name, email.toLowerCase(), hashedPassword];
    
    const result = await pool.query(newUserQuery, values);
    const newUser = result.rows[0];

    // 5. Retornar respuesta exitosa (sin devolver la contraseña)
    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: newUser
    });

  } catch (error) {
    console.error('Error en el registro de usuario:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

module.exports = router;