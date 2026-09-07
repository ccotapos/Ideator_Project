const jwt = require('jsonwebtoken');

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

module.exports = authenticateToken;
