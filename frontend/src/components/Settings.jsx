import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Settings as SettingsIcon, Plus, X, Save, Check, Wrench, Users, MapPin } from 'lucide-react';

export default function Settings() {
  const { sectors, saveSectors, mechanicDestinations, knownMechanics, saveMechanicSettings, user } = useStore();

  const [activeSubTab, setActiveSubTab] = useState('general'); // 'general' | 'mechanic_dest' | 'mechanic_staff'
  
  const [localSectors, setLocalSectors] = useState([...sectors]);
  const [localMechDest, setLocalMechDest] = useState([...mechanicDestinations]);
  const [localMechStaff, setLocalMechStaff] = useState([...knownMechanics]);

  const [newGeneral, setNewGeneral] = useState('');
  const [newMechDest, setNewMechDest] = useState('');
  const [newStaff, setNewStaff] = useState({ name: '', surname: '', code: '' });

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sólo admin puede editar
  const isAdmin = user?.role === 'ADMIN';

  const handleSave = async () => {
    setSaving(true);
    let ok = false;
    if (activeSubTab === 'general') ok = await saveSectors(localSectors);
    else if (activeSubTab === 'mechanic_dest') ok = await saveMechanicSettings('mechanic_destinations', localMechDest);
    else if (activeSubTab === 'mechanic_staff') ok = await saveMechanicSettings('known_mechanics', localMechStaff);
    
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl border border-brand-primary/20">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-brand-text font-bold text-lg">Configuración</h2>
          <p className="text-brand-muted text-sm font-medium">Gestionar parámetros del sistema</p>
        </div>
      </div>

      {/* Tabs de Configuración */}
      <div className="flex gap-2 p-1.5 bg-brand-border/30 rounded-2xl">
        {[
          { id: 'general', label: 'General', icon: <SettingsIcon className="w-4 h-4" /> },
          { id: 'mechanic_dest', label: 'Destinos Mecánica', icon: <MapPin className="w-4 h-4" /> },
          { id: 'mechanic_staff', label: 'Personal Mecánica', icon: <Users className="w-4 h-4" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-bold rounded-xl text-xs transition ${
              activeSubTab === tab.id
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-brand-muted hover:text-brand-text'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido de la Tab */}
      <div className="bg-brand-card rounded-2xl border border-brand-border p-6 flex flex-col gap-5 shadow-sm mb-4">
        
        {/* SECTORES GENERALES */}
        {activeSubTab === 'general' && (
          <>
            <h3 className="text-sm font-bold text-brand-muted uppercase tracking-wider flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" /> Sectores de Destino (Clientes/Proveedores)
            </h3>
            
            {isAdmin && (
              <div className="flex gap-3 mb-2 p-1">
                <input type="text" className="flex-1 px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text font-medium focus:outline-none focus:border-brand-primary" placeholder="Nuevo sector..." value={newGeneral} onChange={e => setNewGeneral(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setLocalSectors([...localSectors, newGeneral.trim()]), setNewGeneral(''))} />
                <button onClick={() => { if(newGeneral) { setLocalSectors([...localSectors, newGeneral.trim()]); setNewGeneral(''); } }} className="p-3 bg-brand-primary text-white rounded-xl transition shadow-md"><Plus className="w-6 h-6" /></button>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {localSectors.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 bg-brand-bg border border-brand-border rounded-xl">
                  <span className="text-brand-text font-bold">{s}</span>
                  {isAdmin && (
                    <button onClick={() => setLocalSectors(localSectors.filter(x => x !== s))} className="p-1.5 text-brand-muted hover:text-brand-danger rounded-lg transition">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* DESTINOS MECÁNICA */}
        {activeSubTab === 'mechanic_dest' && (
          <>
            <h3 className="text-sm font-bold text-brand-muted uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Destinos Exclusivos Mecánica
            </h3>

            {isAdmin && (
              <div className="flex gap-3 mb-2 p-1">
                <input type="text" className="flex-1 px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text font-medium focus:outline-none focus:border-brand-primary" placeholder="Ej: Taller Norte, Prueba Ruta..." value={newMechDest} onChange={e => setNewMechDest(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setLocalMechDest([...localMechDest, newMechDest.trim()]), setNewMechDest(''))} />
                <button onClick={() => { if(newMechDest) { setLocalMechDest([...localMechDest, newMechDest.trim()]); setNewMechDest(''); } }} className="p-3 bg-brand-primary text-white rounded-xl transition shadow-md"><Plus className="w-6 h-6" /></button>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {localMechDest.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 bg-brand-bg border border-brand-border rounded-xl">
                  <span className="text-brand-text font-bold">{s}</span>
                  {isAdmin && (
                    <button onClick={() => setLocalMechDest(localMechDest.filter(x => x !== s))} className="p-1.5 text-brand-muted hover:text-brand-danger rounded-lg transition">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* PERSONAL DE MECÁNICA */}
        {activeSubTab === 'mechanic_staff' && (
          <>
            <h3 className="text-sm font-bold text-brand-muted uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" /> Personal de Mecánica Conocido
            </h3>

            {isAdmin && (
              <div className="flex flex-col gap-3 mb-4 p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-2xl border-dashed">
                <p className="text-[10px] font-bold text-brand-primary uppercase">Agregar Nuevo Personal</p>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" className="px-3 py-2.5 bg-white border border-brand-border rounded-xl text-sm font-medium focus:outline-none focus:border-brand-primary" placeholder="Nombre" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
                  <input type="text" className="px-3 py-2.5 bg-white border border-brand-border rounded-xl text-sm font-medium focus:outline-none focus:border-brand-primary" placeholder="Apellido" value={newStaff.surname} onChange={e => setNewStaff({...newStaff, surname: e.target.value})} />
                  <input type="text" className="col-span-2 px-3 py-2.5 bg-white border-2 border-brand-primary/30 rounded-xl text-sm font-black focus:outline-none focus:border-brand-primary" placeholder="CÓDIGO ÚNICO (Eje: M01)" value={newStaff.code} onChange={e => setNewStaff({...newStaff, code: e.target.value.toUpperCase()})} />
                </div>
                <button onClick={() => { if(newStaff.name && newStaff.code) { setLocalMechStaff([...localMechStaff, {...newStaff, name: newStaff.name.trim(), surname: newStaff.surname.trim(), code: newStaff.code.trim().toUpperCase()}]); setNewStaff({name:'', surname:'', code:''}); } }} className="w-full py-3 bg-brand-primary text-white font-black text-xs rounded-xl transition uppercase shadow-md hover:bg-blue-600">Agregar Personal</button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {localMechStaff.map((m, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 bg-brand-bg border border-brand-border rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-brand-text font-bold">{m.surname}, {m.name}</span>
                    <span className="text-brand-primary font-black text-xs">CÓDIGO: {m.code}</span>
                  </div>
                  {isAdmin && (
                    <button onClick={() => setLocalMechStaff(localMechStaff.filter((_, idx) => idx !== i))} className="p-1.5 text-brand-muted hover:text-brand-danger rounded-lg transition">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Guardar (solo admin) - Barra Fija */}
      {isAdmin && (
        <div className="sticky bottom-0 pt-4 pb-6 bg-brand-bg/90 backdrop-blur-sm z-30 -mt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center justify-center gap-2 w-full py-4 font-black text-lg rounded-2xl transition shadow-xl border-2 ${
              saved 
                ? 'bg-brand-success border-brand-success text-white' 
                : 'bg-brand-primary border-brand-primary hover:bg-blue-600 text-white disabled:opacity-60'
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
                <span>{saving ? 'GUARDANDO...' : `GUARDAR ${activeSubTab === 'general' ? 'DESTINOS' : activeSubTab === 'mechanic_dest' ? 'DESTINOS MEC.' : 'PERSONAL'}`}</span>
              </>
            )}
          </button>
        </div>
      )}

      {!isAdmin && (
        <div className="p-4 bg-brand-bg border border-brand-border rounded-xl text-brand-muted text-sm text-center font-medium italic">
          Solo los administradores pueden modificar la configuración.
        </div>
      )}
    </div>
  );
}
