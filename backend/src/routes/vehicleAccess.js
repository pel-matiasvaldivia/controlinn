const express = require('express');
const router = express.Router();
const { query } = require('../db/db');
const { authenticateToken } = require('../middleware/authMiddleware');

// Registrar Entrada de Vehículo
router.post('/entrada', authenticateToken, async (req, res) => {
  const { vehicleId, plate, driverName, driverDni, vehicleType, uuid, timestamp } = req.body;
  const userId = req.user.id;

  try {
    let finalVehicleId = vehicleId;

    // Si se pasa la patente, buscamos el vehículo o lo registramos al vuelo
    if (!finalVehicleId && plate) {
      const normalizedPlate = plate.trim().toUpperCase();
      const vehRes = await query('SELECT id FROM vehicles WHERE plate = $1', [normalizedPlate]);
      
      if (vehRes.rows.length > 0) {
        finalVehicleId = vehRes.rows[0].id;
      } else {
        // Registrar vehículo al vuelo si no existe
        console.log(`[VEHICLE-ACCESS] Registrando vehículo ${normalizedPlate} al vuelo durante ingreso...`);
        const insertVehRes = await query(
          `INSERT INTO vehicles (plate, driver_name, driver_dni, vehicle_type) 
           VALUES ($1, $2, $3, $4) 
           RETURNING *`,
          [normalizedPlate, driverName || null, driverDni || null, vehicleType || null]
        );
        
        finalVehicleId = insertVehRes.rows[0].id;
      }
    }

    if (!finalVehicleId) {
      return res.status(400).json({ error: 'Se requiere el ID del vehículo o su patente.' });
    }

    // Insertar log de acceso
    const logTimestamp = timestamp ? new Date(timestamp) : new Date();
    const logUuid = uuid || null;

    const insertResult = await query(
      `INSERT INTO vehicle_access_logs (uuid, vehicle_id, access_type, timestamp, user_id, synced) 
       VALUES ($1, $2, 'ENTRADA', $3, $4, $5) 
       RETURNING *`,
      [logUuid, finalVehicleId, logTimestamp, userId, !logUuid]
    );

    const accessLog = insertResult.rows[0];

    res.status(201).json({
      success: true,
      log: accessLog,
      message: 'Ingreso del vehículo registrado correctamente.'
    });

  } catch (err) {
    console.error('[VEHICLE-ACCESS] Error registrando entrada:', err);
    res.status(500).json({ error: 'Error del servidor al registrar ingreso del vehículo.' });
  }
});

// Registrar Salida de Vehículo
router.post('/salida', authenticateToken, async (req, res) => {
  const { vehicleId, plate, driverName, driverDni, vehicleType, uuid, timestamp } = req.body;
  const userId = req.user.id;

  try {
    let finalVehicleId = vehicleId;

    if (!finalVehicleId && plate) {
      const normalizedPlate = plate.trim().toUpperCase();
      const vehRes = await query('SELECT id FROM vehicles WHERE plate = $1', [normalizedPlate]);
      
      if (vehRes.rows.length > 0) {
        finalVehicleId = vehRes.rows[0].id;
      } else {
        // Registrar al vuelo en la salida si por alguna razón no existía
        const insertVehRes = await query(
          `INSERT INTO vehicles (plate, driver_name, driver_dni, vehicle_type) 
           VALUES ($1, $2, $3, $4) 
           RETURNING *`,
          [normalizedPlate, driverName || null, driverDni || null, vehicleType || null]
        );
        finalVehicleId = insertVehRes.rows[0].id;
      }
    }

    if (!finalVehicleId) {
      return res.status(400).json({ error: 'Se requiere el ID del vehículo o su patente.' });
    }

    // Insertar log de salida
    const logTimestamp = timestamp ? new Date(timestamp) : new Date();
    const logUuid = uuid || null;

    const insertResult = await query(
      `INSERT INTO vehicle_access_logs (uuid, vehicle_id, access_type, timestamp, user_id, synced) 
       VALUES ($1, $2, 'SALIDA', $3, $4, $5) 
       RETURNING *`,
      [logUuid, finalVehicleId, logTimestamp, userId, !logUuid]
    );

    const accessLog = insertResult.rows[0];

    res.status(201).json({
      success: true,
      log: accessLog,
      message: 'Egreso del vehículo registrado correctamente.'
    });

  } catch (err) {
    console.error('[VEHICLE-ACCESS] Error registrando salida:', err);
    res.status(500).json({ error: 'Error del servidor al registrar egreso del vehículo.' });
  }
});

// Obtener historial completo de movimientos de vehículos
router.get('/log', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT 
        val.id, 
        val.uuid,
        val.access_type, 
        val.timestamp, 
        val.synced,
        v.id as vehicle_id,
        v.plate, 
        v.driver_name, 
        v.driver_dni,
        v.vehicle_type,
        u.username as guard_name
      FROM vehicle_access_logs val
      JOIN vehicles v ON val.vehicle_id = v.id
      LEFT JOIN users u ON val.user_id = u.id
      ORDER BY val.timestamp DESC 
      LIMIT 100
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error('[VEHICLE-ACCESS] Error obteniendo historial:', err);
    res.status(500).json({ error: 'Error al cargar el historial de vehículos.' });
  }
});

module.exports = router;
