import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Wrench, ArrowRight, CheckCircle, AlertCircle, Clock, LogOut } from 'lucide-react';
import apiClient from '../services/apiClient';

export default function MechanicService() {
  const { online, error, setError, successMsg, setSuccess, clearMessages } = useStore();

  const [mode, setMode] = useState('entrada'); // 'entrada' | 'salida'
  const [loading, setLoading] = useState(false);
  const [todayLogs, setTodayLogs] = useState([]);

  const [entradaForm, setEntradaForm] = useState({
    plate: '',
    brand: '',
    model: '',
    client_name: ''
  });

  const [salidaPlate, setSalidaPlate] = useState('');

  // Cargar logs del día
  const loadLogs = async () => {
    try {
      const res = await apiClient.get('/mechanic/log');
      const today = new Date().toDateString();
      setTodayLogs(res.data.filter(l => new Date(l.timestamp).toDateString() === today));
    } catch (e) {
      console.warn('[MECHANIC] No se pudo cargar el historial.');
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleEntrada = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!entradaForm.plate) return;

    setLoading(true);
    try {
      const res = await apiClient.post('/mechanic/entrada', {
        ...entradaForm,
        plate: entradaForm.plate.toUpperCase()
      });
      setSuccess(`Ingreso registrado para ${entradaForm.brand || ''} ${entradaForm.model || ''} — ${entradaForm.plate.toUpperCase()}`);
      setEntradaForm({ plate: '', brand: '', model: '', client_name: '' });
      await loadLogs();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el ingreso.');
    } finally {
      setLoading(false);
    }
  };

  const handleSalida = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!salidaPlate) return;

    setLoading(true);
    try {
      await apiClient.post('/mechanic/salida', { plate: salidaPlate.toUpperCase() });
      setSuccess(`Egreso registrado para patente ${salidaPlate.toUpperCase()}`);
      setSalidaPlate('');
      await loadLogs();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el egreso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl border border-brand-primary/20">
          <Wrench className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-brand-text font-bold text-lg">Servicio Mecánico</h2>
          <p className="text-brand-muted text-sm">Registro de motos agendadas</p>
        </div>
      </div>

      {/* Toggle Entrada / Salida */}
      <div className="flex gap-2 p-1.5 bg-brand-border/30 rounded-2xl">
        <button
          onClick={() => { setMode('entrada'); clearMessages(); }}
          className={`flex-1 py-2.5 font-semibold rounded-xl text-sm transition ${
            mode === 'entrada'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-brand-muted hover:text-brand-text'
          }`}
        >
          INGRESO
        </button>
        <button
          onClick={() => { setMode('salida'); clearMessages(); }}
          className={`flex-1 py-2.5 font-semibold rounded-xl text-sm transition ${
            mode === 'salida'
              ? 'bg-brand-warning text-white shadow-sm'
              : 'text-brand-muted hover:text-brand-text'
          }`}
        >
          EGRESO
        </button>
      </div>

      {/* Formulario Entrada */}
      {mode === 'entrada' && (
        <form onSubmit={handleEntrada} className="bg-brand-card rounded-2xl border border-brand-border shadow-sm p-5 flex flex-col gap-4">
          <h3 className="text-brand-text font-bold text-base">Registrar Ingreso de Moto</h3>

          <div>
            <label className="block text-brand-muted text-xs font-semibold mb-1.5 uppercase tracking-wide">Patente *</label>
            <input
              type="text"
              required
              placeholder="Ej: AB 123 CD"
              value={entradaForm.plate}
              onChange={(e) => setEntradaForm({ ...entradaForm, plate: e.target.value.toUpperCase() })}
              className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text font-mono text-lg tracking-widest uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-brand-muted text-xs font-semibold mb-1.5 uppercase tracking-wide">Marca</label>
              <input
                type="text"
                placeholder="Honda, Yamaha..."
                value={entradaForm.brand}
                onChange={(e) => setEntradaForm({ ...entradaForm, brand: e.target.value })}
                className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text"
              />
            </div>
            <div>
              <label className="block text-brand-muted text-xs font-semibold mb-1.5 uppercase tracking-wide">Modelo</label>
              <input
                type="text"
                placeholder="CBR, Titan..."
                value={entradaForm.model}
                onChange={(e) => setEntradaForm({ ...entradaForm, model: e.target.value })}
                className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text"
              />
            </div>
          </div>

          <div>
            <label className="block text-brand-muted text-xs font-semibold mb-1.5 uppercase tracking-wide">Cliente</label>
            <input
              type="text"
              placeholder="Nombre del cliente"
              value={entradaForm.client_name}
              onChange={(e) => setEntradaForm({ ...entradaForm, client_name: e.target.value })}
              className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-brand-primary hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-base rounded-xl flex items-center justify-center gap-2 transition"
          >
            <span>{loading ? 'Registrando...' : 'REGISTRAR INGRESO'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      )}

      {/* Formulario Salida */}
      {mode === 'salida' && (
        <form onSubmit={handleSalida} className="bg-brand-card rounded-2xl border border-brand-border shadow-sm p-5 flex flex-col gap-4">
          <h3 className="text-brand-text font-bold text-base">Registrar Egreso de Moto</h3>
          <p className="text-brand-muted text-sm">Ingresá la patente de la moto que retira el servicio.</p>

          <div>
            <label className="block text-brand-muted text-xs font-semibold mb-1.5 uppercase tracking-wide">Patente *</label>
            <input
              type="text"
              required
              placeholder="Ej: AB 123 CD"
              value={salidaPlate}
              onChange={(e) => setSalidaPlate(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text font-mono text-lg tracking-widest uppercase"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-brand-warning hover:bg-amber-600 disabled:opacity-60 text-white font-bold text-base rounded-xl flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-5 h-5" />
            <span>{loading ? 'Registrando...' : 'REGISTRAR EGRESO'}</span>
          </button>
        </form>
      )}

      {/* Feedback */}
      {error && (
        <div className="p-4 bg-brand-danger/10 border border-brand-danger/30 rounded-xl text-brand-danger flex items-center gap-3 text-sm font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-brand-success/10 border border-brand-success/30 rounded-xl text-brand-success flex items-center gap-3 text-sm font-medium">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Historial del día */}
      {todayLogs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-brand-text font-bold text-sm uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-muted" />
            Movimientos de hoy
          </h3>
          {todayLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between px-4 py-3 bg-brand-card border border-brand-border rounded-xl">
              <div>
                <p className="font-mono font-bold text-brand-text tracking-wider">{log.plate}</p>
                <p className="text-brand-muted text-xs">{log.brand} {log.model} · {log.client_name || 'Sin cliente'}</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                log.access_type === 'ENTRADA'
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'bg-brand-warning/10 text-brand-warning'
              }`}>
                {log.access_type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
