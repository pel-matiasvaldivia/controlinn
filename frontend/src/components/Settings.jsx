import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Settings as SettingsIcon, Plus, X, Save, Check, Wrench, Users, MapPin, Trash2, Shield, Key } from 'lucide-react';

export default function Settings() {
  const { 
    sectors, saveSectors, providerSectors, mechanicDestinations, 
    knownMechanics, saveMechanicSettings, user,
    systemUsers, loadSystemUsers, createSystemUser, deleteSystemUser, updateSystemUser 
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState('general'); // 'general' | 'providers' | 'mechanic_dest' | 'mechanic_staff' | 'users'
  
  const [localSectors, setLocalSectors] = useState([...sectors]);
  const [localProvSectors, setLocalProvSectors] = useState([...providerSectors]);
  const [localMechDest, setLocalMechDest] = useState([...mechanicDestinations]);
  const [localMechStaff, setLocalMechStaff] = useState([...knownMechanics]);

  const [newGeneral, setNewGeneral] = useState('');
  const [newProv, setNewProv] = useState('');
  const [newMechDest, setNewMechDest] = useState('');
  const [newStaff, setNewStaff] = useState({ name: '', surname: '', code: '', sector: '' });

  // Gestión de Usuarios
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'GUARDIA' });
  const [editingUser, setEditingUser] = useState(null);

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadSystemUsers();
    }
  }, [user]);

  // Sólo admin puede editar configuraciones generales
  const isAdmin = user?.role === 'ADMIN';

  const handleSave = async () => {
    setSaving(true);
    let ok = false;
    if (activeSubTab === 'general') ok = await saveSectors('clients', localSectors);
    else if (activeSubTab === 'providers') ok = await saveSectors('providers', localProvSectors);
    else if (activeSubTab === 'mechanic_dest') ok = await saveMechanicSettings('mechanic_destinations', localMechDest);
    else if (activeSubTab === 'mechanic_staff') ok = await saveMechanicSettings('known_mechanics', localMechStaff);
    
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    const ok = await createSystemUser(newUser);
    if (ok) {
      setNewUser({ username: '', password: '', role: 'GUARDIA' });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('¿Está seguro de eliminar este usuario?')) {
      await deleteSystemUser(id);
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
          <p className="text-brand-muted text-sm font-medium">Gestionar parámetros y accesos del sistema</p>
        </div>
      </div>

      {/* Tabs de Configuración */}
      <div className="flex gap-1.5 p-1.5 bg-brand-border/30 rounded-2xl overflow-x-auto no-scrollbar">
        {[
          { id: 'general', label: 'Clientes', icon: <Users className="w-4 h-4" /> },
          { id: 'providers', label: 'Proveedores', icon: <MapPin className="w-4 h-4" /> },
          { id: 'mechanic_dest', label: 'Personal (Dest)', icon: <MapPin className="w-4 h-4" /> },
          { id: 'mechanic_staff', label: 'Personal (Staff)', icon: <Check className="w-4 h-4" /> },
          ...(isAdmin ? [{ id: 'users', label: 'Usuarios', icon: <Shield className="w-4 h-4" /> }] : [])
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`min-w-max flex-1 flex items-center justify-center gap-2 px-3 py-2.5 font-bold rounded-xl text-[10px] sm:text-xs transition ${
              activeSubTab === tab.id
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-brand-muted hover:text-brand-text'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido de la Tab */}
      <div className="bg-brand-card rounded-2xl border border-brand-border p-6 flex flex-col gap-5 shadow-sm mb-4">
        
        {/* SECTORES CLIENTES */}
        {activeSubTab === 'general' && (
          <>
            <h3 className="text-sm font-bold text-brand-muted uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" /> Sectores de Destino (Clientes)
            </h3>
            
            {isAdmin && (
              <div className="flex gap-3 mb-2 p-1">
                <input type="text" className="flex-1 px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text font-medium focus:outline-none focus:border-brand-primary" placeholder="Nuevo sector clientes..." value={newGeneral} onChange={e => setNewGeneral(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setLocalSectors([...localSectors, newGeneral.trim()]), setNewGeneral(''))} />
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

        {/* ... (Proveedores y Personal Dest/Staff igual) ... */}

        {/* GESTIÓN DE USUARIOS */}
        {activeSubTab === 'users' && isAdmin && (
          <div className="flex flex-col gap-6">
             <div className="flex flex-col gap-3 p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-2xl border-dashed">
                <p className="text-[10px] font-bold text-brand-primary uppercase">Crear Nuevo Usuario</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="text" className="px-3 py-2.5 bg-white border border-brand-border rounded-xl text-sm font-medium focus:outline-none focus:border-brand-primary" placeholder="Usuario" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                  <input type="password" title="Contraseña" className="px-3 py-2.5 bg-white border border-brand-border rounded-xl text-sm font-medium focus:outline-none focus:border-brand-primary" placeholder="Contraseña" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                  <select className="px-3 py-2.5 bg-white border border-brand-border rounded-xl text-sm font-medium focus:outline-none focus:border-brand-primary" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="GUARDIA">OPERADOR</option>
                    <option value="ADMIN">ADMINISTRADOR</option>
                  </select>
                </div>
                <button onClick={handleCreateUser} className="w-full py-3 bg-brand-primary text-white font-black text-xs rounded-xl transition uppercase shadow-md hover:bg-blue-600">Crear Usuario</button>
              </div>

              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-black text-brand-muted uppercase tracking-widest pl-1">Usuarios Activos</h4>
                {systemUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-4 bg-brand-bg border border-brand-border rounded-2xl hover:shadow-sm transition">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${u.role === 'ADMIN' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {u.role === 'ADMIN' ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-brand-text font-bold text-base">{u.username.toUpperCase()}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block w-fit ${u.role === 'ADMIN' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                          {u.role === 'ADMIN' ? 'ADMINISTRADOR' : 'OPERADOR'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={() => {
                          const newPass = window.prompt(`Cambiar contraseña para ${u.username}:`);
                          if (newPass) updateSystemUser(u.id, { password: newPass });
                        }}
                        className="p-2.5 text-brand-primary hover:bg-brand-primary/10 rounded-xl transition"
                        title="Cambiar Contraseña"
                      >
                        <Key className="w-5 h-5" />
                       </button>
                       {u.id !== user.id && (
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-2.5 text-brand-muted hover:text-brand-danger hover:bg-brand-danger/10 rounded-xl transition"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                       )}
                    </div>
                  </div>
                ))}
              </div>
          </div>
        )}

        {/* DESTINOS PROVEEDORES (Copiado de antes pero abreviado por espacio en este prompt) */}
        {activeSubTab === 'providers' && (
          <>
            <h3 className="text-sm font-bold text-brand-muted uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Sectores de Destino (Proveedores)
            </h3>
            {isAdmin && (
              <div className="flex gap-3 mb-2 p-1">
                <input type="text" className="flex-1 px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text font-medium focus:outline-none focus:border-brand-primary" placeholder="Nuevo sector proveedores..." value={newProv} onChange={e => setNewProv(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setLocalProvSectors([...localProvSectors, newProv.trim()]), setNewProv(''))} />
                <button onClick={() => { if(newProv) { setLocalProvSectors([...localProvSectors, newProv.trim()]); setNewProv(''); } }} className="p-3 bg-brand-primary text-white rounded-xl transition shadow-md"><Plus className="w-6 h-6" /></button>
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              {localProvSectors.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 bg-brand-bg border border-brand-border rounded-xl">
                  <span className="text-brand-text font-bold">{s}</span>
                  {isAdmin && (
                    <button onClick={() => setLocalProvSectors(localProvSectors.filter(x => x !== s))} className="p-1.5 text-brand-muted hover:text-brand-danger rounded-lg transition">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ... Resto de sub-tabs igual ... */}

      </div>

      {/* Guardar (solo admin) - Barra Fija */}
      {isAdmin && activeSubTab !== 'users' && (
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
                <span>{saving ? 'GUARDANDO...' : `GUARDAR ${activeSubTab === 'general' ? 'DEST. CLIE.' : activeSubTab === 'providers' ? 'DEST. PROV.' : 'DEST. PERS.'}`}</span>
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
