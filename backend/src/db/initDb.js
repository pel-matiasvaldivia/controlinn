const { query, isSqlite } = require('./db');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  console.log('[DB-INIT] Iniciando inicialización de base de datos...');
  
  const pgMigrations = [
    // Tabla Users
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'GUARDIA',
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    // Tabla Persons
    `CREATE TABLE IF NOT EXISTS persons (
      id SERIAL PRIMARY KEY,
      dni VARCHAR(20) UNIQUE NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      gender VARCHAR(10),
      birth_date DATE,
      photo TEXT,
      qr_data TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    // Tabla Access Logs (Personas)
    `CREATE TABLE IF NOT EXISTS access_logs (
      id SERIAL PRIMARY KEY,
      uuid VARCHAR(50) UNIQUE,
      person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
      access_type VARCHAR(10) NOT NULL,
      timestamp TIMESTAMP DEFAULT NOW(),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      synced BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    // Tabla Vehicles
    `CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      plate VARCHAR(20) UNIQUE NOT NULL,
      driver_name VARCHAR(100),
      driver_dni VARCHAR(20),
      vehicle_type VARCHAR(50),
      photo TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    // Tabla Vehicle Access Logs
    `CREATE TABLE IF NOT EXISTS vehicle_access_logs (
      id SERIAL PRIMARY KEY,
      uuid VARCHAR(50) UNIQUE,
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
      access_type VARCHAR(10) NOT NULL,
      timestamp TIMESTAMP DEFAULT NOW(),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      synced BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    // Tabla Mechanic Services
    `CREATE TABLE IF NOT EXISTS mechanic_services (
      id SERIAL PRIMARY KEY,
      uuid VARCHAR(50) UNIQUE,
      plate VARCHAR(20) NOT NULL,
      brand VARCHAR(100),
      model VARCHAR(100),
      client_name VARCHAR(150),
      access_type VARCHAR(10) NOT NULL,
      timestamp TIMESTAMP DEFAULT NOW(),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      synced BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    // Tabla Settings
    `CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT NOT NULL
    )`,

    // --- MIGRACIONES INCREMENTALES (PostgreSQL) ---
    `ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS plate VARCHAR(20)`,
    `ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS origin VARCHAR(100)`,
    `ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS destination VARCHAR(100)`,
    `ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS visitor_type VARCHAR(20) DEFAULT 'CLIENTE'`,
    `ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS reason TEXT`,
    `ALTER TABLE vehicle_access_logs ADD COLUMN IF NOT EXISTS origin VARCHAR(100)`,
    `ALTER TABLE vehicle_access_logs ADD COLUMN IF NOT EXISTS destination VARCHAR(100)`,
    
    // Configuración inicial de sectores
    `INSERT INTO settings (key, value) VALUES ('sectors', '["Administración", "Producción", "Ventas", "Carga/Descarga", "Taller"]') ON CONFLICT (key) DO NOTHING`
  ];

  const sqliteTables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'GUARDIA',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dni TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT,
      birth_date TEXT,
      photo TEXT,
      qr_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      person_id INTEGER,
      access_type TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      synced INTEGER DEFAULT 0,
      visitor_type TEXT DEFAULT 'CLIENTE',
      reason TEXT,
      plate TEXT,
      origin TEXT,
      destination TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate TEXT UNIQUE NOT NULL,
      driver_name TEXT,
      driver_dni TEXT,
      vehicle_type TEXT,
      photo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vehicle_access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      vehicle_id INTEGER,
      access_type TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      synced INTEGER DEFAULT 0,
      origin TEXT,
      destination TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS mechanic_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      plate TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      client_name TEXT,
      access_type TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      synced INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`
  ];

  const currentMigrations = isSqlite() ? sqliteTables : pgMigrations;

  for (const sql of currentMigrations) {
    try {
      await query(sql);
    } catch (err) {
      // Ignorar errores de columnas ya existentes en PostgreSQL si el parser falla (aunque ADD COLUMN IF NOT EXISTS debería prevenir esto)
      if (err.message.includes('already exists')) {
        console.warn('[DB-INIT] Columna o tabla ya existente:', err.message);
      } else {
        console.error('[DB-INIT] Error ejecutando sentenciaMigration:', sql, err.message);
      }
    }
  }

  // Insertar usuarios por defecto
  try {
    const defaultPassword = 'control123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(defaultPassword, salt);
    
    const usersCount = await query('SELECT COUNT(*) as count FROM users');
    const count = isSqlite() ? usersCount.rows[0].count : parseInt(usersCount.rows[0].count);

    if (count === 0) {
      console.log('[DB-INIT] Base de datos vacía. Creando usuarios iniciales...');
      await query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', hash, 'ADMIN']);
      await query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['guardia', hash, 'GUARDIA']);
      console.log('[DB-INIT] Usuarios insertados.');
    }
  } catch (err) {
    console.error('[DB-INIT] Error configurando usuarios:', err.message);
  }

  console.log('[DB-INIT] Inicialización completada.');
}

module.exports = initializeDatabase;
