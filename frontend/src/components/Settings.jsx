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
      <div className="flex items-center gap-3 pb-1">
        <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl border border-brand-primary/20">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-brand-text font-bold text-lg">Configuración</h2>
          <p className="text-brand-muted text-sm font-medium">Gestionar sectores y destinos</p>
        </div>
      </div>

      {/* Sectores actuales */}
      <div className="bg-brand-card rounded-2xl border border-brand-border p-5 flex flex-col gap-4 shadow-sm">
        <h3 className="text-sm font-bold text-brand-muted uppercase tracking-wider">Sectores Registrados</h3>

        {localSectors.length === 0 && (
          <p className="text-brand-muted text-sm italic py-4 text-center">No hay sectores configurados aún.</p>
        )}

        <div className="flex flex-col gap-2.5">
          {localSectors.map((sector) => (
            <div
              key={sector}
              className="flex items-center justify-between px-4 py-3 bg-brand-bg border border-brand-border rounded-xl"
            >
              <span className="text-brand-text text-base font-bold">{sector}</span>
              {isAdmin && (
                <button
                  onClick={() => handleRemove(sector)}
                  className="p-1.5 text-brand-muted hover:text-brand-danger hover:bg-brand-danger/10 rounded-lg transition"
                  title="Eliminar sector"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Agregar nuevo sector (solo admin) */}
        {isAdmin && (
          <div className="flex gap-3 mt-2">
            <input
              type="text"
              className="flex-1 px-4 py-3.5 bg-brand-bg border border-brand-border focus:border-brand-primary focus:outline-none rounded-xl text-brand-text text-base font-medium"
              placeholder="Ej: Depósito..."
              value={newSector}
              onChange={(e) => setNewSector(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="p-3.5 bg-brand-primary hover:bg-blue-600 text-white rounded-xl transition shadow-md"
              title="Agregar"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* Guardar (solo admin) */}
      {isAdmin && (
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center justify-center gap-2 w-full py-4 font-black text-lg rounded-2xl transition shadow-lg ${
            saved ? 'bg-brand-success text-white' : 'bg-brand-primary hover:bg-blue-600 text-white disabled:opacity-60'
          }`}
        >
          {saved ? (
            <>
              <Check className="w-6 h-6" />
              <span>CAMBIOS GUARDADOS</span>
            </>
          ) : (
            <>
              <Save className="w-6 h-6" />
              <span>{saving ? 'GUARDANDO...' : 'GUARDAR CONFIGURACIÓN'}</span>
            </>
          )}
        </button>
      )}

      {!isAdmin && (
        <div className="p-4 bg-brand-bg border border-brand-border rounded-xl text-brand-muted text-sm text-center font-medium italic">
          Solo los administradores pueden modificar la lista de sectores.
        </div>
      )}
    </div>
  );
}
