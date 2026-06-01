import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Shield, Lock, User, AlertCircle, RefreshCw } from 'lucide-react';

export default function Login() {
  const { login, error } = useStore();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 bg-brand-bg relative overflow-hidden">
      
      {/* Círculos decorativos de fondo con difuminado para dar estética premium */}
      <div className="absolute top-[-10%] left-[-10%] w-72 h-72 rounded-full bg-brand-primary/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-72 h-72 rounded-full bg-blue-700/10 blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-sm flex flex-col gap-6 relative z-10">
        
        {/* Encabezado e Iso-Logotipo */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="p-4 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl text-brand-primary shadow-inner">
            <Shield className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">ControlInn</h1>
          <p className="text-slate-400 text-xs text-center font-medium tracking-wide">
            PLATAFORMA DE CONTROL DE ACCESO
          </p>
        </div>

        {/* Tarjeta de Login */}
        <div className="bg-brand-card p-6 rounded-3xl border border-brand-border/60 shadow-2xl flex flex-col gap-5">
          <h2 className="text-lg font-bold text-white text-center">Iniciar Sesión de Guardia</h2>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* Campo Usuario */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-xs font-semibold">Usuario de Operador</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white text-sm"
                  placeholder="Ej: guardia"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-xs font-semibold">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Botón Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-brand-primary hover:bg-blue-600 active:scale-[0.98] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition duration-200 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <span>INGRESAR AL PANEL</span>
              )}
            </button>
          </form>

          {/* Mensaje de Error */}
          {error && (
            <div className="p-3 bg-brand-danger/10 border border-brand-danger/30 rounded-xl text-brand-danger flex items-center gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Leyenda Credenciales Mock */}
        <div className="bg-brand-card/40 border border-brand-border/30 p-4 rounded-2xl text-center text-[10px] text-slate-400">
          <p className="font-semibold text-slate-300">Credenciales de Desarrollo:</p>
          <p className="mt-1 font-mono">Usuario: <span className="text-white font-bold">guardia</span> | Clave: <span className="text-white font-bold">control123</span></p>
          <p className="font-mono mt-0.5">Usuario: <span className="text-white font-bold">admin</span> | Clave: <span className="text-white font-bold">control123</span></p>
        </div>
      </div>
    </div>
  );
}
