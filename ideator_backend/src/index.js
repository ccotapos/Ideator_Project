const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const authRoutes = require('./routes/auth');

const app = express();

// Permite que el frontend (Vite, normalmente en localhost:5173) consuma esta API.
// FRONTEND_ORIGIN se puede ajustar en .env si el frontend corre en otro puerto/dominio.
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  })
);

app.use(express.json());

app.use('/api/auth', authRoutes);

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
app.listen(PORT, () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
});