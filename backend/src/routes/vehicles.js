const express = require('express');
const router = express.Router();
const { query } = require('../db/db');
const { authenticateToken } = require('../middleware/authMiddleware');

// Obtener todos los vehículos
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM vehicles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('[VEHICLES] Error obteniendo vehículos:', err);
    res.status(500).json({ error: 'Error al obtener la lista de vehículos.' });
  }
});

// Obtener vehículo por patente (normalizada sin espacios)
router.get('/:plate', authenticateToken, async (req, res) => {
  let { plate } = req.params;
  plate = plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  try {
    // Para simplificar la búsqueda, podemos buscar patentes ignorando guiones/espacios si están guardados así.
    // Usaremos un filtro simple:
    const result = await query(
      `SELECT * FROM vehicles 
       WHERE UPPER(REPLACE(REPLACE(plate, ' ', ''), '-', '')) = $1`, 
      [plate]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehículo no registrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[VEHICLES] Error obteniendo vehículo por patente:', err);
    res.status(500).json({ error: 'Error al buscar vehículo.' });
  }
});

// Registrar un vehículo
router.post('/', authenticateToken, async (req, res) => {
  const { plate, driver_name, driver_dni, vehicle_type, photo } = req.body;

  if (!plate) {
    return res.status(400).json({ error: 'La patente es requerida.' });
  }

  // Normalizar la patente (ej: "AA 123 BB" -> "AA123BB")
  const normalizedPlate = plate.trim().toUpperCase();

  try {
    const checkResult = await query('SELECT * FROM vehicles WHERE plate = $1', [normalizedPlate]);
    let vehicle;

    if (checkResult.rows.length > 0) {
      // Vehículo existe, actualizamos los datos del conductor
      console.log(`[VEHICLES] Vehículo con patente ${normalizedPlate} ya existe. Actualizando datos...`);
      await query(
        `UPDATE vehicles 
         SET driver_name = $1, driver_dni = $2, vehicle_type = $3, photo = $4 
         WHERE plate = $5`,
        [driver_name, driver_dni, vehicle_type, photo, normalizedPlate]
      );
      const updatedResult = await query('SELECT * FROM vehicles WHERE plate = $1', [normalizedPlate]);
      vehicle = updatedResult.rows[0];
    } else {
      // Registrar nuevo
      console.log(`[VEHICLES] Registrando nuevo vehículo: ${normalizedPlate}`);
      const insertResult = await query(
        `INSERT INTO vehicles (plate, driver_name, driver_dni, vehicle_type, photo) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [normalizedPlate, driver_name, driver_dni, vehicle_type, photo]
      );
      
      vehicle = insertResult.rows[0];
    }

    res.status(201).json(vehicle);
  } catch (err) {
    console.error('[VEHICLES] Error creando/actualizando vehículo:', err);
    res.status(500).json({ error: 'Error al registrar vehículo.' });
  }
});

module.exports = router;
