import React, { useState, useEffect } from 'react';
import { useStore, pairMechanicLogs } from '../store/useStore';
import { Wrench, ArrowRight, CheckCircle, AlertCircle, Clock, LogOut, Calendar, User } from 'lucide-react';
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

  const [salidaClient, setSalidaClient] = useState('');
  const [documentNro, setDocumentNro] = useState('');

  // Cargar logs del día
  const loadLogs = async () => {
    try {
      const res = await apiClient.get('/mechanic/log');
      const paired = pairMechanicLogs(res.data || []);
      const today = new Date().toDateString();
      setTodayLogs(paired.filter(l => new Date(l.timestamp).toDateString() === today));
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
      await apiClient.post('/mechanic/entrada', {
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
    if (!salidaClient) return;

    setLoading(true);
    try {
      await apiClient.post('/mechanic/salida', { 
        client_name: salidaClient,
        document_nro: documentNro
      });
      setSuccess(`Egreso registrado para cliente ${salidaClient}`);
      setSalidaClient('');
      setDocumentNro('');
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

      {/* Formularios */}
      {mode === 'entrada' ? (
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
      ) : (
        <form onSubmit={handleSalida} className="bg-brand-card rounded-2xl border border-brand-border shadow-sm p-5 flex flex-col gap-4">
          <h3 className="text-brand-text font-bold text-base">Registrar Egreso de Moto</h3>
          <p className="text-brand-muted text-sm">Ingresá el nombre o apellido del cliente que retira el servicio.</p>
          <div>
            <label className="block text-brand-muted text-xs font-semibold mb-1.5 uppercase tracking-wide">Cliente *</label>
            <input
              type="text"
              required
              placeholder="Nombre del cliente..."
              value={salidaClient}
              onChange={(e) => setSalidaClient(e.target.value)}
              className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text font-semibold text-lg"
            />
          </div>
          <div>
            <label className="block text-brand-muted text-xs font-semibold mb-1.5 uppercase tracking-wide">Factura / Remito Nro</label>
            <input
              type="text"
              placeholder="Nro de comprobante..."
              value={documentNro}
              onChange={(e) => setDocumentNro(e.target.value)}
              className="w-full px-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text font-bold"
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
        <div className="flex flex-col gap-3">
          <h3 className="text-brand-text font-black text-xs uppercase tracking-widest flex items-center gap-2 px-1">
            <Clock className="w-4 h-4 text-brand-primary" />
            Movimientos de hoy
          </h3>
          {todayLogs.map((log) => {
            const entryDate = new Date(log.timestamp);
            const exitDate = log.exit_timestamp ? new Date(log.exit_timestamp) : null;
            
            return (
              <div key={log.id || log.timestamp} className="bg-brand-card p-4 rounded-2xl border border-brand-border shadow-sm flex flex-col gap-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-lg">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-mono font-bold text-brand-text text-lg tracking-widest uppercase leading-none">{log.plate}</p>
                      <p className="text-brand-muted text-[10px] font-bold uppercase opacity-80 mt-1">{log.brand} {log.model}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black shadow-sm ${
                    exitDate ? 'bg-slate-100 text-slate-500 border border-slate-200' : 'bg-brand-primary text-white'
                  }`}>
                    {exitDate ? 'COMPLETO' : 'EN TALLER'}
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 bg-brand-bg/50 p-2.5 rounded-xl border border-brand-border/30">
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 bg-brand-bg rounded-lg">
                      <User className="w-3 h-3 text-brand-muted" />
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-muted font-black uppercase block leading-none mb-1">Cliente</span>
                      <span className="text-sm font-bold text-brand-text leading-none">{log.client_name || 'N/C'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1 border-t border-brand-border/20">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-brand-primary font-black uppercase tracking-tighter">Ingreso</span>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-brand-text">
                        <Clock className="w-3 h-3 opacity-40" />
                        {entryDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {exitDate && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-brand-warning font-black uppercase tracking-tighter">Egreso</span>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-warning">
                          <Clock className="w-3 h-3 opacity-40" />
                          {exitDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )}
                  </div>

                  {log.document_nro && (
                    <div className="mt-2 pt-2 border-t border-brand-border/20 flex items-center justify-between">
                       <span className="text-[10px] text-brand-muted font-black uppercase">Factura / Remito</span>
                       <span className="text-xs font-bold text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded border border-brand-primary/10 tracking-widest">{log.document_nro}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
