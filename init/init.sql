-- Habilitar extensión UUID si es necesaria
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'GUARDIA', -- 'GUARDIA' | 'ADMIN' | 'SUPERVISOR'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Personas
CREATE TABLE IF NOT EXISTS persons (
  id SERIAL PRIMARY KEY,
  dni VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  gender VARCHAR(10),
  birth_date DATE,
  photo TEXT, -- Guarda URL o representación en Base64
  qr_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Logs de Acceso de Personas
CREATE TABLE IF NOT EXISTS access_logs (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(50) UNIQUE, -- Para sincronización offline
  person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
  access_type VARCHAR(10) NOT NULL, -- 'ENTRADA' | 'SALIDA'
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  synced BOOLEAN DEFAULT FALSE,
  plate VARCHAR(20),        -- Patente del vehículo (opcional)
  origin VARCHAR(100),      -- Procedencia
  destination VARCHAR(100), -- Destino (sector)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Vehículos
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  plate VARCHAR(20) UNIQUE NOT NULL, -- AA123BB o AAA123
  driver_name VARCHAR(100),
  driver_dni VARCHAR(20),
  vehicle_type VARCHAR(50),
  photo TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Logs de Acceso de Vehículos
CREATE TABLE IF NOT EXISTS vehicle_access_logs (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(50) UNIQUE, -- Para sincronización offline
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  access_type VARCHAR(10) NOT NULL, -- 'ENTRADA' | 'SALIDA'
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  synced BOOLEAN DEFAULT FALSE,
  origin VARCHAR(100),      -- Procedencia
  destination VARCHAR(100), -- Destino (sector)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Auditoría General
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Tabla de Servicio Mecánico (motos agendadas)
CREATE TABLE IF NOT EXISTS mechanic_services (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(50) UNIQUE,
  plate VARCHAR(20) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  client_name VARCHAR(150),
  access_type VARCHAR(10) NOT NULL, -- 'ENTRADA' | 'SALIDA'
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Configuración / Ajustes
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL
);

-- Sectores iniciales
INSERT INTO settings (key, value) 
VALUES ('sectors', '["Administración", "Producción", "Ventas", "Carga/Descarga", "Taller"]')
ON CONFLICT (key) DO NOTHING;

-- Insertar usuarios iniciales (contraseña por defecto para ambos es: 'control123')
-- El hash de bcrypt para 'control123' es $2a$10$w6DqW18ZfD4924uL.r3bKez9Rz3HjVlU4jN6r7F0Kx0eY2Xk89Wk2 (o similar)
-- Usamos un hash válido generado por bcrypt
INSERT INTO users (username, password_hash, role)
VALUES 
('admin', '$2a$10$dE2IFWo4tTB6M3tljXUxHuPH9wvi2tW2eqfdTwkGkWcXtgKLprWy2', 'ADMIN')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, password_hash, role)
VALUES 
('guardia', '$2a$10$dE2IFWo4tTB6M3tljXUxHuPH9wvi2tW2eqfdTwkGkWcXtgKLprWy2', 'GUARDIA')
ON CONFLICT (username) DO NOTHING;
