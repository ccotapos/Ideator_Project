const express = require('express');
const pool = require('./config/db');
const authRoutes = require('./routes/auth'); // Check esta importación

const app = express();

app.use(express.json()); // Middleware obligatorio para leer el body en JSON

// Asegúrate de que la ruta base esté escrita tal cual:
app.use('/api/auth', authRoutes);

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', db_time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
});