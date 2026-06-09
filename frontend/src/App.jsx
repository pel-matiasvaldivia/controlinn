import React, { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import Login from './pages/Login';
import QRScanner from './components/QRScanner';
import RTSPViewer from './components/RTSPViewer';
import AccessLog from './components/AccessLog';
import Settings from './components/Settings';
import { User, Shield, Wifi, WifiOff, LogOut, ClipboardList, Camera, Car, RefreshCw, SlidersHorizontal } from 'lucide-react';

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
      
      {/* Círculo decorativo de fondo */}
      <div className="absolute top-[-5%] right-[-5%] w-60 h-60 rounded-full bg-brand-primary/5 blur-[80px] pointer-events-none"></div>

      {/* HEADER DE OPERACIÓN */}
      <header className="bg-brand-card px-4 py-3 border-b border-brand-border/60 flex items-center justify-between sticky top-0 z-20 shadow-md">
        
        {/* Info Operador */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand-bg rounded-xl border border-brand-border/40 text-brand-primary">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm tracking-wide">ControlInn</span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase flex items-center gap-1">
              <User className="w-3 h-3 text-slate-500" />
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
            className="p-2 bg-brand-bg hover:bg-brand-border text-slate-400 hover:text-brand-danger border border-brand-border/40 rounded-xl transition touch-feedback"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        <div className="max-w-md mx-auto h-full">
          {activeTab === 'personas' && (
            <div className="flex flex-col gap-4">
              <QRScanner />
            </div>
          )}
          {activeTab === 'vehiculos' && <RTSPViewer />}
          {activeTab === 'historial' && <AccessLog />}
          {activeTab === 'configuracion' && <Settings />}
        </div>
      </main>


      {/* BARRA DE NAVEGACIÓN MÓVIL (Optimizada para 5-7 pulgadas) */}
      <nav className="bg-brand-card/95 backdrop-blur-md border-t border-brand-border/60 py-2 px-6 flex justify-around items-center fixed bottom-0 left-0 right-0 z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.4)]">
        
        {/* Tab Personas */}
        <button
          onClick={() => setTab('personas')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition duration-150 touch-feedback ${
            activeTab === 'personas' 
              ? 'text-brand-primary font-bold' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ClipboardList className={`w-6 h-6 transition-transform ${activeTab === 'personas' ? 'scale-110' : ''}`} />
          <span className="text-[10px] tracking-wide font-medium">Ingreso Personas</span>
        </button>

        {/* Tab Vehículos */}
        <button
          onClick={() => setTab('vehiculos')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition duration-150 touch-feedback ${
            activeTab === 'vehiculos' 
              ? 'text-brand-primary font-bold' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Car className={`w-6 h-6 transition-transform ${activeTab === 'vehiculos' ? 'scale-110' : ''}`} />
          <span className="text-[10px] tracking-wide font-medium">CCTV / Patente</span>
        </button>

        {/* Tab Historial */}
        <button
          onClick={() => setTab('historial')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition duration-150 touch-feedback ${
            activeTab === 'historial' 
              ? 'text-brand-primary font-bold' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ClipboardList className={`w-6 h-6 transition-transform ${activeTab === 'historial' ? 'scale-110' : ''}`} />
          <span className="text-[10px] tracking-wide font-medium">Historial</span>
        </button>

        {/* Tab Configuración */}
        <button
          onClick={() => setTab('configuracion')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition duration-150 touch-feedback ${
            activeTab === 'configuracion' 
              ? 'text-brand-primary font-bold' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <SlidersHorizontal className={`w-6 h-6 transition-transform ${activeTab === 'configuracion' ? 'scale-110' : ''}`} />
          <span className="text-[10px] tracking-wide font-medium">Configuración</span>
        </button>
      </nav>
    </div>
  );
}
