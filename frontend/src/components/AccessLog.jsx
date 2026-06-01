import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Search, Download, Calendar, Filter, User, Car, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

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
          <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" />
          <input
            type="text"
            className="w-full pl-11 pr-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white text-sm"
            placeholder="Buscar por DNI, patente, nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* selectores de filtro */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-slate-400 font-semibold mb-1 block">Categoría</label>
            <select
              className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-white"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="ALL">Personas y Vehículos</option>
              <option value="person">Solo Personas</option>
              <option value="vehicle">Solo Vehículos</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 font-semibold mb-1 block">Tránsito</label>
            <select
              className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-white"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="ALL">Cualquier Movimiento</option>
              <option value="ENTRADA">Entradas</option>
              <option value="SALIDA">Salidas</option>
            </select>
          </div>
        </div>

        {/* Botón Exportar */}
        <button
          onClick={exportToCSV}
          className="w-full py-3 bg-brand-border hover:bg-slate-700 active:scale-[0.98] text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm border border-brand-border transition"
        >
          <Download className="w-4 h-4" />
          <span>EXPORTAR TABLA (CSV)</span>
        </button>
      </div>

      {/* Lista de Registros */}
      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Historial de Accesos</span>
          <span className="text-xs text-slate-500 font-semibold">{filteredLogs.length} registros</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="bg-brand-card py-10 text-center rounded-2xl border border-brand-border/60 text-slate-500 text-sm">
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
                  className="bg-brand-card p-4 rounded-xl border border-brand-border/60 flex items-center justify-between shadow-sm relative overflow-hidden"
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
                      <span className="text-white font-bold text-sm tracking-wide leading-tight">{log.title}</span>
                      <span className="text-slate-400 text-xs mt-0.5">{log.subtitle}</span>
                      <span className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3" />
                        {date.toLocaleDateString('es-AR')} {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
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
