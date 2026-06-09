const express = require('express');
const router = express.Router();
const { query } = require('../db/db');
const { authenticateToken } = require('../middleware/authMiddleware');

// POST /mechanic/entrada — Registrar ingreso de moto
router.post('/entrada', authenticateToken, async (req, res) => {
  const { plate, brand, model, client_name, uuid, timestamp } = req.body;
  const userId = req.user.id;

  if (!plate) {
    return res.status(400).json({ error: 'La patente es obligatoria.' });
  }

  try {
    const logTimestamp = timestamp ? new Date(timestamp) : new Date();
    const logUuid = uuid || `m-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;

    const result = await query(
      `INSERT INTO mechanic_services (uuid, plate, brand, model, client_name, access_type, timestamp, user_id, synced)
       VALUES ($1, $2, $3, $4, $5, 'ENTRADA', $6, $7, $8)
       RETURNING *`,
      [logUuid, plate.trim().toUpperCase(), brand || null, model || null, client_name || null, logTimestamp, userId, !uuid]
    );

    res.status(201).json({ success: true, log: result.rows[0], message: 'Ingreso de moto registrado.' });
  } catch (err) {
    console.error('[MECHANIC] Error registrando entrada:', err);
    res.status(500).json({ error: 'Error al registrar el ingreso.' });
  }
});

// POST /mechanic/salida — Registrar egreso de moto por patente
router.post('/salida', authenticateToken, async (req, res) => {
  const { plate, uuid, timestamp } = req.body;
  const userId = req.user.id;

  if (!plate) {
    return res.status(400).json({ error: 'La patente es obligatoria.' });
  }

  try {
    const normalizedPlate = plate.trim().toUpperCase();
    const logTimestamp = timestamp ? new Date(timestamp) : new Date();
    const logUuid = uuid || `m-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;

    // Buscar el último registro de entrada para obtener datos de la moto
    const prevRes = await query(
      `SELECT brand, model, client_name FROM mechanic_services 
       WHERE plate = $1 AND access_type = 'ENTRADA' 
       ORDER BY timestamp DESC LIMIT 1`,
      [normalizedPlate]
    );

    const prev = prevRes.rows[0] || {};

    const result = await query(
      `INSERT INTO mechanic_services (uuid, plate, brand, model, client_name, access_type, timestamp, user_id, synced)
       VALUES ($1, $2, $3, $4, $5, 'SALIDA', $6, $7, $8)
       RETURNING *`,
      [logUuid, normalizedPlate, prev.brand || null, prev.model || null, prev.client_name || null, logTimestamp, userId, !uuid]
    );

    res.status(201).json({ success: true, log: result.rows[0], message: 'Egreso de moto registrado.' });
  } catch (err) {
    console.error('[MECHANIC] Error registrando salida:', err);
    res.status(500).json({ error: 'Error al registrar el egreso.' });
  }
});

// GET /mechanic/log — Historial de servicios mecánicos
router.get('/log', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT ms.*, u.username as guard_name 
       FROM mechanic_services ms
       LEFT JOIN users u ON ms.user_id = u.id
       ORDER BY ms.timestamp DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[MECHANIC] Error obteniendo historial:', err);
    res.status(500).json({ error: 'Error al cargar el historial.' });
  }
});

module.exports = router;
