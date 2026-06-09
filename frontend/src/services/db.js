import localforage from 'localforage';

// Inicializar stores de IndexedDB
const personsStore = localforage.createInstance({
  name: 'control-acceso',
  storeName: 'persons'
});

const vehiclesStore = localforage.createInstance({
  name: 'control-acceso',
  storeName: 'vehicles'
});

const accessLogsStore = localforage.createInstance({
  name: 'control-acceso',
  storeName: 'access_logs'
});

const vehicleAccessLogsStore = localforage.createInstance({
  name: 'control-acceso',
  storeName: 'vehicle_access_logs'
});

// Función utilitaria para generar UUID compatible
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback simple si no estamos en HTTPS
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const localDb = {
  // --- PERSONAS ---
  async getPersons() {
    const keys = await personsStore.keys();
    const persons = [];
    for (const key of keys) {
      const person = await personsStore.getItem(key);
      if (person) persons.push(person);
    }
    return persons;
  },

  async getPersonByDni(dni) {
    return await personsStore.getItem(dni);
  },

  async savePerson(person) {
    if (!person.dni) throw new Error('El DNI es requerido para guardar localmente.');
    // Asegurar estructura
    const normalized = {
      dni: person.dni.trim().toUpperCase(),
      first_name: person.first_name || person.firstName,
      last_name: person.last_name || person.lastName,
      gender: person.gender || 'N/A',
      birth_date: person.birth_date || person.birthDate || null,
      photo: person.photo || null,
      qr_data: person.qr_data || person.qrData || null,
      created_at: person.created_at || new Date().toISOString()
    };
    await personsStore.setItem(normalized.dni, normalized);
    return normalized;
  },

  async savePersonsBatch(personsArray) {
    for (const p of personsArray) {
      await this.savePerson(p);
    }
  },

  // --- VEHÍCULOS ---
  async getVehicles() {
    const keys = await vehiclesStore.keys();
    const vehicles = [];
    for (const key of keys) {
      const vehicle = await vehiclesStore.getItem(key);
      if (vehicle) vehicles.push(vehicle);
    }
    return vehicles;
  },

  async getVehicleByPlate(plate) {
    if (!plate) return null;
    const normalizedPlate = plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const vehicles = await this.getVehicles();
    return vehicles.find(v => v.plate.replace(/[^A-Z0-9]/g, '') === normalizedPlate) || null;
  },

  async saveVehicle(vehicle) {
    if (!vehicle.plate) throw new Error('La patente es requerida para guardar localmente.');
    const normalized = {
      plate: vehicle.plate.trim().toUpperCase(),
      driver_name: vehicle.driver_name || vehicle.driverName || null,
      driver_dni: vehicle.driver_dni || vehicle.driverDni || null,
      vehicle_type: vehicle.vehicle_type || vehicle.vehicleType || null,
      photo: vehicle.photo || null,
      created_at: vehicle.created_at || new Date().toISOString()
    };
    await vehiclesStore.setItem(normalized.plate, normalized);
    return normalized;
  },

  async saveVehiclesBatch(vehiclesArray) {
    for (const v of vehiclesArray) {
      await this.saveVehicle(v);
    }
  },

  // --- LOGS DE ACCESO (PERSONAS) ---
  async getAccessLogs() {
    const keys = await accessLogsStore.keys();
    const logs = [];
    for (const key of keys) {
      const log = await accessLogsStore.getItem(key);
      if (log) logs.push(log);
    }
    // Ordenar de más reciente a más antiguo
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  async saveAccessLog(log) {
    const uuid = log.uuid || generateUUID();
    const newLog = {
      uuid,
      dni: log.dni,
      person_id: log.person_id || log.personId || null,
      first_name: log.first_name || log.firstName || '',
      last_name: log.last_name || log.lastName || '',
      access_type: log.access_type || log.accessType, // 'ENTRADA' | 'SALIDA'
      plate: log.plate || null,
      origin: log.origin || null,
      destination: log.destination || null,
      visitor_type: log.visitor_type || 'CLIENTE',
      reason: log.reason || null,
      timestamp: log.timestamp || new Date().toISOString(),
      synced: log.synced !== undefined ? log.synced : false
    };
    await accessLogsStore.setItem(uuid, newLog);
    return newLog;
  },

  async getUnsyncedAccessLogs() {
    const logs = await this.getAccessLogs();
    return logs.filter(l => !l.synced);
  },

  async markAccessLogsAsSynced(uuids) {
    for (const uuid of uuids) {
      const log = await accessLogsStore.getItem(uuid);
      if (log) {
        log.synced = true;
        await accessLogsStore.setItem(uuid, log);
      }
    }
  },

  // --- LOGS DE VEHÍCULOS ---
  async getVehicleAccessLogs() {
    const keys = await vehicleAccessLogsStore.keys();
    const logs = [];
    for (const key of keys) {
      const log = await vehicleAccessLogsStore.getItem(key);
      if (log) logs.push(log);
    }
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  async saveVehicleAccessLog(log) {
    const uuid = log.uuid || generateUUID();
    const newLog = {
      uuid,
      plate: log.plate.toUpperCase(),
      vehicle_id: log.vehicle_id || log.vehicleId || null,
      driver_name: log.driver_name || log.driverName || '',
      driver_dni: log.driver_dni || log.driverDni || '',
      vehicle_type: log.vehicle_type || log.vehicleType || '',
      access_type: log.access_type || log.accessType, // 'ENTRADA' | 'SALIDA'
      timestamp: log.timestamp || new Date().toISOString(),
      synced: log.synced !== undefined ? log.synced : false
    };
    await vehicleAccessLogsStore.setItem(uuid, newLog);
    return newLog;
  },

  async getUnsyncedVehicleAccessLogs() {
    const logs = await this.getVehicleAccessLogs();
    return logs.filter(l => !l.synced);
  },

  async markVehicleAccessLogsAsSynced(uuids) {
    for (const uuid of uuids) {
      const log = await vehicleAccessLogsStore.getItem(uuid);
      if (log) {
        log.synced = true;
        await vehicleAccessLogsStore.setItem(uuid, log);
      }
    }
  },

  // Limpiar todos los stores
  async clearAll() {
    await Promise.all([
      personsStore.clear(),
      vehiclesStore.clear(),
      accessLogsStore.clear(),
      vehicleAccessLogsStore.clear()
    ]);
  }
};
