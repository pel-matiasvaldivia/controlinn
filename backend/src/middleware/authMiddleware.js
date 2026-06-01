const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'controlinn_secret_key_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no provisto.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ error: 'Token inválido o corrupto.' });
    }
    req.user = user;
    next();
  });
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }
    
    const hasRole = roles.includes(req.user.role);
    if (!hasRole) {
      return res.status(403).json({ error: 'Acceso prohibido para este rol.' });
    }
    
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
