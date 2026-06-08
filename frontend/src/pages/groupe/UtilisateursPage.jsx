import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { Users, Plus, Shield, Lock, Unlock, Eye } from 'lucide-react';
import { ROLES_LABELS } from '../../lib/catalogue-rh';

const FILIALES = ['GROUPE','YAKRO_GRILL','TOPTELSIG','LIYA'];
const ROLES = Object.keys(ROLES_LABELS);

const ROLE_COLORS = {
  DG: '#E87722', DIRECTEUR: '#1a3f6f', RH: '#639922', COMPTABLE: '#1a3f6f',
  RESP_FONCIER: '#1a3f6f', RESP_LIVRAISON: '#E85D04', MANAGER: '#8B1A1A',
  COMMERCIAL: '#5F5E5A', CAISSIER: '#8B1A1A', SERVEUR: '#8B1A1A',
  BARMAN: '#8B1A1A', LIVREUR: '#E85D04', MAGASINIER: '#5F5E5A', EMPLOYE: '#888',
};

const FILIALES_LABELS = { GROUPE:'Groupe 2iG', YAKRO_GRILL:'Yakro Grill', TOPTELSIG:'TOPTELSIG', LIYA:'LiYA' };

export default function UtilisateursPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [filialeFilter, setFilialeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['utilisateurs', filialeFilter],
    queryFn: () => authAPI.listUtilisateurs(filialeFilter ? { filiale: filialeFilter } : {}),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, data }) => authAPI.updateRole(id, data),
    onSuccess: () => { qc.invalidateQueries(['utilisateurs']); setEditUser(null); showToast('Rôle mis à jour'); },
    onError: (e) => showToast(e?.response?.data?.error || 'Erreur', 'error'),
  });

  const createUser = useMutation({
    mutationFn: (data) => authAPI.register(data),
    onSuccess: () => { qc.invalidateQueries(['utilisateurs']); setShowCreate(false); showToast('Compte créé'); },
    onError: (e) => showToast(e?.response?.data?.error || 'Erreur création', 'error'),
  });

  const toggleActif = useMutation({
    mutationFn: ({ id, actif }) => authAPI.updateRole(id, { actif }),
    onSuccess: (_, { actif }) => { qc.invalidateQueries(['utilisateurs']); showToast(actif ? 'Compte activé' : 'Compte désactivé'); },
  });

  const unlock = useMutation({
    mutationFn: (id) => authAPI.unlockAccount(id),
    onSuccess: () => { qc.invalidateQueries(['utilisateurs']); showToast('Compte débloqué'); },
  });

  const filtered = users.filter(u =>
    (!search || `${u.nom} ${u.prenom} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20 }}>
            <Shield size={18} style={{ verticalAlign:'middle', marginRight:6, color:'#1a3f6f' }} />
            Gestion des accès & rôles
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            {users.length} compte(s) · {users.filter(u=>u.actif).length} actif(s)
          </p>
        </div>
        {user?.role === 'DG' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> Nouveau compte
          </button>
        )}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <input className="input" style={{ width:200 }} placeholder="Rechercher..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="input" style={{ width:160 }} value={filialeFilter} onChange={e=>setFilialeFilter(e.target.value)}>
          <option value="">Toutes filiales</option>
          {FILIALES.map(f => <option key={f} value={f}>{FILIALES_LABELS[f]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div className="table-container">
          <table className="table-erp">
            <thead>
              <tr>
                <th>Utilisateur</th><th>Email</th><th>Rôle</th><th>Filiale</th>
                <th>Statut</th><th>Dernière connexion</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} style={{ textAlign:'center', padding:20, color:'#888' }}>Chargement...</td></tr>}
              {filtered.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight:500 }}>{u.prenom} {u.nom}</td>
                  <td style={{ color:'#888', fontSize:12 }}>{u.email}</td>
                  <td>
                    <span className="badge" style={{ background: ROLE_COLORS[u.role]+'20', color: ROLE_COLORS[u.role] }}>
                      {ROLES_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td><span className="badge badge-blue">{FILIALES_LABELS[u.filiale]}</span></td>
                  <td>
                    <span className={`badge ${u.lockedUntil && new Date(u.lockedUntil) > new Date() ? 'badge-red' : u.actif ? 'badge-green' : 'badge-gray'}`}>
                      {u.lockedUntil && new Date(u.lockedUntil) > new Date() ? '🔒 Bloqué' : u.actif ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td style={{ fontSize:11, color:'#888' }}>
                    {u.derniereConnexion ? new Date(u.derniereConnexion).toLocaleString('fr',{dateStyle:'short',timeStyle:'short'}) : 'Jamais'}
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:4 }}>
                      {user?.role === 'DG' && u.id !== user.id && (
                        <>
                          <button className="btn btn-ghost btn-xs" onClick={() => setEditUser(u)} title="Modifier rôle">
                            <Shield size={11} />
                          </button>
                          {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                            <button className="btn btn-ghost btn-xs" onClick={() => unlock.mutate(u.id)} title="Débloquer">
                              <Unlock size={11} />
                            </button>
                          )}
                          <button className="btn btn-ghost btn-xs"
                            onClick={() => toggleActif.mutate({ id: u.id, actif: !u.actif })}
                            title={u.actif ? 'Désactiver' : 'Activer'}
                            style={{ color: u.actif ? '#A32D2D' : '#27500A' }}>
                            {u.actif ? <Lock size={11} /> : <Unlock size={11} />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><Users size={32} /><p>Aucun utilisateur trouvé</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal modifier rôle */}
      {editUser && (
        <ModalEditRole user={editUser} onClose={() => setEditUser(null)}
          onSave={(data) => updateRole.mutate({ id: editUser.id, data })}
          loading={updateRole.isPending} />
      )}

      {/* Modal créer compte */}
      {showCreate && (
        <ModalCreateUser onClose={() => setShowCreate(false)}
          onSave={(data) => createUser.mutate(data)}
          loading={createUser.isPending} />
      )}

      {toast && <div style={{ position:'fixed', bottom:20, right:16, background: toast.type==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>{toast.msg}</div>}
    </div>
  );
}

function ModalEditRole({ user, onClose, onSave, loading }) {
  const [role, setRole] = useState(user.role);
  const [filiale, setFiliale] = useState(user.filiale);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:400 }} onClick={e=>e.stopPropagation()}>
        <h3 style={{ margin:'0 0 16px', fontFamily:'Syne' }}>Modifier rôle — {user.prenom} {user.nom}</h3>
        <label className="label">Rôle</label>
        <select className="input" value={role} onChange={e=>setRole(e.target.value)} style={{ marginBottom:12 }}>
          {ROLES.map(r => <option key={r} value={r}>{ROLES_LABELS[r]}</option>)}
        </select>
        <label className="label">Filiale</label>
        <select className="input" value={filiale} onChange={e=>setFiliale(e.target.value)} style={{ marginBottom:20 }}>
          {FILIALES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={loading} onClick={() => onSave({ role, filiale })}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalCreateUser({ onClose, onSave, loading }) {
  const [form, setForm] = useState({ email:'', motDePasse:'', nom:'', prenom:'', role:'EMPLOYE', filiale:'GROUPE' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        <h3 style={{ margin:'0 0 16px', fontFamily:'Syne' }}>Nouveau compte utilisateur</h3>
        <div className="form-grid">
          <div><label className="label">Prénom</label><input className="input" value={form.prenom} onChange={e=>set('prenom',e.target.value)} /></div>
          <div><label className="label">Nom</label><input className="input" value={form.nom} onChange={e=>set('nom',e.target.value)} /></div>
          <div className="full"><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e=>set('email',e.target.value)} /></div>
          <div className="full">
            <label className="label">Mot de passe (min 12 car. + Maj + chiffre + spécial)</label>
            <input className="input" type="password" value={form.motDePasse} onChange={e=>set('motDePasse',e.target.value)} placeholder="Ex: MonMdp2025@!" />
          </div>
          <div>
            <label className="label">Rôle</label>
            <select className="input" value={form.role} onChange={e=>set('role',e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{ROLES_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Filiale</label>
            <select className="input" value={form.filiale} onChange={e=>set('filiale',e.target.value)}>
              {FILIALES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={loading} onClick={() => onSave(form)}>
            {loading ? 'Création...' : 'Créer le compte'}
          </button>
        </div>
      </div>
    </div>
  );
}
