const express = require('express');
const jwt = require('jsonwebtoken');
const { generators } = require('openid-client');
const pool = require('../config/db');
const { getSsoClient } = require('../config/sso');

const router = express.Router();

// Guarda temporalmente el state/nonce de cada intento de login SSO.
// Para múltiples instancias en producción, reemplazar por Redis o una
// cookie firmada; para el flujo funcional actual esto es suficiente.
const pendingLogins = new Map();

// GET /api/auth/sso/login - Inicia el flujo redirigiendo al proveedor externo
router.get('/login', async (req, res) => {
  try {
    const client = await getSsoClient();
    const state = generators.state();
    const nonce = generators.nonce();

    pendingLogins.set(state, { nonce, createdAt: Date.now() });

    const authUrl = client.authorizationUrl({
      scope: 'openid email profile',
      state,
      nonce,
    });

    return res.redirect(authUrl);
  } catch (error) {
    console.error('Error iniciando el flujo SSO:', error);
    return res.status(500).json({ message: 'No se pudo iniciar el inicio de sesión con SSO.' });
  }
});

// GET /api/auth/sso/callback - Recibe el "code" del proveedor, valida la
// identidad y emite el token propio de la app.
router.get('/callback', async (req, res) => {
  const { state } = req.query;
  const pending = pendingLogins.get(state);

  if (!pending) {
    return res.status(400).json({ message: 'Estado de SSO inválido o expirado.' });
  }

  pendingLogins.delete(state);

  try {
    const client = await getSsoClient();
    const params = client.callbackParams(req);

    const tokenSet = await client.callback(process.env.SSO_REDIRECT_URI, params, {
      state,
      nonce: pending.nonce,
    });

    const profile = tokenSet.claims();

    if (!profile.email) {
      return res.status(400).json({ message: 'El proveedor no entregó un correo electrónico.' });
    }

    const provider = process.env.SSO_PROVIDER_NAME || 'sso';
    const user = await findOrCreateUserFromSso({
      provider,
      providerUserId: profile.sub,
      email: profile.email,
      name: profile.name || profile.email,
    });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '8h' }
    );

    const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
    return res.redirect(`${frontendOrigin}/sso/callback?token=${token}`);
  } catch (error) {
    console.error('Error en el callback de SSO:', error);
    return res.status(500).json({ message: 'No se pudo completar el inicio de sesión con SSO.' });
  }
});

// Busca un usuario ya vinculado al proveedor; si no existe, lo vincula por
// correo a un usuario existente o crea uno nuevo.
async function findOrCreateUserFromSso({ provider, providerUserId, email, name }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const identityResult = await client.query(
      `SELECT usuario_id FROM identidades_externas
       WHERE proveedor = $1 AND proveedor_usuario_id = $2;`,
      [provider, providerUserId]
    );

    let userId;

    if (identityResult.rows.length > 0) {
      userId = identityResult.rows[0].usuario_id;
    } else {
      const existingUserResult = await client.query(
        'SELECT id FROM users WHERE email = $1;',
        [email.toLowerCase()]
      );

      if (existingUserResult.rows.length > 0) {
        userId = existingUserResult.rows[0].id;
      } else {
        const newUserResult = await client.query(
          `INSERT INTO users (name, email, password)
           VALUES ($1, $2, NULL)
           RETURNING id;`,
          [name, email.toLowerCase()]
        );
        userId = newUserResult.rows[0].id;
      }

      await client.query(
        `INSERT INTO identidades_externas (usuario_id, proveedor, proveedor_usuario_id)
         VALUES ($1, $2, $3);`,
        [userId, provider, providerUserId]
      );
    }

    const userResult = await client.query('SELECT id, name, email FROM users WHERE id = $1;', [userId]);

    await client.query('COMMIT');
    return userResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = router;