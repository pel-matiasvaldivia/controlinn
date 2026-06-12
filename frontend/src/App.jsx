import React, { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import Login from './pages/Login';
import QRScanner from './components/QRScanner';
import RTSPViewer from './components/RTSPViewer';
import AccessLog from './components/AccessLog';
import Settings from './components/Settings';
import MechanicService from './components/MechanicService';
import Reports from './components/Reports';
import { User, Shield, Wifi, WifiOff, LogOut, ClipboardList, Car, RefreshCw, SlidersHorizontal, Wrench, BarChart3 } from 'lucide-react';


export default function App() {
  const { 
    user, 
    logout, 
    online, 
    setOnlineStatus, 
    syncing, 
    syncOfflineData, 
    loadInitialData, 
    activeTab, 
    setTab 
  } = useStore();


  // Escuchar cambios de conexión de red
  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Carga inicial
    if (user) {
      loadInitialData();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  // Si no está logueado, mostrar pantalla de Login
  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex-1 flex flex-col bg-brand-bg text-brand-text h-full relative">
      
      {/* HEADER */}
      <header className="bg-brand-card px-4 py-3 border-b border-brand-border flex items-center justify-between sticky top-0 z-20 shadow-sm">
        
        {/* Info Operador */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand-bg rounded-xl border border-brand-border/40 text-brand-primary">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-brand-text font-bold text-sm tracking-wide">ControlInn</span>
            <span className="text-xs text-brand-muted font-semibold tracking-wider uppercase flex items-center gap-1">
              <User className="w-3 h-3 text-brand-muted" />
              {user.username} ({user.role})
            </span>
          </div>
        </div>

        {/* Estado Conexión y Sync */}
        <div className="flex items-center gap-2">
          
          {/* Botón forzar sync si hay cambios */}
          {online && (
            <button
              onClick={syncOfflineData}
              disabled={syncing}
              className={`p-2 rounded-xl border border-brand-border/40 text-slate-400 bg-brand-bg hover:text-white transition ${
                syncing ? 'animate-spin text-brand-primary' : ''
              }`}
              title="Sincronizar datos"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Badge Online/Offline */}
          {online ? (
            <span className="px-2.5 py-1 bg-brand-success/15 border border-brand-success/30 text-brand-success rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1.5 shadow-sm">
              <Wifi className="w-3.5 h-3.5" />
              <span>ONLINE</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-brand-warning/15 border border-brand-warning/30 text-brand-warning rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1.5 shadow-sm">
              <WifiOff className="w-3.5 h-3.5" />
              <span>OFFLINE</span>
            </span>
          )}

          {/* Botón Logout */}
          <button
            onClick={logout}
            className="p-2 bg-brand-bg hover:bg-brand-border text-brand-muted hover:text-brand-danger border border-brand-border rounded-xl transition touch-feedback"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        <div className="max-w-7xl mx-auto h-full">
          {activeTab === 'personas' && (
            <div className="flex flex-col gap-4">
              <QRScanner />
            </div>
          )}
          {activeTab === 'vehiculos' && <RTSPViewer />}
          {activeTab === 'historial' && <AccessLog />}
          {activeTab === 'configuracion' && <Settings />}
          {activeTab === 'mecanica' && <MechanicService />}
          {activeTab === 'reportes' && <Reports />}

        </div>
      </main>


      {/* BARRA DE NAVEGACIÓN MÓVIL */}
      <nav className="bg-brand-card border-t border-brand-border py-2 px-3 flex justify-around items-center fixed bottom-0 left-0 right-0 z-30 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        
        {/* Tab Personas */}
        <button
          onClick={() => setTab('personas')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition duration-150 touch-feedback ${
            activeTab === 'personas' 
              ? 'text-brand-primary font-bold' 
              : 'text-brand-muted hover:text-brand-text'
          }`}
        >
          <ClipboardList className={`w-6 h-6 transition-transform ${activeTab === 'personas' ? 'scale-110' : ''}`} />
          <span className="text-[10px] tracking-wide font-medium">Personas</span>
        </button>

        {/* Tab Vehículos */}
        <button
          onClick={() => setTab('vehiculos')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition duration-150 touch-feedback ${
            activeTab === 'vehiculos' 
              ? 'text-brand-primary font-bold' 
              : 'text-brand-muted hover:text-brand-text'
          }`}
        >
          <Car className={`w-6 h-6 transition-transform ${activeTab === 'vehiculos' ? 'scale-110' : ''}`} />
          <span className="text-[10px] tracking-wide font-medium">Vehículos</span>
        </button>

        {/* Tab Mecánica */}
        <button
          onClick={() => setTab('mecanica')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition duration-150 touch-feedback ${
            activeTab === 'mecanica' 
              ? 'text-brand-primary font-bold' 
              : 'text-brand-muted hover:text-brand-text'
          }`}
        >
          <Wrench className={`w-6 h-6 transition-transform ${activeTab === 'mecanica' ? 'scale-110' : ''}`} />
          <span className="text-[10px] tracking-wide font-medium">Mecánica</span>
        </button>

        {/* Tab Historial */}
        <button
          onClick={() => setTab('historial')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition duration-150 touch-feedback ${
            activeTab === 'historial' 
              ? 'text-brand-primary font-bold' 
              : 'text-brand-muted hover:text-brand-text'
          }`}
        >
          <ClipboardList className={`w-6 h-6 transition-transform ${activeTab === 'historial' ? 'scale-110' : ''}`} />
          <span className="text-[10px] tracking-wide font-medium">Historial</span>
        </button>

        {/* Tab Reportes */}
        <button
          onClick={() => setTab('reportes')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition duration-150 touch-feedback ${
            activeTab === 'reportes' 
              ? 'text-brand-primary font-bold' 
              : 'text-brand-muted hover:text-brand-text'
          }`}
        >
          <BarChart3 className={`w-6 h-6 transition-transform ${activeTab === 'reportes' ? 'scale-110' : ''}`} />
          <span className="text-[10px] tracking-wide font-medium">Reportes</span>
        </button>


        {/* Tab Configuración */}
        <button
          onClick={() => setTab('configuracion')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition duration-150 touch-feedback ${
            activeTab === 'configuracion' 
              ? 'text-brand-primary font-bold' 
              : 'text-brand-muted hover:text-brand-text'
          }`}
        >
          <SlidersHorizontal className={`w-6 h-6 transition-transform ${activeTab === 'configuracion' ? 'scale-110' : ''}`} />
          <span className="text-[10px] tracking-wide font-medium">Config.</span>
        </button>
      </nav>
    </div>
  );
}
