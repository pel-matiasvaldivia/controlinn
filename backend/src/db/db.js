const pg = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let pgPool = null;
let sqliteDb = null;

// Determinamos si usamos SQLite o PostgreSQL
const isSqlite = process.env.DB_TYPE === 'sqlite' || !process.env.DB_HOST || process.env.DB_HOST === 'sqlite';

if (isSqlite) {
  const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '../../data/local.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL'); // Optimización de escritura concurrente
  console.log(`[DB] Conectado a SQLite en: ${dbPath}`);
} else {
  pgPool = new pg.Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'access_control',
    user: process.env.DB_USER || 'ac_user',
    password: process.env.DB_PASSWORD || 'control123',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  
  // Test conexión inicial
  pgPool.query('SELECT NOW()')
    .then(() => console.log(`[DB] Conectado a PostgreSQL en: ${process.env.DB_HOST}`))
    .catch(err => {
      console.error('[DB] Error de conexión a PostgreSQL. Usando fallback SQLite temporario...', err.message);
      // Fallback a SQLite para evitar caídas
      const dbPath = path.join(__dirname, '../../data/local.db');
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      sqliteDb = new Database(dbPath);
      process.env.DB_TYPE = 'sqlite';
    });
}

/**
 * Ejecuta una consulta SQL genérica compatible con PG y SQLite.
 * @param {string} text Consulta SQL usando sintaxis PG ($1, $2, etc.)
 * @param {Array} params Parámetros de la consulta
 */
async function query(text, params = []) {
  const currentType = process.env.DB_TYPE === 'sqlite' || sqliteDb !== null;

  if (currentType) {
    // Reemplazar sintaxis $1, $2... por ? para SQLite
    const sqliteSql = text.replace(/\$\d+/g, '?');
    
    // SQLite no soporta 'RETURNING *' o 'ON CONFLICT (username) DO NOTHING' de la misma manera que PG
    // Limpiamos algunos modificadores específicos si es necesario
    let cleanedSql = sqliteSql;
    if (cleanedSql.toUpperCase().includes('ON CONFLICT') && cleanedSql.toUpperCase().includes('DO NOTHING')) {
      cleanedSql = cleanedSql.replace(/ON CONFLICT.*DO NOTHING/i, 'OR IGNORE');
    }
    
    const statement = sqliteDb.prepare(cleanedSql);
    
    const upperSql = cleanedSql.trim().toUpperCase();
    if (upperSql.startsWith('SELECT') || upperSql.startsWith('WITH')) {
      const rows = statement.all(params);
      return { rows, rowCount: rows.length };
    } else {
      const result = statement.run(params);
      // Para emular RETURNING id en inserciones, si es INSERT, buscamos la fila insertada si se requiere
      return {
        rows: [],
        rowCount: result.changes,
        lastInsertId: result.lastInsertRowid
      };
    }
  } else {
    return await pgPool.query(text, params);
  }
}

module.exports = {
  query,
  isSqlite: () => (process.env.DB_TYPE === 'sqlite' || sqliteDb !== null)
};
