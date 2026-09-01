const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[0] === 'Bearer'
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({ message: 'Token no proporcionado.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido.' });
  }
}

module.exports = authenticateToken;
