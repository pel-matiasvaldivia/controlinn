import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import apiClient from '../services/apiClient';
import { 
  Search, 
  User, 
  Car, 
  Wrench, 
  Filter, 
  Printer, 
  ArrowRightLeft,
  MapPin,
  Tag,
  Clock,
  LayoutGrid,
  ClipboardList
} from 'lucide-react';

export default function Reports() {
  const { sectors, loadSectors } = useStore();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({
    dni: '',
    name: '',
    plate: '',
    sector: '',
    visitor_type: '',
    date_from: today,
    date_to: today
  });

  useEffect(() => {
    loadSectors();
    fetchStats();
    handleSearch();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await apiClient.get('/reports/summary');
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
      
      const res = await apiClient.get(`/reports?${queryParams.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getBadgeColor = (type) => {
    switch (type) {
      case 'PERSONA': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'VEHICULO': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'MECANICO': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatTime = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-24">
      {/* STATS SUMMARY */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
          <StatCard icon={<User />} label="Personas" value={stats.persons} color="text-blue-600" />
          <StatCard icon={<Car />} label="Vehículos" value={stats.vehicles} color="text-purple-600" />
          <StatCard icon={<Wrench />} label="Mecánica" value={stats.mechanic} color="text-amber-600" />
          <StatCard icon={<LayoutGrid />} label="Total Hoy" value={stats.total} color="text-brand-primary" />
        </div>
      )}

      {/* FILTERS CARD */}
      <div className="bg-brand-card rounded-2xl border border-brand-border/60 shadow-sm p-4 print:hidden">
        <div className="flex items-center gap-2 mb-4 border-b border-brand-border/30 pb-2">
          <Filter className="w-4 h-4 text-brand-primary" />
          <h2 className="text-sm font-bold text-brand-text">Filtros de Reporte</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputGroup label="DNI" name="dni" value={filters.dni} onChange={v => setFilters({...filters, dni: v})} icon={<Search className="w-4 h-4" />} placeholder="Buscar por DNI..." />
          <InputGroup label="Nombre/Apellido" name="name" value={filters.name} onChange={v => setFilters({...filters, name: v})} icon={<User className="w-4 h-4" />} placeholder="Buscar por nombre..." />
          <InputGroup label="Patente" name="plate" value={filters.plate} onChange={v => setFilters({...filters, plate: v})} icon={<Tag className="w-4 h-4" />} placeholder="Ej: ABC 123" />
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Sector Destino</label>
            <select 
              value={filters.sector} 
              onChange={e => setFilters({...filters, sector: e.target.value})}
              className="w-full bg-brand-bg/50 border border-brand-border/60 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition appearance-none"
            >
              <option value="">Cualquier Sector</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Tipo Visitante</label>
            <select 
              value={filters.visitor_type} 
              onChange={e => setFilters({...filters, visitor_type: e.target.value})}
              className="w-full bg-brand-bg/50 border border-brand-border/60 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition appearance-none"
            >
              <option value="">Cualquier Tipo</option>
              <option value="CLIENTE">Cliente</option>
              <option value="PROVEEDOR">Proveedor</option>
              <option value="EMPLEADO">Empleado</option>
              <option value="VISITA">Visita Particular</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Desde</label>
              <input type="date" value={filters.date_from} onChange={e => setFilters({...filters, date_from: e.target.value})} className="w-full bg-brand-bg/50 border border-brand-border/60 rounded-xl px-2 py-2 text-xs outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Hasta</label>
              <input type="date" value={filters.date_to} onChange={e => setFilters({...filters, date_to: e.target.value})} className="w-full bg-brand-bg/50 border border-brand-border/60 rounded-xl px-2 py-2 text-xs outline-none" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button 
            onClick={handleSearch} 
            disabled={loading}
            className="flex-1 bg-brand-primary text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-brand-primary/20 hover:bg-brand-primary/90 transition touch-feedback"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Filtrar</span>
          </button>

          <button 
            onClick={handlePrint}
            className="px-4 bg-brand-bg border border-brand-border/60 text-brand-text rounded-xl flex items-center justify-center hover:bg-brand-border/20 transition touch-feedback"
            title="Imprimir"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RESULTS TABLE */}
      <div className="bg-brand-card rounded-2xl border border-brand-border/60 shadow-sm overflow-hidden min-h-[300px]">
        <div className="flex items-center justify-between p-4 border-b border-brand-border/30 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-brand-muted" />
            <h3 className="text-sm font-bold text-brand-text">Registros</h3>
          </div>
          <span className="bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider">
            {data.length} RESULTADOS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-brand-bg/50 text-[10px] uppercase font-bold tracking-tight text-brand-muted">
                <th className="px-4 py-3 border-b border-brand-border/30">Fecha / Hora</th>
                <th className="px-4 py-3 border-b border-brand-border/30">Tipo / Acción</th>
                <th className="px-4 py-3 border-b border-brand-border/30">Identificador / Nombre</th>
                <th className="px-4 py-3 border-b border-brand-border/30">Patente</th>
                <th className="px-4 py-3 border-b border-brand-border/30">Destino</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/20">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-brand-primary/10 border-t-brand-primary rounded-full animate-spin" />
                      <span className="text-sm text-brand-muted font-medium">Cargando datos...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <Search className="w-12 h-12 text-brand-muted" />
                      <span className="text-sm font-medium">Sin resultados</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={`${row.log_type}-${row.id}-${Math.random()}`} className="hover:bg-brand-bg/10 transition text-[13px]">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-brand-text">{formatDate(row.timestamp)}</span>
                        <span className="text-[10px] text-brand-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(row.timestamp)} hs
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`w-fit px-1.5 py-0.5 rounded border text-[9px] font-bold ${getBadgeColor(row.log_type)}`}>
                          {row.log_type}
                        </span>
                        <span className={`flex items-center gap-1 font-bold text-[10px] ${row.access_type === 'ENTRADA' ? 'text-brand-success' : 'text-brand-danger'}`}>
                          <ArrowRightLeft className={`w-3 h-3 ${row.access_type === 'SALIDA' ? 'rotate-180' : ''}`} />
                          {row.access_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-brand-text leading-tight">{row.name || 'N/C'}</span>
                        <span className="text-[11px] text-brand-muted font-medium">{row.identifier}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.plate ? (
                        <span className="bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-mono font-bold shadow-sm inline-block">
                          {row.plate}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-brand-muted">
                        <MapPin className="w-3 h-3 text-brand-primary" />
                        <span className="text-[11px] font-semibold">{row.destination || '-'}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .pb-24 { padding-bottom: 0 !important; }
          .min-h-[300px] { min-h: 0 !important; }
          .bg-brand-card { border: none !important; box-shadow: none !important; }
          th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
          .rounded-2xl { border-radius: 0 !important; }
        }
      `}} />
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-brand-card p-3 rounded-2xl border border-brand-border/50 shadow-sm flex items-center gap-3">
      <div className={`p-2 rounded-xl bg-slate-50 border border-brand-border/30 ${color}`}>
        {React.cloneElement(icon, { size: 18 })}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-brand-muted uppercase tracking-tight line-clamp-1">{label}</span>
        <span className="text-base font-black text-brand-text leading-none">{value}</span>
      </div>
    </div>
  );
}

function InputGroup({ label, name, value, onChange, icon, placeholder }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider pl-1">{label}</label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted/70">
          {icon}
        </div>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-brand-bg/50 border border-brand-border/60 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none transition placeholder:text-brand-muted/40"
        />
      </div>
    </div>
  );
}
