const express = require('express');
const router = express.Router();
const { query, isSqlite } = require('../db/db');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * GET /api/reports
 * Genera un reporte unificado de ingresos y egresos.
 */
router.get('/', authenticateToken, async (req, res) => {
  const { dni, name, plate, sector, visitor_type, date_from, date_to } = req.query;
  
  let params = [];
  let paramIndex = 1;

  // Construcción de la consulta unified
  // Usamos un CTE o subconsulta para normalizar los datos de las 3 fuentes
  const unifiedSql = `
    SELECT 
        'PERSONA' as log_type,
        al.id, al.timestamp, al.access_type, 
        p.dni as identifier, (p.first_name || ' ' || p.last_name) as name, 
        al.plate, al.origin, al.destination, al.visitor_type, al.reason,
        NULL as document_nro
    FROM access_logs al
    JOIN persons p ON al.person_id = p.id

    UNION ALL

    SELECT 
        'VEHICULO' as log_type,
        val.id, val.timestamp, val.access_type, 
        v.plate as identifier, v.driver_name as name, 
        v.plate, val.origin, val.destination, 'VEHICULO' as visitor_type, NULL as reason,
        NULL as document_nro
    FROM vehicle_access_logs val
    JOIN vehicles v ON val.vehicle_id = v.id

    UNION ALL

    SELECT 
        'MECANICO' as log_type,
        ms.id, ms.timestamp, ms.access_type, 
        ms.plate as identifier, ms.client_name as name, 
        ms.plate, NULL as origin, 'Taller' as destination, 'MECANICO' as visitor_type, NULL as reason,
        ms.document_nro
    FROM mechanic_services ms
  `;

  // Filtro de insensibilidad a mayúsculas según el motor
  const likeOp = isSqlite() ? 'LIKE' : 'ILIKE';

  let sql = `SELECT * FROM (${unifiedSql}) as unified WHERE 1=1`;

  if (dni) {
    sql += ` AND identifier ${likeOp} $${paramIndex++}`;
    params.push(`%${dni}%`);
  }

  if (name) {
    sql += ` AND name ${likeOp} $${paramIndex++}`;
    params.push(`%${name}%`);
  }

  if (plate) {
    sql += ` AND plate ${likeOp} $${paramIndex++}`;
    params.push(`%${plate}%`);
  }

  if (sector) {
    sql += ` AND destination = $${paramIndex++}`;
    params.push(sector);
  }

  if (visitor_type) {
    sql += ` AND visitor_type = $${paramIndex++}`;
    params.push(visitor_type);
  }

  if (date_from) {
    sql += ` AND timestamp >= $${paramIndex++}`;
    params.push(new Date(date_from));
  }

  if (date_to) {
    const dTo = new Date(date_to);
    if (date_to.length <= 10) dTo.setHours(23, 59, 59, 999);
    sql += ` AND timestamp <= $${paramIndex++}`;
    params.push(dTo);
  }

  sql += ` ORDER BY timestamp DESC LIMIT 1000`;

  try {
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[REPORTS] Error generando reporte:', err);
    res.status(500).json({ error: 'Error al generar el reporte.' });
  }
});

/**
 * GET /api/reports/summary
 * Obtiene resúmenes estadísticos sencillos.
 */
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        // Personas hoy
        const personsToday = await query(`
            SELECT COUNT(*) as count FROM access_logs 
            WHERE timestamp >= CURRENT_DATE AND access_type = 'ENTRADA'
        `);
        
        // Vehículos hoy
        const vehiclesToday = await query(`
            SELECT COUNT(*) as count FROM vehicle_access_logs 
            WHERE timestamp >= CURRENT_DATE AND access_type = 'ENTRADA'
        `);

        // Mecánicos hoy
        const mechanicToday = await query(`
            SELECT COUNT(*) as count FROM mechanic_services 
            WHERE timestamp >= CURRENT_DATE AND access_type = 'ENTRADA'
        `);

        res.json({
            persons: parseInt(personsToday.rows[0].count),
            vehicles: parseInt(vehiclesToday.rows[0].count),
            mechanic: parseInt(mechanicToday.rows[0].count),
            total: parseInt(personsToday.rows[0].count) + parseInt(vehiclesToday.rows[0].count) + parseInt(mechanicToday.rows[0].count)
        });
    } catch (err) {
        console.error('[REPORTS-SUMMARY] Error:', err);
        res.status(500).json({ error: 'Error al obtener resumen.' });
    }
});

module.exports = router;
