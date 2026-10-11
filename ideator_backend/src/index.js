const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const ssoRoutes = require('./routes/sso');
const chatRoutes = require('./routes/chat');
const definitionRoutes = require('./routes/definition');
const dataModelRoutes = require('./routes/dataModels');
const endpointSpecRoutes = require('./routes/endpointSpec');
const { runMigrations } = require('./db/migrate');

const app = express();

// Lista de orígenes permitidos en desarrollo local y entorno
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://localhost:5174',
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
app.use('/api/projects', projectRoutes);
app.use('/api/projects', chatRoutes);
app.use('/api/projects', definitionRoutes);
app.use('/api/projects', dataModelRoutes);
app.use('/api/projects', endpointSpecRoutes);

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

const PORT = process.env.PORT || 3000;

// Aplica las migraciones pendientes antes de aceptar peticiones. Reintenta por
// si Postgres todavía no está listo al levantar los contenedores.
async function startServer() {
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

  app.listen(PORT, () => {
    console.log(`Backend escuchando en el puerto ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('No se pudieron aplicar las migraciones al iniciar:', error.message);
  process.exit(1);
});
