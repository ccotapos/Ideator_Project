function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'test') return 'secret_key';
  throw new Error('JWT_SECRET es obligatorio para iniciar el backend.');
}

module.exports = { getJwtSecret };
