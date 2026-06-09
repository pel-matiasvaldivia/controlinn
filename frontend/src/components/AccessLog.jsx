import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Search, Download, Calendar, Clock, Filter, User, Car, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function AccessLog() {
  const { logs } = useStore();
  
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'ENTRADA' | 'SALIDA'
  const [filterCategory, setFilterCategory] = useState('ALL'); // 'ALL' | 'person' | 'vehicle'

  // Filtrar logs
  const filteredLogs = logs.filter(log => {
    // Filtro búsqueda texto
    const text = search.toLowerCase();
    const titleMatch = log.title?.toLowerCase().includes(text);
    const subtitleMatch = log.subtitle?.toLowerCase().includes(text);
    const dniMatch = log.dni?.toLowerCase().includes(text);
    const plateMatch = log.plate?.toLowerCase().includes(text);
    const driverMatch = log.driver_name?.toLowerCase().includes(text);
    
    const matchesSearch = !search || titleMatch || subtitleMatch || dniMatch || plateMatch || driverMatch;
    
    // Filtro entrada/salida
    const matchesType = filterType === 'ALL' || log.access_type === filterType;
    
    // Filtro categoría (Persona/Vehículo)
    const matchesCategory = filterCategory === 'ALL' || log.type === filterCategory;

    return matchesSearch && matchesType && matchesCategory;
  });

  // Exportar a CSV (100% offline-compatible)
  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No hay registros para exportar.');
      return;
    }

    const headers = ['Tipo Categoria', 'Nombre/Patente', 'Detalles', 'Movimiento', 'Fecha y Hora', 'Sincronizado'];
    
    const rows = filteredLogs.map(log => [
      log.type === 'person' ? 'PERSONA' : 'VEHICULO',
      log.title,
      log.subtitle,
      log.access_type,
      new Date(log.timestamp).toLocaleString('es-AR'),
      log.synced ? 'SI' : 'NO'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Crear blob y disparar descarga
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM UTF-8 para Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reporte_accesos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-4">
      
      {/* Controles de Búsqueda y Filtros */}
      <div className="bg-brand-card p-4 rounded-2xl border border-brand-border flex flex-col gap-3 shadow-lg">
        
        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="absolute left-4 top-4 w-5 h-5 text-brand-muted" />
          <input
            type="text"
            className="w-full pl-12 pr-4 py-3.5 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text text-base"
            placeholder="Buscar por DNI, patente, nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* selectores de filtro */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="text-brand-muted font-bold mb-1.5 block uppercase text-[10px] tracking-wider">Categoría</label>
            <select
              className="w-full px-3 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text text-sm font-medium"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="ALL">Todos</option>
              <option value="person">Personas</option>
              <option value="vehicle">Vehículos</option>
            </select>
          </div>
          <div>
            <label className="text-brand-muted font-bold mb-1.5 block uppercase text-[10px] tracking-wider">Tránsito</label>
            <select
              className="w-full px-3 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text text-sm font-medium"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="ALL">Todos</option>
              <option value="ENTRADA">Entradas</option>
              <option value="SALIDA">Salidas</option>
            </select>
          </div>
        </div>

        {/* Botón Exportar */}
        <button
          onClick={exportToCSV}
          className="w-full py-3.5 bg-brand-bg hover:bg-slate-100 active:scale-[0.98] text-brand-text font-bold rounded-xl flex items-center justify-center gap-2 text-sm border border-brand-border transition shadow-sm"
        >
          <Download className="w-5 h-5 text-brand-primary" />
          <span>DESCARGAR REPORTE (CSV)</span>
        </button>
      </div>

      {/* Lista de Registros */}
      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between items-center px-1">
          <span className="text-sm text-brand-muted font-bold uppercase tracking-widest">Historial</span>
          <span className="text-sm text-brand-muted font-semibold bg-brand-bg px-3 py-1 rounded-full border border-brand-border">{filteredLogs.length}</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="bg-brand-card py-16 text-center rounded-2xl border border-brand-border text-brand-muted text-base font-medium">
            No se encontraron movimientos registrados.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredLogs.map(log => {
              const isEntrada = log.access_type === 'ENTRADA';
              const isPerson = log.type === 'person';
              const date = new Date(log.timestamp);
              
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
                      <span className="text-brand-muted text-sm mt-0.5 font-medium">{log.subtitle}</span>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[11px] text-brand-muted flex items-center gap-1 font-bold bg-brand-bg px-2 py-0.5 rounded-lg border border-brand-border/40 uppercase tracking-tight">
                          <Calendar className="w-3 h-3" />
                          {date.toLocaleDateString('es-AR')}
                        </span>
                        <span className="text-[11px] text-brand-muted flex items-center gap-1 font-bold bg-brand-bg px-2 py-0.5 rounded-lg border border-brand-border/40">
                          <Clock className="absolute invisible" /> {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sentido de Tránsito */}
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      isEntrada 
                        ? 'bg-brand-success/10 text-brand-success border border-brand-success/20' 
                        : 'bg-brand-warning/10 text-brand-warning border border-brand-warning/20'
                    }`}>
                      {isEntrada ? (
                        <>
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          <span>ENTRADA</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>SALIDA</span>
                        </>
                      )}
                    </span>
                    {!log.synced && (
                      <span className="text-[9px] text-brand-warning font-semibold tracking-wider">OFFLINE</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
