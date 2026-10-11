const fs = require('fs');
const path = require('path');
const defaultPool = require('../config/db');

// Directorio de migraciones SQL: ideator_backend/migrations
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

// Aplica en orden todas las migraciones pendientes y registra cada una en la
// tabla de control schema_migrations. Es idempotente: las ya aplicadas se omiten.
async function runMigrations({ pool = defaultPool, dir = MIGRATIONS_DIR, logger = console } = {}) {
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const appliedResult = await client.query('SELECT filename FROM schema_migrations;');
    const applied = new Set(appliedResult.rows.map((row) => row.filename));

    const appliedNow = [];

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = fs.readFileSync(path.join(dir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1);', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Error al aplicar la migración ${file}: ${error.message}`);
      }

      appliedNow.push(file);
      logger.log(`Migración aplicada: ${file}`);
    }

    return appliedNow;
  } finally {
    client.release();
  }
}

module.exports = { runMigrations, MIGRATIONS_DIR };

// Permite ejecutarlo suelto: `npm run migrate`
if (require.main === module) {
  runMigrations()
    .then((applied) => {
      if (applied.length === 0) {
        console.log('No hay migraciones pendientes.');
      } else {
        console.log(`Migraciones aplicadas: ${applied.join(', ')}`);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
