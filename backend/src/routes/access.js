const express = require('express');
const router = express.Router();
const { query } = require('../db/db');
const { authenticateToken } = require('../middleware/authMiddleware');

// Registrar Entrada
router.post('/entrada', authenticateToken, async (req, res) => {
  const { personId, dni, uuid, timestamp, plate, origin, destination, visitor_type, reason } = req.body;
  const userId = req.user.id;

  try {
    let finalPersonId = personId;

    if (!finalPersonId && dni) {
      const personRes = await query('SELECT id FROM persons WHERE dni = $1', [dni]);
      if (personRes.rows.length === 0) {
        return res.status(404).json({ error: 'La persona con ese DNI no está registrada. Regístre la primero.' });
      }
      finalPersonId = personRes.rows[0].id;
    }

    if (!finalPersonId) {
      return res.status(400).json({ error: 'Se requiere el ID de la persona o su DNI.' });
    }

    const logTimestamp = timestamp ? new Date(timestamp) : new Date();
    const logUuid = uuid || null;

    const insertResult = await query(
      `INSERT INTO access_logs (uuid, person_id, access_type, timestamp, user_id, synced, plate, origin, destination, visitor_type, reason) 
       VALUES ($1, $2, 'ENTRADA', $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [logUuid, finalPersonId, logTimestamp, userId, !logUuid, plate || null, origin || null, destination || null, visitor_type || 'CLIENTE', reason || null]
    );

    const accessLog = insertResult.rows[0];

    res.status(201).json({
      success: true,
      log: accessLog,
      message: 'Ingreso registrado correctamente.'
    });

  } catch (err) {
    console.error('[ACCESS] Error registrando entrada:', err);
    res.status(500).json({ error: 'Error del servidor al registrar ingreso.' });
  }
});

// Registrar Salida
router.post('/salida', authenticateToken, async (req, res) => {
  const { personId, dni, uuid, timestamp, plate, origin, destination, visitor_type, reason } = req.body;
  const userId = req.user.id;

  try {
    let finalPersonId = personId;

    if (!finalPersonId && dni) {
      const personRes = await query('SELECT id FROM persons WHERE dni = $1', [dni]);
      if (personRes.rows.length === 0) {
        return res.status(404).json({ error: 'La persona con ese DNI no está registrada. Regístre la primero.' });
      }
      finalPersonId = personRes.rows[0].id;
    }

    if (!finalPersonId) {
      return res.status(400).json({ error: 'Se requiere el ID de la persona o su DNI.' });
    }

    const logTimestamp = timestamp ? new Date(timestamp) : new Date();
    const logUuid = uuid || null;

    const insertResult = await query(
      `INSERT INTO access_logs (uuid, person_id, access_type, timestamp, user_id, synced, plate, origin, destination, visitor_type, reason) 
       VALUES ($1, $2, 'SALIDA', $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [logUuid, finalPersonId, logTimestamp, userId, !logUuid, plate || null, origin || null, destination || null, visitor_type || 'CLIENTE', reason || null]
    );

    const accessLog = insertResult.rows[0];

    res.status(201).json({
      success: true,
      log: accessLog,
      message: 'Egreso registrado correctamente.'
    });

  } catch (err) {
    console.error('[ACCESS] Error registrando salida:', err);
    res.status(500).json({ error: 'Error del servidor al registrar egreso.' });
  }
});

// Obtener historial completo de accesos
router.get('/log', authenticateToken, async (req, res) => {
  try {
    // Consulta para listar logs unidos con datos de personas
    const sql = `
      SELECT 
        al.id, 
        al.uuid,
        al.access_type, 
        al.timestamp, 
        al.synced,
        al.plate,
        al.origin,
        al.destination,
        al.visitor_type,
        al.reason,
        p.id as person_id,
        p.dni, 
        p.first_name, 
        p.last_name,
        u.username as guard_name
      FROM access_logs al
      JOIN persons p ON al.person_id = p.id
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.timestamp DESC 
      LIMIT 100
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error('[ACCESS] Error obteniendo historial:', err);
    res.status(500).json({ error: 'Error al cargar el historial de accesos.' });
  }
});

// Obtener historial específico de una persona por DNI
router.get('/log/person/:dni', authenticateToken, async (req, res) => {
  const { dni } = req.params;
  try {
    const sql = `
      SELECT 
        al.id, 
        al.access_type, 
        al.timestamp,
        u.username as guard_name
      FROM access_logs al
      JOIN persons p ON al.person_id = p.id
      LEFT JOIN users u ON al.user_id = u.id
      WHERE p.dni = $1
      ORDER BY al.timestamp DESC
    `;
    const result = await query(sql, [dni]);
    res.json(result.rows);
  } catch (err) {
    console.error('[ACCESS] Error cargando logs por DNI:', err);
    res.status(500).json({ error: 'Error al buscar el historial de la persona.' });
  }
});

module.exports = router;
