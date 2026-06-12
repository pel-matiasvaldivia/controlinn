const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/db');

const JWT_SECRET = process.env.JWT_SECRET || 'controlinn_secret_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'controlinn_refresh_secret_key_2026';

// Login de usuarios
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generar tokens
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' } // Expiración de 1 hora
    );

    const refreshToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' } // Refresh token dura 7 días
    );

    // Guardar auditoría del login
    await query('INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)', 
      [user.id, 'LOGIN', `El usuario ${user.username} ingresó al sistema`]
    );

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    console.error('[AUTH] Error en login:', err);
    res.status(500).json({ error: 'Error del servidor en proceso de login.' });
  }
});

// Refrescar el token de acceso
router.post('/refresh', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'Refresh token requerido.' });
  }

  try {
    jwt.verify(token, JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Refresh token inválido o expirado.' });
      }

      // Generar nuevo access token
      const accessToken = jwt.sign(
        { id: decoded.id, username: decoded.username, role: decoded.role },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({ accessToken });
    });
  } catch (err) {
    console.error('[AUTH] Error en refresh token:', err);
    res.status(500).json({ error: 'Error del servidor al refrescar token.' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  const { userId } = req.body;
  
  try {
    if (userId) {
      await query('INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)', 
        [userId, 'LOGOUT', `El usuario cerró sesión`]
      );
    }
    res.json({ success: true, message: 'Sesión cerrada con éxito.' });
  } catch (err) {
    console.error('[AUTH] Error en logout:', err);
    res.status(500).json({ error: 'Error del servidor en logout.' });
  }
});

const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// ... (existing login, refresh, logout routes) ...

// --- GESTIÓN DE USUARIOS (Solo ADMIN) ---

// GET /auth/users - Listar todos los usuarios
router.get('/users', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const result = await query('SELECT id, username, role, created_at FROM users ORDER BY username ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('[AUTH] Error listando usuarios:', err);
    res.status(500).json({ error: 'Error obteniendo lista de usuarios.' });
  }
});

// POST /auth/users - Crear un nuevo usuario
router.post('/users', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username.toLowerCase(), passwordHash, role.toUpperCase()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505' || err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
    }
    console.error('[AUTH] Error creando usuario:', err);
    res.status(500).json({ error: 'Error al crear el usuario.' });
  }
});

// PUT /auth/users/:id - Actualizar usuario o contraseña
router.put('/users/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  try {
    let sql = 'UPDATE users SET ';
    const params = [];
    const updates = [];

    if (username) {
      updates.push(`username = $${updates.length + 1}`);
      params.push(username.toLowerCase());
    }
    if (role) {
      updates.push(`role = $${updates.length + 1}`);
      params.push(role.toUpperCase());
    }
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      updates.push(`password_hash = $${updates.length + 1}`);
      params.push(passwordHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar.' });
    }

    sql += updates.join(', ') + ` WHERE id = $${updates.length + 1} RETURNING id, username, role`;
    params.push(id);

    const result = await query(sql, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[AUTH] Error actualizando usuario:', err);
    res.status(500).json({ error: 'Error al actualizar el usuario.' });
  }
});

// DELETE /auth/users/:id - Eliminar usuario
router.delete('/users/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  const { id } = req.params;

  try {
    // Evitar que el admin se borre a sí mismo
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
    }

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({ success: true, message: 'Usuario eliminado.' });
  } catch (err) {
    console.error('[AUTH] Error eliminando usuario:', err);
    res.status(500).json({ error: 'Error al eliminar el usuario.' });
  }
});

module.exports = router;
