const express = require('express');
const router = express.Router();
const { query } = require('../db/db');
const { parseDniQr } = require('../services/qrService');
const { authenticateToken } = require('../middleware/authMiddleware');

// Obtener todas las personas
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM persons ORDER BY last_name ASC, first_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('[PERSONS] Error obteniendo personas:', err);
    res.status(500).json({ error: 'Error al obtener la lista de personas.' });
  }
});

// Obtener persona por DNI
router.get('/:dni', authenticateToken, async (req, res) => {
  const { dni } = req.params;
  try {
    const result = await query('SELECT * FROM persons WHERE dni = $1', [dni]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Persona no encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PERSONS] Error obteniendo persona por DNI:', err);
    res.status(500).json({ error: 'Error al buscar persona.' });
  }
});

// Registrar o actualizar persona mediante escaneo de QR
router.post('/scan', authenticateToken, async (req, res) => {
  const { qrData } = req.body;

  if (!qrData) {
    return res.status(400).json({ error: 'El campo qrData es requerido.' });
  }

  try {
    // Parsear datos del DNI Argentino
    const parsedData = parseDniQr(qrData);
    const { dni, firstName, lastName, gender, birthDate } = parsedData;

    // Verificar si la persona ya existe
    const checkResult = await query('SELECT * FROM persons WHERE dni = $1', [dni]);
    let person;

    if (checkResult.rows.length > 0) {
      // Persona existe, la actualizamos con los datos más recientes del QR
      console.log(`[PERSONS] Persona con DNI ${dni} ya existe. Actualizando datos...`);
      await query(
        `UPDATE persons 
         SET first_name = $1, last_name = $2, gender = $3, birth_date = $4, qr_data = $5, updated_at = NOW() 
         WHERE dni = $6`,
        [firstName, lastName, gender, birthDate, qrData, dni]
      );
      
      const updatedResult = await query('SELECT * FROM persons WHERE dni = $1', [dni]);
      person = updatedResult.rows[0];
    } else {
      // Persona no existe, la creamos
      console.log(`[PERSONS] Persona con DNI ${dni} es nueva. Registrando...`);
      const insertResult = await query(
        `INSERT INTO persons (dni, first_name, last_name, gender, birth_date, qr_data) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [dni, firstName, lastName, gender, birthDate, qrData]
      );
      
      person = insertResult.rows[0];
    }

    res.json({
      success: true,
      person,
      message: checkResult.rows.length > 0 ? 'Datos actualizados desde el DNI' : 'Persona registrada exitosamente'
    });

  } catch (err) {
    console.error('[PERSONS] Error en escaneo DNI QR:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Crear persona manualmente
router.post('/', authenticateToken, async (req, res) => {
  const { dni, first_name, last_name, gender, birth_date, photo } = req.body;
  let effectiveDni = dni;
  if (!effectiveDni) {
    // Si no hay DNI, generamos uno virtual (útil para mecánicos)
    effectiveDni = `MEC-${Date.now()}`;
  }

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'Nombre y Apellido son campos requeridos.' });
  }

  try {
    const checkResult = await query('SELECT * FROM persons WHERE dni = $1', [dni]);
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe una persona registrada con ese DNI.' });
    }

    const insertResult = await query(
      `INSERT INTO persons (dni, first_name, last_name, gender, birth_date, photo) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [effectiveDni, first_name.trim().toUpperCase(), last_name.trim().toUpperCase(), gender, birth_date, photo]
    );

    const person = insertResult.rows[0];

    res.status(201).json(person);
  } catch (err) {
    console.error('[PERSONS] Error creando persona manual:', err);
    res.status(500).json({ error: 'Error al registrar la persona.' });
  }
});

// Actualizar persona
router.put('/:dni', authenticateToken, async (req, res) => {
  const { dni } = req.params;
  const { first_name, last_name, gender, birth_date, photo } = req.body;

  try {
    const checkResult = await query('SELECT * FROM persons WHERE dni = $1', [dni]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Persona no encontrada.' });
    }

    await query(
      `UPDATE persons 
       SET first_name = $1, last_name = $2, gender = $3, birth_date = $4, photo = $5, updated_at = NOW() 
       WHERE dni = $6`,
      [first_name.trim().toUpperCase(), last_name.trim().toUpperCase(), gender, birth_date, photo, dni]
    );

    const updatedResult = await query('SELECT * FROM persons WHERE dni = $1', [dni]);
    res.json(updatedResult.rows[0]);
  } catch (err) {
    console.error('[PERSONS] Error actualizando persona:', err);
    res.status(500).json({ error: 'Error al actualizar persona.' });
  }
});

// Eliminar persona
router.delete('/:dni', authenticateToken, async (req, res) => {
  const { dni } = req.params;
  try {
    const checkResult = await query('SELECT * FROM persons WHERE dni = $1', [dni]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Persona no encontrada.' });
    }

    await query('DELETE FROM persons WHERE dni = $1', [dni]);
    res.json({ success: true, message: `Persona con DNI ${dni} eliminada correctamente.` });
  } catch (err) {
    console.error('[PERSONS] Error eliminando persona:', err);
    res.status(500).json({ error: 'Error al eliminar persona de la base de datos.' });
  }
});

module.exports = router;
