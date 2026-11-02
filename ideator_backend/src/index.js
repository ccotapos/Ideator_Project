const express = require('express');
const cors = require('cors');
const { loadSecrets } = require('./config/keyVault');

async function startServer() {
  // 1. Cargar secretos ANTES de importar db.js y las rutas, que leen
  //    process.env al cargarse (el Pool de Postgres se crea en config/db.js).
  const secrets = await loadSecrets();
  if (secrets.enabled) {
    console.log(`Key Vault habilitado: ${secrets.loaded.length} secretos cargados.`);
  }

  const { getJwtSecret } = require('./config/jwt');
  getJwtSecret();

  // 2. Módulos que dependen de los secretos.
  const pool = require('./config/db');
  const authRoutes = require('./routes/auth');
  const projectRoutes = require('./routes/projects');
  const ssoRoutes = require('./routes/sso');
  const chatRoutes = require('./routes/chat');
  const definitionRoutes = require('./routes/definition');
  const dataModelRoutes = require('./routes/dataModels');
  const endpointSpecRoutes = require('./routes/endpointSpec');
  const screenMapRoutes = require('./routes/screenMaps');
  const architectureRoutes = require('./routes/architectures');
  const finalDocumentRoutes = require('./routes/finalDocuments');
  const questionRoutes = require('./routes/questions');
  const { runMigrations } = require('./db/migrate');

  const app = express();

  // Lista de orígenes permitidos en desarrollo local y entorno
  const allowedOrigins = [
    process.env.FRONTEND_ORIGIN,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ].filter(Boolean);

  // Configuración de CORS dinámica
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Bloqueado por política CORS'));
        }
      },
    })
  );

  app.use(express.json());

  // Declaración estandarizada de rutas bajo el prefijo /api
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/auth/sso', ssoRoutes);
  app.use('/api/projects', chatRoutes);
  app.use('/api/projects', definitionRoutes);
  app.use('/api/projects', dataModelRoutes);
  app.use('/api/projects', endpointSpecRoutes);
  app.use('/api/projects', screenMapRoutes);
  app.use('/api/projects', architectureRoutes);
  app.use('/api/projects', finalDocumentRoutes);
  app.use('/api/projects', questionRoutes);

  // Endpoint para comprobación de estado e integridad de la BD
  app.get('/health', async (req, res) => {
    try {
      const result = await pool.query('SELECT NOW()');
      res.json({ status: 'ok', db_time: result.rows[0].now });
    } catch (error) {
      console.error('Error al conectar a la BD:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // Aplica las migraciones pendientes antes de aceptar peticiones. Reintenta por
  // si Postgres todavía no está listo al levantar los contenedores.
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await runMigrations();
      break;
    } catch (error) {
      console.error(`Intento ${attempt}/${maxAttempts} de aplicar migraciones falló: ${error.message}`);
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Backend escuchando en el puerto ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('No se pudo iniciar el backend:', error.message);
  process.exit(1);
});
