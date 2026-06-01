const { query, isSqlite } = require('./db');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  console.log('[DB-INIT] Iniciando inicialización de base de datos...');
  
  const tables = [];
  
  if (isSqlite()) {
    console.log('[DB-INIT] Detectado entorno SQLite. Creando tablas...');
    
    // Tabla Users
    tables.push(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'GUARDIA',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla Persons
    tables.push(`
      CREATE TABLE IF NOT EXISTS persons (
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
      )
    `);

    // Tabla Access Logs (Personas)
    tables.push(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE,
        person_id INTEGER,
        access_type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        synced INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      )
    `);

    // Tabla Vehicles
    tables.push(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate TEXT UNIQUE NOT NULL,
        driver_name TEXT,
        driver_dni TEXT,
        vehicle_type TEXT,
        photo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla Vehicle Access Logs
    tables.push(`
      CREATE TABLE IF NOT EXISTS vehicle_access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE,
        vehicle_id INTEGER,
        access_type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        synced INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      )
    `);

    // Tabla Audit Logs
    tables.push(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      )
    `);
  } else {
    console.log('[DB-INIT] Detectado entorno PostgreSQL. Las tablas se inicializarán por el contenedor de postgres...');
    return;
  }

  // Ejecutar creación de tablas en SQLite secuencialmente
  for (const sql of tables) {
    try {
      await query(sql);
    } catch (err) {
      console.error('[DB-INIT] Error ejecutando sentencia:', sql, err);
      process.exit(1);
    }
  }

  // Insertar usuarios por defecto en SQLite
  try {
    const defaultPassword = 'control123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(defaultPassword, salt);
    
    // Verificar si ya existen usuarios
    const usersCount = await query('SELECT COUNT(*) as count FROM users');
    const count = isSqlite() ? usersCount.rows[0].count : parseInt(usersCount.rows[0].count);

    if (count === 0) {
      console.log('[DB-INIT] Base de datos vacía. Creando usuarios admin y guardia por defecto...');
      await query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', hash, 'ADMIN']);
      await query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['guardia', hash, 'GUARDIA']);
      console.log('[DB-INIT] Usuarios iniciales insertados con contraseña: control123');
    }
  } catch (err) {
    console.error('[DB-INIT] Error insertando usuarios por defecto:', err);
  }

  console.log('[DB-INIT] Inicialización completada con éxito.');
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;
