import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Search, Download, Calendar, Clock, Filter, User, Car, ArrowUpRight, ArrowDownLeft, LogOut, MapPin, Building2 } from 'lucide-react';

export default function AccessLog() {
  const { logs, registerPersonAccess, registerVehicleAccess } = useStore();
  
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'ENTRADA' | 'SALIDA'
  const [filterCategory, setFilterCategory] = useState('ALL'); // 'ALL' | 'person' | 'vehicle'

  // Filtrar logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = (
      log.title?.toLowerCase().includes(search.toLowerCase()) ||
      log.subtitle?.toLowerCase().includes(search.toLowerCase()) ||
      log.plate?.toLowerCase().includes(search.toLowerCase()) ||
      log.reason?.toLowerCase().includes(search.toLowerCase()) ||
      log.origin?.toLowerCase().includes(search.toLowerCase())
    );
    const matchesType = filterType === 'ALL' || log.access_type === filterType;
    const matchesCategory = filterCategory === 'ALL' || log.type === filterCategory;
    
    return matchesSearch && matchesType && matchesCategory;
  });

  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;
    
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Identificación', 'Detalle', 'Patente', 'Procedencia/Empresa', 'Destino', 'Motivo', 'Guardia'];
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString('es-AR'),
      log.access_type,
      log.visitor_type || (log.type === 'person' ? 'CLIENTE' : 'VEHÍCULO'),
      log.title,
      log.subtitle,
      log.plate || '',
      log.origin || '',
      log.destination || '',
      log.reason || '',
      log.guard_name || 'Autoservicio'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers, ...rows].map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `log_accesos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros y Buscador */}
      <div className="bg-brand-card p-5 rounded-2xl border border-brand-border shadow-sm flex flex-col gap-4">
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre, DNI, patente o empresa..."
            className="w-full pl-12 pr-4 py-3.5 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Filtro Movimiento */}
          <div className="flex bg-brand-bg p-1 rounded-xl border border-brand-border overflow-hidden">
            {['ALL', 'ENTRADA', 'SALIDA'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  filterType === t ? 'bg-brand-primary text-white shadow-sm' : 'text-brand-muted hover:text-brand-text'
                }`}
              >
                {t === 'ALL' ? 'TODOS' : t}
              </button>
            ))}
          </div>

          {/* Filtro Categoría */}
          <div className="flex bg-brand-bg p-1 rounded-xl border border-brand-border overflow-hidden">
            <button
              onClick={() => setFilterCategory('ALL')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                filterCategory === 'ALL' ? 'bg-brand-primary text-white shadow-sm' : 'text-brand-muted'
              }`}
            >
              TODOS
            </button>
            <button
              onClick={() => setFilterCategory('person')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                filterCategory === 'person' ? 'bg-brand-primary text-white shadow-sm' : 'text-brand-muted'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              PERSONAS
            </button>
            <button
              onClick={() => setFilterCategory('vehicle')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                filterCategory === 'vehicle' ? 'bg-brand-primary text-white shadow-sm' : 'text-brand-muted'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              VEHÍCULOS
            </button>
          </div>

          <button
            onClick={exportToCSV}
            className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl border border-brand-primary/20 hover:bg-brand-primary/20 transition flex items-center gap-2 ml-auto"
            title="Exportar CSV"
          >
            <Download className="w-5 h-5" />
            <span className="text-xs font-bold uppercase">Exportar</span>
          </button>
        </div>
      </div>

      {/* Listado de Logs */}
      <div className="flex flex-col gap-3">
        {filteredLogs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-brand-muted gap-2 bg-brand-card/50 rounded-3xl border-2 border-dashed border-brand-border">
            <Filter className="w-8 h-8 opacity-20" />
            <p className="font-bold">No se encontraron registros</p>
          </div>
        ) : (
          filteredLogs.map(log => {
            const date = new Date(log.timestamp);
            const isPerson = log.type === 'person';
            const isEntrada = log.access_type === 'ENTRADA';

            const handleQuickExit = async () => {
              const meta = {
                origin: log.origin,
                destination: log.destination,
                visitor_type: log.visitor_type,
                reason: log.reason,
                plate: log.plate
              };

              if (isPerson) {
                await registerPersonAccess(log.dni, 'SALIDA', {
                  ...meta,
                  personId: log.person_id
                });
              } else {
                await registerVehicleAccess(log.plate, 'SALIDA', {
                  ...meta,
                  vehicleId: log.vehicle_id
                });
              }
            };
            
            return (
              <div
                key={log.uuid || log.id}
                className="bg-brand-card p-4 rounded-2xl border border-brand-border flex items-center justify-between shadow-sm relative overflow-hidden"
              >
                {/* Indicador de Sincronización en segundo plano */}
                {!log.synced && (
                  <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-brand-warning rounded-bl-md" title="Pendiente de sincronizar" />
                )}

                <div className="flex items-center gap-3">
                  {/* Icono de Categoría */}
                  <div className={`p-2.5 rounded-lg ${
                    isPerson ? 'bg-blue-500/10 text-brand-primary' : 'bg-purple-500/10 text-purple-400'
                  }`}>
                    {isPerson ? <User className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                  </div>

                  <div className="flex flex-col">
                    <span className="text-brand-text font-bold text-base tracking-wide leading-tight">{log.title}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-brand-muted text-sm font-medium">{log.subtitle}</span>
                      {log.visitor_type && log.type === 'person' && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          log.visitor_type === 'PROVEEDOR' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {log.visitor_type}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                      {log.origin && (
                        <div className="flex items-center gap-1.5 text-[11px] text-brand-muted font-bold bg-brand-bg px-2 py-0.5 rounded-lg border border-brand-border/40 uppercase">
                          <Building2 className="w-3 h-3 text-brand-primary" />
                          <span className="opacity-70">De:</span> {log.origin}
                        </div>
                      )}
                      {log.destination && (
                        <div className="flex items-center gap-1.5 text-[11px] text-brand-muted font-bold bg-brand-bg px-2 py-0.5 rounded-lg border border-brand-border/40 uppercase">
                          <MapPin className="w-3 h-3 text-brand-success" />
                          <span className="opacity-70">A:</span> {log.destination}
                        </div>
                      )}
                    </div>

                    {log.reason && (
                      <p className="text-[11px] text-brand-muted mt-2 italic border-l-2 border-brand-border pl-2 border-dashed">
                        Motivo: {log.reason}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-brand-muted flex items-center gap-1 font-bold bg-brand-bg px-2 py-0.5 rounded-lg border border-brand-border/40 uppercase tracking-tight">
                        <Calendar className="w-3 h-3" />
                        {date.toLocaleDateString('es-AR')}
                      </span>
                      <span className="text-[11px] text-brand-muted flex items-center gap-1 font-bold bg-brand-bg px-2 py-0.5 rounded-lg border border-brand-border/40 uppercase tracking-tight">
                        <Clock className="w-3 h-3" />
                        {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2.5 min-w-[100px]">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs shadow-sm w-full justify-center ${
                    isEntrada ? 'bg-brand-success text-white' : 'bg-brand-warning text-white'
                  }`}>
                    {isEntrada ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    {log.access_type}
                  </div>

                  {isEntrada && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickExit();
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl font-bold text-[10px] transition group w-full justify-center border border-brand-primary/20 shadow-sm"
                    >
                      <LogOut className="w-3.5 h-3.5 group-hover:scale-110 transition" />
                      SALIDA RÁPIDA
                    </button>
                  )}

                  {log.guard_name && (
                    <span className="text-[9px] text-brand-muted font-bold uppercase truncate max-w-[100px]">
                      Puesto: {log.guard_name}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
