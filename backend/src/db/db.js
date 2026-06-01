const pg = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let pgPool = null;
let sqliteDb = null;

// Determinamos si usamos SQLite o PostgreSQL
const isSqlite = process.env.DB_TYPE === 'sqlite' || !process.env.DB_HOST || process.env.DB_HOST === 'sqlite';

/**
 * Inicializa la conexión a la base de datos (con soporte para fallback).
 * @returns {Promise<void>}
 */
async function connect() {
  if (isSqlite) {
    const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '../../data/local.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    console.log(`[DB] Conectado a SQLite en: ${dbPath}`);
    return;
  }

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

  try {
    await pgPool.query('SELECT NOW()');
    console.log(`[DB] Conectado a PostgreSQL en: ${process.env.DB_HOST}`);
  } catch (err) {
    console.error('[DB] Error de conexión a PostgreSQL. Usando fallback SQLite temporario...', err.message);
    const dbPath = path.join(__dirname, '../../data/local.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    sqliteDb = new Database(dbPath);
    // Marcamos que a partir de ahora operamos como SQLite
    // Nota: El proceso seguirá teniendo DB_TYPE=postgresql en env si se configuró así, 
    // pero sqliteDb !== null hará que isSqlite() sea true.
  }
}

/**
 * Ejecuta una consulta SQL genérica compatible con PG y SQLite.
 * @param {string} text Consulta SQL usando sintaxis PG ($1, $2, etc.)
 * @param {Array} params Parámetros de la consulta
 */
async function query(text, params = []) {
  const currentType = process.env.DB_TYPE === 'sqlite' || sqliteDb !== null;

  if (currentType) {
    let cleanedSql = text;
    
    // 1. Reemplazar sintaxis $1, $2... por ? para SQLite
    cleanedSql = cleanedSql.replace(/\$\d+/g, '?');
    
    // 2. Manejar dialectos de fecha (NOW() -> CURRENT_TIMESTAMP)
    cleanedSql = cleanedSql.replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP');
    
    // 3. Manejar ON CONFLICT (específicos de PG)
    if (cleanedSql.toUpperCase().includes('ON CONFLICT') && cleanedSql.toUpperCase().includes('DO NOTHING')) {
      cleanedSql = cleanedSql.replace(/ON CONFLICT.*DO NOTHING/i, 'OR IGNORE');
    }
    
    // 4. Manejar RETURNING * o RETURNING id
    // SQLite no soporta RETURNING en versiones antiguas de better-sqlite3 o de forma nativa igual que PG
    let shouldReturnRows = false;
    if (cleanedSql.toUpperCase().includes('RETURNING')) {
      cleanedSql = cleanedSql.replace(/RETURNING.*/i, '');
      shouldReturnRows = true;
    }
    
    const statement = sqliteDb.prepare(cleanedSql);
    
    const upperSql = cleanedSql.trim().toUpperCase();
    if (upperSql.startsWith('SELECT') || upperSql.startsWith('WITH')) {
      const rows = statement.all(params);
      return { rows, rowCount: rows.length };
    } else {
      const result = statement.run(params);
      
      // Si se requería RETURNING, intentamos emularlo buscando la última fila si es posible
      // Nota: Esto es un fallback limitado. Solo funciona bien para INSERT simples.
      let rows = [];
      if (shouldReturnRows && result.lastInsertRowid) {
        // Intentar adivinar la tabla para el SELECT post-insert
        const tableMatch = upperSql.match(/INTO\s+([^\s\(]+)/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          const lastRow = sqliteDb.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(result.lastInsertRowid);
          if (lastRow) rows = [lastRow];
        }
      }

      return {
        rows,
        rowCount: result.changes,
        lastInsertId: result.lastInsertRowid
      };
    }
  } else {
    return await pgPool.query(text, params);
  }
}

module.exports = {
  connect,
  query,
  isSqlite: () => (process.env.DB_TYPE === 'sqlite' || sqliteDb !== null)
};
