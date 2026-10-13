const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado. Token no proporcionado.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    return res.status(401).json({ message: 'No autorizado. Token no proporcionado.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (error, decoded) => {
    if (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'La sesión ha expirado. Inicia sesión nuevamente.' });
      }
      return res.status(401).json({ message: 'Token inválido.' });
    }

    req.user = decoded;
    return next();
  });
}

function verifyProjectRole(allowedRoles = []) {
  return async (req, res, next) => {
    const userId = req.user.id;
    const projectId = req.params.id;

    try {
      const memberCheck = await pool.query(
        `SELECT rol FROM proyecto_usuario WHERE usuario_id = $1 AND proyecto_id = $2;`,
        [userId, projectId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Acceso denegado. No perteneces a este proyecto.' });
      }

      const role = memberCheck.rows[0].rol;

      if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        return res.status(403).json({ message: 'Acceso denegado. Solo el dueño del proyecto puede realizar esta acción.' });
      }

      req.projectRole = role;
      return next();
    } catch (error) {
      console.error('Error al verificar el rol en el proyecto:', error);
      return res.status(500).json({ message: 'Error interno del servidor.' });
    }
  };
}

authenticateToken.verifyProjectRole = verifyProjectRole;
module.exports = authenticateToken;