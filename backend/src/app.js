require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/db');
const initializeDatabase = require('./db/initDb');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares
app.use(cors({
  origin: '*', // Permitimos conexiones desde cualquier origen en este entorno local/móvil
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' })); // Permitir payloads grandes para fotos en Base64
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Inicializar la base de datos (handshake inicial y creación de tablas)
async function startApp() {
  try {
    await db.connect();
    await initializeDatabase();
    console.log('[APP] Base de datos inicializada.');
  } catch (err) {
    console.error('[APP] Error crítico inicializando base de datos:', err);
  }
}

startApp();

// Rutas de la API
const authRouter = require('./routes/auth');
const personsRouter = require('./routes/persons');
const accessRouter = require('./routes/access');
const vehiclesRouter = require('./routes/vehicles');
const vehicleAccessRouter = require('./routes/vehicleAccess');
const syncRouter = require('./routes/sync');
const ocrRouter = require('./routes/ocr');
const rtspRouter = require('./routes/rtsp');

app.use('/api/auth', authRouter);
app.use('/api/persons', personsRouter);
app.use('/api/access', accessRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/vehicle-access', vehicleAccessRouter);
app.use('/api/sync', syncRouter);
app.use('/api/ocr', ocrRouter);
app.use('/api/rtsp', rtspRouter);

// Ruta de estado general (Health Check)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date(),
    uptime: process.uptime(),
    dbType: process.env.DB_TYPE === 'sqlite' || !process.env.DB_HOST ? 'sqlite' : 'postgresql'
  });
});

// Middleware de manejo de errores globales
app.use((err, req, res, next) => {
  console.error('[GLOBAL-ERROR]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Ocurrió un error inesperado en el servidor.'
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`  API Backend Control de Acceso ejecutándose en:`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
