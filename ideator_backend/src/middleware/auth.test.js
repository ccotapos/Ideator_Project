process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

const jwt = require('jsonwebtoken');
const authenticateToken = require('./auth');

const SECRET = process.env.JWT_SECRET;
const payload = { id: 1, email: 'user@example.com' };

function buildRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticateToken middleware', () => {
  test('caso válido: deja pasar la request y adjunta req.user', () => {
    const token = jwt.sign(payload, SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = buildRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: payload.id, email: payload.email });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('caso expirado: responde 401 y no llama a next()', () => {
    // expiresIn negativo genera un token ya vencido, sin tener que esperar.
    const token = jwt.sign(payload, SECRET, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = buildRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/expirad/i) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('caso inválido/corrupto: responde 401 y no llama a next()', () => {
    const req = { headers: { authorization: 'Bearer esto.no-es.valido' } };
    const res = buildRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/inválido/i) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('token firmado con otra clave secreta también se rechaza (firma inválida)', () => {
    const token = jwt.sign(payload, 'otra_clave_distinta', { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = buildRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('sin header Authorization: responde 401', () => {
    const req = { headers: {} };
    const res = buildRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/token no proporcionado/i) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('header sin formato Bearer: responde 401', () => {
    const req = { headers: { authorization: 'Token abc123' } };
    const res = buildRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});