const fs = require('fs');
const os = require('os');
const path = require('path');
const { runMigrations } = require('./migrate');

describe('Runner de migraciones', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ideator-migrations-'));
    fs.writeFileSync(path.join(dir, '001_primera.sql'), 'CREATE TABLE uno (id INT);');
    fs.writeFileSync(path.join(dir, '002_segunda.sql'), 'CREATE TABLE dos (id INT);');
    fs.writeFileSync(path.join(dir, '003_tercera.sql'), 'CREATE TABLE tres (id INT);');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function makePool(appliedFilenames = []) {
    const executed = [];
    const client = {
      query: jest.fn(async (text, params) => {
        executed.push({ text, params });
        if (text.includes('SELECT filename FROM schema_migrations')) {
          return { rows: appliedFilenames.map((filename) => ({ filename })) };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    return { pool: { connect: jest.fn().mockResolvedValue(client) }, client, executed };
  }

  test('crea la tabla de control y aplica las migraciones pendientes en orden', async () => {
    const { pool, client, executed } = makePool([]);
    const applied = await runMigrations({ pool, dir, logger: { log: () => {} } });

    expect(applied).toEqual(['001_primera.sql', '002_segunda.sql', '003_tercera.sql']);
    expect(executed[0].text).toMatch(/CREATE TABLE IF NOT EXISTS schema_migrations/);
    expect(
      executed.some(
        (query) => query.text.includes('INSERT INTO schema_migrations') && query.params[0] === '003_tercera.sql'
      )
    ).toBe(true);
    expect(client.release).toHaveBeenCalled();
  });

  test('omite las migraciones ya aplicadas', async () => {
    const { pool, executed } = makePool(['001_primera.sql', '002_segunda.sql']);
    const applied = await runMigrations({ pool, dir, logger: { log: () => {} } });

    expect(applied).toEqual(['003_tercera.sql']);

    const statements = executed.map((query) => query.text);
    expect(statements.some((text) => text.includes('CREATE TABLE tres'))).toBe(true);
    expect(statements.some((text) => text.includes('CREATE TABLE uno'))).toBe(false);
    expect(statements.some((text) => text.includes('CREATE TABLE dos'))).toBe(false);
  });
});
