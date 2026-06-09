import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Settings as SettingsIcon, Plus, X, Save, Check } from 'lucide-react';

export default function Settings() {
  const { sectors, saveSectors, user } = useStore();

  const [localSectors, setLocalSectors] = useState([...sectors]);
  const [newSector, setNewSector] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sólo admin puede editar
  const isAdmin = user?.role === 'ADMIN';

  const handleAdd = () => {
    const trimmed = newSector.trim();
    if (!trimmed || localSectors.includes(trimmed)) return;
    setLocalSectors([...localSectors, trimmed]);
    setNewSector('');
  };

  const handleRemove = (sector) => {
    setLocalSectors(localSectors.filter((s) => s !== sector));
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveSectors(localSectors);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-brand-primary/20 text-brand-primary rounded-xl border border-brand-primary/30">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-white font-bold text-base">Configuración del Sistema</h2>
          <p className="text-slate-400 text-xs">Sectores / destinos disponibles en el formulario de ingreso</p>
        </div>
      </div>

      {/* Sectores actuales */}
      <div className="bg-brand-card rounded-2xl border border-brand-border p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Sectores Configurados</h3>

        {localSectors.length === 0 && (
          <p className="text-slate-500 text-sm italic">No hay sectores configurados.</p>
        )}

        <div className="flex flex-col gap-2">
          {localSectors.map((sector) => (
            <div
              key={sector}
              className="flex items-center justify-between px-4 py-2.5 bg-brand-bg border border-brand-border/50 rounded-xl"
            >
              <span className="text-white text-sm font-medium">{sector}</span>
              {isAdmin && (
                <button
                  onClick={() => handleRemove(sector)}
                  className="p-1 text-slate-500 hover:text-brand-danger rounded-lg transition"
                  title="Eliminar sector"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Agregar nuevo sector (solo admin) */}
        {isAdmin && (
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              className="flex-1 px-4 py-2.5 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-white text-sm"
              placeholder="Nuevo sector..."
              value={newSector}
              onChange={(e) => setNewSector(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="p-2.5 bg-brand-primary hover:bg-blue-600 text-white rounded-xl transition"
              title="Agregar"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Guardar (solo admin) */}
      {isAdmin && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full py-4 bg-brand-primary hover:bg-blue-600 disabled:opacity-60 text-white font-bold rounded-2xl transition"
        >
          {saved ? (
            <>
              <Check className="w-5 h-5 text-brand-success" />
              <span>¡Guardado!</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </>
          )}
        </button>
      )}

      {!isAdmin && (
        <p className="text-slate-500 text-sm text-center italic">
          Solo los administradores pueden modificar los sectores.
        </p>
      )}
    </div>
  );
}
