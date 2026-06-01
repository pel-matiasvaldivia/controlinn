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

module.exports = router;
