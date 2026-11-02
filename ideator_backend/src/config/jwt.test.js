describe('Configuración JWT', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  test('exige JWT_SECRET fuera del entorno de pruebas', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' };
    delete process.env.JWT_SECRET;
    const { getJwtSecret } = require('./jwt');

    expect(() => getJwtSecret()).toThrow('JWT_SECRET es obligatorio');
  });

  test('usa el secreto configurado', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production', JWT_SECRET: 'seguro' };
    const { getJwtSecret } = require('./jwt');

    expect(getJwtSecret()).toBe('seguro');
  });
});
