const jwt = require('jsonwebtoken');

/**
 * Middleware de autorización.
 *
 * Espera un header `Authorization: Bearer <token>`. Si el token es válido,
 * adjunta el payload decodificado en `req.user` y continúa la cadena.
 * En cualquier otro caso responde 401, sin dejar pasar la request:
 *  - No hay header / no tiene formato Bearer -> "Token no proporcionado."
 *  - Token expirado                          -> "La sesión ha expirado."
 *  - Token corrupto o con firma inválida     -> "Token inválido."
 */
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
      // Cubre JsonWebTokenError (firma/formato inválido) y NotBeforeError.
      return res.status(401).json({ message: 'Token inválido.' });
    }

    req.user = decoded;
    return next();
  });
}

module.exports = authenticateToken;
