const express = require('express');
const router = express.Router();
const { query } = require('../db/db');
const { authenticateToken } = require('../middleware/authMiddleware');

// Validar estado de conexión
router.get('/status', (req, res) => {
  res.json({ online: true, timestamp: new Date() });
});

// PULL: El cliente pide todos los datos del servidor para refrescar su cache local
router.get('/pull', authenticateToken, async (req, res) => {
  try {
    const personsRes = await query('SELECT * FROM persons');
    const vehiclesRes = await query('SELECT * FROM vehicles');
    
    res.json({
      persons: personsRes.rows,
      vehicles: vehiclesRes.rows,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('[SYNC-PULL] Error:', err);
    res.status(500).json({ error: 'Error al descargar datos para sincronización.' });
  }
});

// PUSH: El cliente sube sus cambios registrados offline
router.post('/push', authenticateToken, async (req, res) => {
  const { persons = [], vehicles = [], accessLogs = [], vehicleAccessLogs = [] } = req.body;
  const userId = req.user.id;

  console.log(`[SYNC-PUSH] Recibiendo datos de sincronización: ${persons.length} personas, ${vehicles.length} vehículos, ${accessLogs.length} logs de personas, ${vehicleAccessLogs.length} logs de vehículos`);

  const results = {
    personsSynced: 0,
    vehiclesSynced: 0,
    accessLogsSynced: 0,
    vehicleAccessLogsSynced: 0,
    errors: []
  };

  try {
    // 1. Sincronizar Personas creadas offline
    for (const p of persons) {
      try {
        const check = await query('SELECT id FROM persons WHERE dni = $1', [p.dni]);
        if (check.rows.length > 0) {
          // Ya existe, actualizamos
          await query(
            `UPDATE persons SET first_name = $1, last_name = $2, gender = $3, birth_date = $4, photo = $5, updated_at = NOW() WHERE dni = $6`,
            [p.first_name, p.last_name, p.gender, p.birth_date, p.photo, p.dni]
          );
        } else {
          // No existe, creamos
          await query(
            `INSERT INTO persons (dni, first_name, last_name, gender, birth_date, photo) VALUES ($1, $2, $3, $4, $5, $6)`,
            [p.dni, p.first_name, p.last_name, p.gender, p.birth_date, p.photo]
          );
        }
        results.personsSynced++;
      } catch (err) {
        results.errors.push(`Persona DNI ${p.dni}: ${err.message}`);
      }
    }

    // 2. Sincronizar Vehículos creados offline
    for (const v of vehicles) {
      try {
        const check = await query('SELECT id FROM vehicles WHERE plate = $1', [v.plate]);
        if (check.rows.length > 0) {
          await query(
            `UPDATE vehicles SET driver_name = $1, driver_dni = $2, vehicle_type = $3, photo = $4 WHERE plate = $5`,
            [v.driver_name, v.driver_dni, v.vehicle_type, v.photo, v.plate]
          );
        } else {
          await query(
            `INSERT INTO vehicles (plate, driver_name, driver_dni, vehicle_type, photo) VALUES ($1, $2, $3, $4, $5)`,
            [v.plate, v.driver_name, v.driver_dni, v.vehicle_type, v.photo]
          );
        }
        results.vehiclesSynced++;
      } catch (err) {
        results.errors.push(`Vehículo Patente ${v.plate}: ${err.message}`);
      }
    }

    // 3. Sincronizar Logs de Personas
    // Para logs offline, resolvemos el ID real de la persona buscando por su DNI
    for (const log of accessLogs) {
      try {
        // Verificar si el log ya se sincronizó antes usando el UUID
        if (log.uuid) {
          const checkLog = await query('SELECT id FROM access_logs WHERE uuid = $1', [log.uuid]);
          if (checkLog.rows.length > 0) {
            results.accessLogsSynced++;
            continue; // Ya sincronizado
          }
        }

        // Encontrar persona por DNI
        const personRes = await query('SELECT id FROM persons WHERE dni = $1', [log.dni]);
        if (personRes.rows.length > 0) {
          const realPersonId = personRes.rows[0].id;
          const logTimestamp = log.timestamp ? new Date(log.timestamp) : new Date();
          
          await query(
            `INSERT INTO access_logs (uuid, person_id, access_type, timestamp, user_id, synced) 
             VALUES ($1, $2, $3, $4, $5, true)`,
            [log.uuid || null, realPersonId, log.access_type, logTimestamp, userId]
          );
          results.accessLogsSynced++;
        } else {
          results.errors.push(`Log Persona: DNI ${log.dni} no encontrado en la base de datos central.`);
        }
      } catch (err) {
        results.errors.push(`Log Persona UUID ${log.uuid}: ${err.message}`);
      }
    }

    // 4. Sincronizar Logs de Vehículos
    // Resolvemos el ID buscando por la patente
    for (const log of vehicleAccessLogs) {
      try {
        if (log.uuid) {
          const checkLog = await query('SELECT id FROM vehicle_access_logs WHERE uuid = $1', [log.uuid]);
          if (checkLog.rows.length > 0) {
            results.vehicleAccessLogsSynced++;
            continue; // Ya sincronizado
          }
        }

        const vehicleRes = await query('SELECT id FROM vehicles WHERE plate = $1', [log.plate]);
        if (vehicleRes.rows.length > 0) {
          const realVehicleId = vehicleRes.rows[0].id;
          const logTimestamp = log.timestamp ? new Date(log.timestamp) : new Date();

          await query(
            `INSERT INTO vehicle_access_logs (uuid, vehicle_id, access_type, timestamp, user_id, synced) 
             VALUES ($1, $2, $3, $4, $5, true)`,
            [log.uuid || null, realVehicleId, log.access_type, logTimestamp, userId]
          );
          results.vehicleAccessLogsSynced++;
        } else {
          results.errors.push(`Log Vehículo: Patente ${log.plate} no encontrada en la base de datos central.`);
        }
      } catch (err) {
        results.errors.push(`Log Vehículo UUID ${log.uuid}: ${err.message}`);
      }
    }

    res.json({
      success: results.errors.length === 0,
      synced: results,
      message: 'Sincronización completada.'
    });

  } catch (err) {
    console.error('[SYNC-PUSH] Error crítico:', err);
    res.status(500).json({ error: 'Error crítico del servidor durante la sincronización.' });
  }
});

module.exports = router;
