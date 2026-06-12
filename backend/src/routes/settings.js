const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// GET /settings/:key - Obtener valor de configuración por clave
router.get('/:key', authenticateToken, async (req, res) => {
  const { key } = req.params;
  try {
    const result = await db.query("SELECT value FROM settings WHERE key = $1", [key]);
    if (result.rows.length === 0) {
      return res.json({ [key]: [] });
    }
    const value = JSON.parse(result.rows[0].value);
    res.json({ [key]: value });
  } catch (err) {
    console.error(`[SETTINGS] Error obteniendo ${key}:`, err);
    res.status(500).json({ error: `Error obteniendo configuración de ${key}.` });
  }
});

// PUT /settings/:key - Actualizar valor de configuración por clave (Solo ADMIN)
router.put('/:key', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  const { key } = req.params;
  const valueBody = req.body[key];
  
  if (valueBody === undefined) {
    return res.status(400).json({ error: `El campo ${key} es obligatorio en el cuerpo de la petición.` });
  }

  try {
    const valueStr = JSON.stringify(valueBody);
    await db.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [key, valueStr]
    );
    res.json({ success: true, [key]: valueBody });
  } catch (err) {
    console.error(`[SETTINGS] Error actualizando ${key}:`, err);
    res.status(500).json({ error: `Error actualizando ${key}.` });
  }
});

module.exports = router;
