import { create } from 'zustand';
import apiClient from '../services/apiClient';
import { localDb } from '../services/db';

export const useStore = create((set, get) => ({
  // --- ESTADO ---
  user: JSON.parse(localStorage.getItem('user')) || null,
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  
  online: navigator.onLine,
  syncing: false,
  activeTab: 'personas', // 'personas' | 'vehiculos' | 'historial'
  
  persons: [],
  vehicles: [],
  logs: [], // Logs combinados de personas y vehículos
  sectors: [], // Sectores de destino configurables
  
  error: null,
  successMsg: null,

  // --- ACCIONES ---
  setTab: (tab) => {
    get().clearMessages();
    set({ activeTab: tab });
  },

  clearMessages: () => set({ error: null, successMsg: null }),
  setError: (msg) => set({ error: msg, successMsg: null }),
  setSuccess: (msg) => set({ successMsg: msg, error: null }),

  // Cargar sectores configurables desde la API
  loadSectors: async () => {
    try {
      const res = await apiClient.get('/settings/sectors');
      set({ sectors: res.data.sectors || [] });
    } catch (err) {
      // En modo offline cargar desde localStorage
      const cached = localStorage.getItem('sectors');
      if (cached) set({ sectors: JSON.parse(cached) });
      console.warn('[STORE] No se pudieron cargar los sectores del servidor.');
    }
  },

  // Guardar sectores configurables
  saveSectors: async (sectors) => {
    try {
      await apiClient.put('/settings/sectors', { sectors });
      localStorage.setItem('sectors', JSON.stringify(sectors));
      set({ sectors });
      return true;
    } catch (err) {
      console.error('[STORE] Error guardando sectores:', err);
      return false;
    }
  },
  
  setOnlineStatus: (status) => {
    const wasOffline = !get().online;
    set({ online: status });
    // Si pasamos de offline a online, gatillar sincronización
    if (wasOffline && status && get().user) {
      get().syncOfflineData();
    }
  },

  // Autenticación
  login: async (username, password) => {
    set({ error: null });
    try {
      const res = await apiClient.post('/auth/login', { username, password });
      const { accessToken, refreshToken, user } = res.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      set({ user, accessToken, refreshToken });
      
      // Cargar datos después del login
      await get().loadInitialData();
      await get().loadSectors();
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Error al conectar con el servidor.' });
      return false;
    }
  },

  logout: async () => {
    const { user } = get();
    try {
      if (user) {
        await apiClient.post('/auth/logout', { userId: user.id });
      }
    } catch (err) {
      console.warn('[STORE] Error enviando logout al servidor:', err.message);
    }
    
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    set({ user: null, accessToken: null, refreshToken: null, logs: [], persons: [], vehicles: [] });
  },

  // Carga de datos
  loadInitialData: async () => {
    const { online, user } = get();
    if (!user) return;

    try {
      // 1. Cargar desde IndexedDB (siempre cargamos local primero para velocidad)
      const localPersons = await localDb.getPersons();
      const localVehicles = await localDb.getVehicles();
      const localPeopleLogs = await localDb.getAccessLogs();
      const localVehicleLogs = await localDb.getVehicleAccessLogs();
      
      // Combinar logs
      const combinedLogs = combineAndSortLogs(localPeopleLogs, localVehicleLogs);
      set({ 
        persons: localPersons, 
        vehicles: localVehicles, 
        logs: combinedLogs 
      });

      // 2. Si está online, descargar la base de datos fresca del servidor y actualizar cache local
      if (online) {
        console.log('[STORE] Descargando datos del servidor...');
        const res = await apiClient.get('/sync/pull');
        const { persons, vehicles } = res.data;
        
        // Guardar en IndexedDB
        await localDb.savePersonsBatch(persons);
        await localDb.saveVehiclesBatch(vehicles);
        
        // Cargar logs actualizados del servidor
        const [peopleLogsRes, vehicleLogsRes] = await Promise.all([
          apiClient.get('/access/log'),
          apiClient.get('/vehicle-access/log')
        ]);

        // Guardar logs del servidor en IndexedDB local
        for (const log of peopleLogsRes.data) {
          await localDb.saveAccessLog({ ...log, synced: true });
        }
        for (const log of vehicleLogsRes.data) {
          await localDb.saveVehicleAccessLog({ ...log, synced: true });
        }

        const freshPeopleLogs = await localDb.getAccessLogs();
        const freshVehicleLogs = await localDb.getVehicleAccessLogs();
        
        set({
          persons: await localDb.getPersons(),
          vehicles: await localDb.getVehicles(),
          logs: combineAndSortLogs(freshPeopleLogs, freshVehicleLogs)
        });
      }
    } catch (err) {
      console.error('[STORE] Error cargando datos iniciales:', err);
    }
  },

  // REGISTRO DE ACCESO DE PERSONAS (Online u Offline)
  registerPersonAccess: async (dni, accessType, manualData = null) => {
    set({ error: null, successMsg: null });
    const { online, user } = get();
    const timestamp = new Date().toISOString();
    const uuid = `p-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      let person = null;

      // 1. Obtener/Crear persona
      if (online) {
        if (manualData && manualData.personId) {
          // Si ya tenemos el ID (ej: desde el historial), lo usamos directamente
          person = { id: manualData.personId, dni };
        } else if (manualData) {
          // Si viene data de escaneo QR o formulario manual para creación
          const isQr = manualData.qrData !== undefined;
          if (isQr) {
            const res = await apiClient.post('/persons/scan', { qrData: manualData.qrData });
            person = res.data.person;
          } else {
            const res = await apiClient.post('/persons', manualData);
            person = res.data;
          }
        } else {
          // Solo DNI directo: buscar si existe
          const res = await apiClient.get(`/persons/${dni}`);
          person = res.data;
        }

        // Registrar acceso online
        const route = accessType === 'ENTRADA' ? '/access/entrada' : '/access/salida';
        await apiClient.post(route, { 
          personId: person.id,
          plate: manualData?.plate || null,
          origin: manualData?.origin || null,
          destination: manualData?.destination || null,
          visitor_type: manualData?.visitor_type || 'CLIENTE',
          reason: manualData?.reason || null
        });

        // Guardar log sincronizado en IndexedDB y memoria
        const log = await localDb.saveAccessLog({
          uuid,
          dni: person.dni,
          person_id: person.id,
          first_name: person.first_name,
          last_name: person.last_name,
          access_type: accessType,
          plate: manualData?.plate || null,
          origin: manualData?.origin || null,
          destination: manualData?.destination || null,
          visitor_type: manualData?.visitor_type || 'CLIENTE',
          reason: manualData?.reason || null,
          timestamp,
          synced: true
        });

        // Guardar persona en cache local
        await localDb.savePerson(person);

        set(state => {
          const others = state.logs.filter(l => l.uuid !== uuid && l.type !== 'person');
          const currentPeople = state.logs.filter(l => l.uuid !== uuid && l.type === 'person');
          return {
            logs: combineAndSortLogs([log, ...currentPeople], others),
            successMsg: `${accessType === 'ENTRADA' ? 'Ingreso' : 'Egreso'} de ${person.first_name} ${person.last_name} registrado satisfactoriamente en la base de datos.`
          };
        });

      } else {
        // MODO OFFLINE
        console.log('[STORE] Modo Offline - Registrando localmente...');
        
        // Buscar persona en base local
        person = await localDb.getPersonByDni(dni);

        if (!person) {
          if (manualData) {
            // Registrar persona localmente desde los datos provistos
            person = await localDb.savePerson({
              dni,
              first_name: manualData.first_name || manualData.firstName,
              last_name: manualData.last_name || manualData.lastName,
              gender: manualData.gender,
              birth_date: manualData.birth_date || manualData.birthDate,
              photo: manualData.photo || null
            });
          } else {
            throw new Error('Persona no registrada localmente. Ingrese los datos manualmente.');
          }
        }

        // Registrar log offline
        const log = await localDb.saveAccessLog({
          uuid,
          dni: person.dni,
          first_name: person.first_name,
          last_name: person.last_name,
          access_type: accessType,
          plate: manualData?.plate || null,
          origin: manualData?.origin || null,
          destination: manualData?.destination || null,
          visitor_type: manualData?.visitor_type || 'CLIENTE',
          reason: manualData?.reason || null,
          timestamp,
          synced: false
        });

        set(state => {
          const others = state.logs.filter(l => l.uuid !== uuid && l.type !== 'person');
          const currentPeople = state.logs.filter(l => l.uuid !== uuid && l.type === 'person');
          return {
            logs: combineAndSortLogs([log, ...currentPeople], others),
            successMsg: `[OFFLINE] ${accessType === 'ENTRADA' ? 'Ingreso' : 'Egreso'} registrado localmente.`
          };
        });
      }
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || err.message || 'Error registrando acceso.' });
      return false;
    }
  },

  // REGISTRO DE ACCESO DE VEHÍCULOS (Online u Offline)
  registerVehicleAccess: async (plate, accessType, manualData = null) => {
    set({ error: null, successMsg: null });
    const { online } = get();
    const timestamp = new Date().toISOString();
    const uuid = `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const normalizedPlate = plate.trim().toUpperCase();

    try {
      let vehicle = null;

      if (online) {
        if (manualData && manualData.vehicleId) {
          // Si ya tenemos el ID, lo usamos directamente
          vehicle = { id: manualData.vehicleId, plate: normalizedPlate };
        } else {
          // 1. Obtener o crear vehículo en backend
          const resVeh = await apiClient.post('/vehicles', {
            plate: normalizedPlate,
            driver_name: manualData?.driver_name,
            driver_dni: manualData?.driver_dni,
            vehicle_type: manualData?.vehicle_type,
            photo: manualData?.photo
          });
          vehicle = resVeh.data;
        }

        // 2. Registrar acceso online
        const route = accessType === 'ENTRADA' ? '/vehicle-access/entrada' : '/vehicle-access/salida';
        await apiClient.post(route, { 
          vehicleId: vehicle.id,
          origin: manualData?.origin || null,
          destination: manualData?.destination || null
        });

        // Guardar log sincronizado en IndexedDB
        const log = await localDb.saveVehicleAccessLog({
          uuid,
          plate: vehicle.plate,
          vehicle_id: vehicle.id,
          driver_name: vehicle.driver_name,
          driver_dni: vehicle.driver_dni,
          vehicle_type: vehicle.vehicle_type,
          access_type: accessType,
          origin: manualData?.origin || null,
          destination: manualData?.destination || null,
          timestamp,
          synced: true
        });

        await localDb.saveVehicle(vehicle);

        set(state => {
          const others = state.logs.filter(l => l.uuid !== uuid && l.type !== 'vehicle');
          const currentVehicles = state.logs.filter(l => l.uuid !== uuid && l.type === 'vehicle');
          return {
            logs: combineAndSortLogs(others, [log, ...currentVehicles]),
            successMsg: `Vehículo ${vehicle.plate} registrado satisfactoriamente en la base de datos (${accessType === 'ENTRADA' ? 'Entrada' : 'Salida'}).`
          };
        });
      } else {
        // MODO OFFLINE
        console.log('[STORE] Modo Offline - Registrando vehículo localmente...');
        
        vehicle = await localDb.getVehicleByPlate(normalizedPlate);
        
        // Si no existe y tenemos datos manuales, lo creamos offline
        if (!vehicle) {
          vehicle = await localDb.saveVehicle({
            plate: normalizedPlate,
            driver_name: manualData?.driver_name || manualData?.driverName || 'DESCONOCIDO',
            driver_dni: manualData?.driver_dni || manualData?.driverDni || '',
            vehicle_type: manualData?.vehicle_type || manualData?.vehicleType || '',
            photo: manualData?.photo || null
          });
        }

        // Crear acceso vehicular offline
        const log = await localDb.saveVehicleAccessLog({
          uuid,
          plate: vehicle.plate,
          driver_name: vehicle.driver_name,
          driver_dni: vehicle.driver_dni,
          vehicle_type: vehicle.vehicle_type,
          access_type: accessType,
          timestamp,
          synced: false
        });

        set(state => {
          const others = state.logs.filter(l => l.uuid !== uuid && l.type !== 'vehicle');
          const currentVehicles = state.logs.filter(l => l.uuid !== uuid && l.type === 'vehicle');
          return {
            logs: combineAndSortLogs(others, [log, ...currentVehicles]),
            successMsg: `[OFFLINE] Vehículo ${vehicle.plate} guardado localmente (${accessType === 'ENTRADA' ? 'Entrada' : 'Salida'}).`
          };
        });
      }
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || err.message || 'Error registrando acceso vehicular.' });
      return false;
    }
  },

  // SINCRONIZACIÓN DE DATOS PENDIENTES
  syncOfflineData: async () => {
    const { syncing, online } = get();
    if (syncing || !online) return;

    set({ syncing: true });
    console.log('[SYNC] Iniciando sincronización de cola offline...');

    try {
      // 1. Obtener personas y vehículos creados localmente que podrían no estar en el server
      // (Dado que se guardan directamente en Persons/Vehicles, subiremos la lista entera de IndexedDB)
      const persons = await localDb.getPersons();
      const vehicles = await localDb.getVehicles();

      // 2. Obtener logs pendientes de sincronizar
      const unsyncedAccessLogs = await localDb.getUnsyncedAccessLogs();
      const unsyncedVehicleLogs = await localDb.getUnsyncedVehicleAccessLogs();

      if (unsyncedAccessLogs.length === 0 && unsyncedVehicleLogs.length === 0) {
        console.log('[SYNC] No hay registros pendientes de sincronizar.');
        set({ syncing: false });
        return;
      }

      // Enviar cambios al servidor
      const payload = {
        persons,
        vehicles,
        accessLogs: unsyncedAccessLogs,
        vehicleAccessLogs: unsyncedVehicleLogs
      };

      const res = await apiClient.post('/sync/push', payload);
      
      if (res.data.success || res.status === 200) {
        console.log('[SYNC] Datos subidos con éxito. Marcando localmente como sincronizado...');
        
        // Marcar logs locales como sincronizados
        const accessUuids = unsyncedAccessLogs.map(l => l.uuid);
        const vehicleUuids = unsyncedVehicleLogs.map(l => l.uuid);
        
        await localDb.markAccessLogsAsSynced(accessUuids);
        await localDb.markVehicleAccessLogsAsSynced(vehicleUuids);
        
        // Forzar recarga desde el servidor para unificar IDs
        await get().loadInitialData();
        console.log('[SYNC] Sincronización finalizada.');
      } else {
        console.warn('[SYNC] Servidor retornó errores en sincronización:', res.data.synced.errors);
      }
    } catch (err) {
      console.error('[SYNC] Error sincronizando datos:', err.message);
    } finally {
      set({ syncing: false });
    }
  }
}));

// --- FUNCIONES AUXILIARES ---

function combineAndSortLogs(peopleLogs = [], vehicleLogs = []) {
  // Estandarizar estructuras para mostrar en un historial unificado
  const cleanPeople = peopleLogs.map(l => ({
    ...l,
    type: 'person',
    title: `${l.last_name}, ${l.first_name}`,
    subtitle: `DNI: ${l.dni}`,
    badge: 'PERSONA'
  }));

  const cleanVehicles = vehicleLogs.map(l => ({
    ...l,
    type: 'vehicle',
    title: l.plate,
    subtitle: `Conductor: ${l.driver_name || 'N/C'}`,
    badge: 'VEHÍCULO'
  }));

  // Combinar y ordenar desc
  return [...cleanPeople, ...cleanVehicles].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
