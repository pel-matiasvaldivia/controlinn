const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { authenticateToken } = require('../middleware/authMiddleware');

// GET /settings/sectors - Obtener lista de sectores
router.get('/sectors', authenticateToken, async (req, res) => {
  try {
    const result = await db.query("SELECT value FROM settings WHERE key = 'sectors'");
    if (result.rows.length === 0) {
      return res.json({ sectors: [] });
    }
    const sectors = JSON.parse(result.rows[0].value);
    res.json({ sectors });
  } catch (err) {
    console.error('[SETTINGS] Error obteniendo sectores:', err);
    res.status(500).json({ error: 'Error obteniendo configuración de sectores.' });
  }
});

// PUT /settings/sectors - Actualizar lista de sectores
router.put('/sectors', authenticateToken, async (req, res) => {
  const { sectors } = req.body;
  if (!Array.isArray(sectors)) {
    return res.status(400).json({ error: 'El campo sectors debe ser un array.' });
  }

  try {
    const value = JSON.stringify(sectors);
    await db.query(
      "INSERT INTO settings (key, value) VALUES ('sectors', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [value]
    );
    res.json({ success: true, sectors });
  } catch (err) {
    console.error('[SETTINGS] Error actualizando sectores:', err);
    res.status(500).json({ error: 'Error actualizando sectores.' });
  }
});

module.exports = router;
