/**
 * Gestion des Accès, Utilisateurs et Rôles ERP
 * CdC complet : création, rôles, permissions, reset mdp, traçabilité
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI, employesAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { Plus, X, Key, Shield, Eye, Lock, Unlock, RefreshCw } from 'lucide-react';

// ── Constantes ─────────────────────────────────────────────────────────────────
const FILIALES_COLORS = {
  GROUPE: '#1a3f6f', YAKRO_GRILL: '#8B1A1A', TOPTELSIG: '#27500A', LIYA: '#E85D04',
};

const ROLES_CONFIG = {
  DG:            { label:'Directeur Général',   color:'#1a1a1a', bg:'#F7F7F5', desc:'Accès complet à tout l\'ERP' },
  DIRECTEUR:     { label:'Directeur',           color:'#1a3f6f', bg:'#EEF3FB', desc:'Dashboard, rapports, validation, contrôle' },
  MANAGER:       { label:'Manager',             color:'#BA7517', bg:'#FAEEDA', desc:'Supervision opérationnelle' },
  RH:            { label:'Responsable RH',      color:'#27500A', bg:'#EAF3DE', desc:'Gestion employés, paie, congés' },
  COMPTABLE:     { label:'Comptable',           color:'#5F5E5A', bg:'#F7F7F5', desc:'Paiements, factures, dépenses, rapports financiers' },
  RESP_FONCIER:  { label:'Responsable Foncier', color:'#1a3f6f', bg:'#EEF3FB', desc:'Projets, lots, suivi clients fonciers' },
  COMMERCIAL:    { label:'Commercial Foncier',  color:'#E87722', bg:'#FEF0E6', desc:'CRM, prospects, propositions, réservations' },
  CAISSIER:      { label:'Caissier Yakro Grill',color:'#8B1A1A', bg:'#FEF6F6', desc:'Caisse, encaissements, factures Yakro' },
  SERVEUR:       { label:'Serveur Yakro Grill', color:'#8B1A1A', bg:'#FEF6F6', desc:'Plan de salle, tables, commandes, encaissement' },
  MAGASINIER:    { label:'Magasinier',          color:'#639922', bg:'#F4FAE8', desc:'Stocks, entrées, sorties, inventaire' },
  RESP_LIVRAISON:{ label:'Responsable Livraison',color:'#E85D04', bg:'#FFF5F0', desc:'Livraisons LiYA, motos, routes' },
  LIVREUR:       { label:'Livreur',             color:'#E85D04', bg:'#FFF5F0', desc:'Livraisons assignées' },
  EMPLOYE:       { label:'Employé',             color:'#888',   bg:'#F7F7F5', desc:'Accès de base — lecture uniquement' },
};

const FILIALES = ['GROUPE','YAKRO_GRILL','TOPTELSIG','LIYA'];

const PERMISSIONS_PAR_ROLE = {
  DG:            ['Tout voir','Tout créer','Tout modifier','Tout supprimer','Tout valider','Tout exporter','Configuration'],
  DIRECTEUR:     ['Dashboard','Rapports','Validation','Contrôle activité','Export Excel'],
  COMMERCIAL:    ['CRM','Prospects','Propositions lots','Réservations'],
  RESP_FONCIER:  ['Projets fonciers','Lots','Suivi souscripteurs','Gestion projet'],
  COMPTABLE:     ['Paiements','Factures','Dépenses','Rapports financiers','Export'],
  CAISSIER:      ['Caisse Yakro','Encaissements','Factures Yakro'],
  SERVEUR:       ['Plan de salle','Tables assignées','Commandes','Encaissement si autorisé'],
  MAGASINIER:    ['Stocks','Entrées stock','Sorties stock','Inventaire'],
  RH:            ['Employés','Congés','Avances','Évaluations','Paie'],
  MANAGER:       ['Dashboard','Supervision','Validation opérationnelle'],
  RESP_LIVRAISON:['Livraisons','Motos','Routes','Partenaires 3PL'],
  LIVREUR:       ['Livraisons assignées'],
  EMPLOYE:       ['Consultation profil personnel'],
};

const fmtDate = d => d ? new Date(d).toLocaleString('fr', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Jamais';

// ── Composant : badge rôle ──────────────────────────────────────────────────────
function BadgeRole({ role }) {
  const r = ROLES_CONFIG[role] || { label:role, color:'#888', bg:'#F7F7F5' };
  return (
    <span style={{ fontSize:10, background:r.bg, color:r.color, borderRadius:8, padding:'2px 8px', fontWeight:600, whiteSpace:'nowrap' }}>
      {r.label}
    </span>
  );
}

// ── Modal : Créer accès ERP depuis employé ──────────────────────────────────────
function ModalCreerAcces({ employe, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    email: employe?.email || '',
    role: 'EMPLOYE',
    filiale: employe?.filiale || 'GROUPE',
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>🔑 Créer un accès ERP</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>

        {employe && (
          <div style={{ background:'#EEF3FB', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
            <strong>{employe.prenom} {employe.nom}</strong> — {employe.poste}<br/>
            <span style={{ color:'#888' }}>{employe.filiale?.replace('_',' ')} · {employe.telephone||'—'}</span>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label className="label">Email (identifiant de connexion) *</label>
            <input className="input" type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="prenom.nom@2ig.ci"/>
          </div>
          <div>
            <label className="label">Rôle *</label>
            <select className="input" value={form.role} onChange={e=>set('role',e.target.value)}>
              {Object.entries(ROLES_CONFIG).map(([k,v])=>(
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            {form.role && ROLES_CONFIG[form.role] && (
              <div style={{ fontSize:10, color:'#888', marginTop:3 }}>
                {ROLES_CONFIG[form.role].desc}
              </div>
            )}
          </div>
          <div>
            <label className="label">Filiale</label>
            <select className="input" value={form.filiale} onChange={e=>set('filiale',e.target.value)}>
              {FILIALES.map(f=><option key={f} value={f}>{f.replace('_',' ')}</option>)}
            </select>
          </div>

          {form.role && PERMISSIONS_PAR_ROLE[form.role] && (
            <div style={{ background:'#F7F7F5', borderRadius:8, padding:'10px 14px' }}>
              <div style={{ fontSize:11, fontWeight:600, marginBottom:6 }}>Permissions incluses :</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {PERMISSIONS_PAR_ROLE[form.role].map(p=>(
                  <span key={p} style={{ fontSize:10, background:'#EAF3DE', color:'#27500A', borderRadius:6, padding:'2px 7px' }}>✓ {p}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ background:'#FAEEDA', borderRadius:8, padding:'8px 12px', fontSize:11, color:'#412402' }}>
            ⚠ Un mot de passe temporaire sera généré automatiquement. Notez-le pour le transmettre au collaborateur.
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
            disabled={!form.email||!form.role||!form.filiale||loading}
            onClick={()=>onSave({ ...form, employeId: employe?.id })}>
            {loading?'Création...':'🔑 Créer l\'accès'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal : Résultat création accès ────────────────────────────────────────────
function ModalResultatAcces({ result, onClose }) {
  const [copied, setCopied] = useState(false);
  const texte = `Votre accès ERP Groupe 2IG a été créé.\nIdentifiant : ${result.utilisateur?.email}\nMot de passe temporaire : ${result.mdpTemporaire}\nChangez votre mot de passe dès la première connexion.`;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:460 }} onClick={e=>e.stopPropagation()}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:18, color:'#27500A' }}>Accès créé avec succès</h3>
        </div>

        <div style={{ background:'#EAF3DE', borderRadius:10, padding:'16px 20px', marginBottom:16 }}>
          <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>Informations de connexion :</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ fontSize:13 }}><span style={{ color:'#888' }}>Email : </span><strong>{result.utilisateur?.email}</strong></div>
            <div style={{ fontSize:13 }}>
              <span style={{ color:'#888' }}>Mot de passe temporaire : </span>
              <strong style={{ fontFamily:'monospace', fontSize:15, color:'#1a3f6f', background:'#EEF3FB', padding:'2px 8px', borderRadius:5 }}>
                {result.mdpTemporaire}
              </strong>
            </div>
          </div>
        </div>

        <div style={{ background:'#F7F7F5', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:11, color:'#555', fontFamily:'monospace', whiteSpace:'pre-line' }}>
          {texte}
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn btn-ghost btn-sm"
            onClick={()=>{ navigator.clipboard.writeText(texte); setCopied(true); setTimeout(()=>setCopied(false),2000); }}>
            {copied?'✅ Copié':'📋 Copier'}
          </button>
          <button className="btn btn-ghost btn-sm"
            onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank')}>
            💬 Envoyer WhatsApp
          </button>
          <button className="btn btn-primary btn-sm" style={{ background:'#27500A', border:'none' }} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PAGE PRINCIPALE ─────────────────────────────────────────────────────────────
export default function UtilisateursPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [onglet, setOnglet] = useState('employes'); // Montrer employes en premier
  const [filialeFilter, setFilialeFilter] = useState('');
  const [creerAccesDirect, setCreerAccesDirect] = useState(null); // employé pour créer accès
  const [roleFilter, setRoleFilter] = useState('');
  const [actifFilter, setActifFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCreerAcces, setShowCreerAcces] = useState(false);
  const [resultatAcces, setResultatAcces] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg,t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3500); };

  const { data: allEmployes = [] } = useQuery({
    queryKey: ['tous-employes-acces'],
    queryFn: () => employesAPI.list({ limit: 200 }),
    staleTime: 30000,
    enabled: onglet === 'employes',
  });
  const listeEmployes = Array.isArray(allEmployes) ? allEmployes : (allEmployes?.data || []);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['utilisateurs', filialeFilter, roleFilter, actifFilter],
    queryFn: () => authAPI.getUtilisateurs({
      filiale: filialeFilter||undefined,
      role: roleFilter||undefined,
      actif: actifFilter||undefined,
    }),
    staleTime: 15000,
  });

  const { data: logsData } = useQuery({
    queryKey: ['historisation'],
    queryFn: () => authAPI.historisation({ limit: 200 }),
    enabled: onglet === 'historisation',
    staleTime: 30000,
  });

  const creerAccesMut = useMutation({
    mutationFn: authAPI.creerDepuisEmploye,
    onSuccess: (res) => {
      qc.invalidateQueries(['utilisateurs']);
      setShowCreerAcces(false);
      setResultatAcces(res);
    },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const resetMut = useMutation({
    mutationFn: (id) => authAPI.resetPassword(id),
    onSuccess: (res) => {
      setResetResult(res);
      showToast('Mot de passe réinitialisé ✓');
    },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const updateRoleMut = useMutation({
    mutationFn: ({ id, data }) => authAPI.updateRole(id, data),
    onSuccess: () => { qc.invalidateQueries(['utilisateurs']); showToast('Rôle mis à jour ✓'); },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const desactiverMut = useMutation({
    mutationFn: authAPI.desactiverUser,
    onSuccess: () => { qc.invalidateQueries(['utilisateurs']); showToast('Compte désactivé'); },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const unlockMut = useMutation({
    mutationFn: (id) => authAPI.unlockAccount(id),
    onSuccess: () => { qc.invalidateQueries(['utilisateurs']); showToast('Compte débloqué ✓'); },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const createUserMut = useMutation({
    mutationFn: (data) => authAPI.register(data),
    onSuccess: (res) => {
      qc.invalidateQueries(['utilisateurs']);
      setShowCreate(false);
      setResultatAcces(res);
    },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const list = Array.isArray(users) ? users : [];
  const logs = logsData?.data || [];
  const actifs = list.filter(u=>u.actif).length;
  const inactifs = list.filter(u=>!u.actif).length;

  const ACTION_LABELS = {
    CREATE:'Création', UPDATE:'Modification', DELETE:'Suppression',
    VALIDATE:'Validation', EXPORT:'Export', LOGIN:'Connexion',
    LOGOUT:'Déconnexion', PASSWORD_CHANGE:'Changement mdp',
    LOGIN_FAILED:'Tentative échouée', PAIEMENT:'Paiement',
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20 }}>🔐 Accès & Rôles ERP</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            {list.length} comptes · {actifs} actifs · {inactifs} inactifs
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setShowCreerAcces(true)}>
            🔑 Créer accès (depuis employé)
          </button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
            onClick={()=>setShowCreate(true)}>
            <Plus size={13}/> Nouveau compte
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid #e8e7e1', marginBottom:20 }}>
        {[
          ['employes','👤 Tous les employés'],
          ['utilisateurs','🔑 Comptes ERP'],
          ['roles','🎭 Rôles & Permissions'],
          ['historisation','📋 Historisation'],
        ].map(([k,v])=>(
          <button key={k} onClick={()=>setOnglet(k)}
            style={{ padding:'8px 16px', border:'none', background:'none', cursor:'pointer', fontSize:12,
              fontWeight:onglet===k?600:400, color:onglet===k?'#1a3f6f':'#888',
              borderBottom:onglet===k?'2px solid #1a3f6f':'2px solid transparent' }}>
            {v}
          </button>
        ))}
      </div>

      {/* Onglet Tous les employés */}
      {onglet === 'employes' && (
        <>
          <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>
            {listeEmployes.length} employés · <span style={{ color:'#27500A' }}>{listeEmployes.filter(e=>e.utilisateurId).length} ont un compte ERP</span> · <span style={{ color:'#A32D2D' }}>{listeEmployes.filter(e=>!e.utilisateurId).length} sans accès</span>
          </div>
          <div className="card" style={{ padding:0, overflowX:'auto' }}>
            <table className="table-erp">
              <thead>
                <tr><th>Employé</th><th>Poste</th><th>Filiale</th><th>Contact</th><th>Accès ERP</th><th>Action</th></tr>
              </thead>
              <tbody>
                {listeEmployes.map(e => (
                  <tr key={e.id} style={{ background: e.utilisateurId ? undefined : '#FFFBF0' }}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:30, height:30, borderRadius:'50%', background:(FILIALES_COLORS[e.filiale]||'#888')+'20', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:FILIALES_COLORS[e.filiale]||'#888' }}>
                          {e.prenom?.[0]}{e.nom?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{e.prenom} {e.nom}</div>
                          <div style={{ fontSize:11, color:'#888' }}>{e.matricule}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:13 }}>{e.poste}</td>
                    <td><BadgeRole role={e.filiale}/></td>
                    <td style={{ fontSize:12 }}>{e.telephone}</td>
                    <td>
                      {e.utilisateurId ? (
                        <span style={{ fontSize:10, background:'#EAF3DE', color:'#27500A', borderRadius:8, padding:'2px 8px', fontWeight:600 }}>
                          ✅ Accès actif
                        </span>
                      ) : (
                        <span style={{ fontSize:10, background:'#FAEEDA', color:'#BA7517', borderRadius:8, padding:'2px 8px', fontWeight:500 }}>
                          ⚠ Sans accès
                        </span>
                      )}
                    </td>
                    <td>
                      {!e.utilisateurId && (
                        <button className="btn btn-xs" style={{ background:'#1a3f6f', color:'white', border:'none', fontSize:10 }}
                          onClick={() => setCreerAccesDirect(e)}>
                          🔑 Créer accès
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {listeEmployes.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state"><p>Aucun employé</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Onglet Utilisateurs */}
      {onglet === 'utilisateurs' && (
        <>
          {/* Filtres */}
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <select className="input" style={{ width:160 }} value={filialeFilter} onChange={e=>setFilialeFilter(e.target.value)}>
              <option value="">Toutes filiales</option>
              {FILIALES.map(f=><option key={f} value={f}>{f.replace('_',' ')}</option>)}
            </select>
            <select className="input" style={{ width:200 }} value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}>
              <option value="">Tous les rôles</option>
              {Object.entries(ROLES_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="input" style={{ width:140 }} value={actifFilter} onChange={e=>setActifFilter(e.target.value)}>
              <option value="">Tous statuts</option>
              <option value="true">Actifs</option>
              <option value="false">Inactifs</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={()=>qc.invalidateQueries(['utilisateurs'])}>
              <RefreshCw size={13}/>
            </button>
          </div>

          {/* Tableau */}
          <div className="card" style={{ padding:0, overflowX:'auto' }}>
            {isLoading ? <div style={{ padding:40, textAlign:'center', color:'#888' }}>Chargement...</div> : (
              <table className="table-erp">
                <thead>
                  <tr>
                    <th>Utilisateur</th><th>Rôle</th><th>Filiale</th>
                    <th>Statut</th><th>Dernière connexion</th>
                    <th>Tentatives</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(u => (
                    <tr key={u.id} style={{ opacity:u.actif?1:0.6 }}>
                      <td>
                        <div style={{ fontWeight:600, fontSize:13 }}>{u.prenom} {u.nom}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{u.email}</div>
                      </td>
                      <td><BadgeRole role={u.role}/></td>
                      <td style={{ fontSize:11, color:'#888' }}>{u.filiale?.replace('_',' ')}</td>
                      <td>
                        <span style={{ fontSize:10, background:u.actif?'#EAF3DE':'#FCEBEB', color:u.actif?'#27500A':'#A32D2D', borderRadius:8, padding:'2px 8px', fontWeight:500 }}>
                          {u.actif?'Actif':'Inactif'}
                          {u.lockedUntil && new Date(u.lockedUntil) > new Date() ? ' 🔒' : ''}
                        </span>
                      </td>
                      <td style={{ fontSize:11, color:'#888' }}>{fmtDate(u.derniereConnexion)}</td>
                      <td style={{ textAlign:'center', fontSize:11, color:u.loginAttempts>=3?'#A32D2D':'#888' }}>
                        {u.loginAttempts > 0 ? `${u.loginAttempts} ⚠` : '0'}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {/* Changer rôle */}
                          <select style={{ fontSize:10, padding:'2px 5px', border:'0.5px solid #e8e7e1', borderRadius:5, cursor:'pointer', maxWidth:120 }}
                            value={u.role}
                            onChange={e => {
                              if (u.id === currentUser?.id) { showToast('Impossible de changer son propre rôle','error'); return; }
                              if (window.confirm(`Changer le rôle de ${u.prenom} ${u.nom} → ${ROLES_CONFIG[e.target.value]?.label} ?`))
                                updateRoleMut.mutate({ id:u.id, data:{ role:e.target.value } });
                            }}>
                            {Object.entries(ROLES_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                          </select>
                          {/* Reset mdp */}
                          <button className="btn btn-xs" style={{ background:'#FAEEDA', color:'#BA7517', border:'none', fontSize:10 }}
                            title="Réinitialiser mot de passe"
                            onClick={()=>{ if(window.confirm(`Réinitialiser le mot de passe de ${u.prenom} ${u.nom} ?`)) resetMut.mutate(u.id); }}>
                            <Key size={9}/> Reset
                          </button>
                          {/* Débloquer — visible seulement si compte verrouillé */}
                          {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                            <button className="btn btn-xs" style={{ background:'#EAF3DE', color:'#27500A', border:'none', fontSize:10 }}
                              title="Débloquer le compte immédiatement"
                              onClick={()=>{ if(window.confirm(`Débloquer immédiatement le compte de ${u.prenom} ${u.nom} ?`)) unlockMut.mutate(u.id); }}>
                              🔓 Débloquer
                            </button>
                          )}
                          {/* Activer/désactiver */}
                          <button className="btn btn-xs"
                            style={{ background:u.actif?'#FCEBEB':'#EAF3DE', color:u.actif?'#A32D2D':'#27500A', border:'none', fontSize:10 }}
                            disabled={u.id === currentUser?.id}
                            title={u.actif?'Désactiver':'Activer'}
                            onClick={()=>{
                              if (u.id === currentUser?.id) return;
                              if (u.actif) {
                                if (window.confirm(`Désactiver ${u.prenom} ${u.nom} ? Il ne pourra plus se connecter.`))
                                  desactiverMut.mutate(u.id);
                              } else {
                                updateRoleMut.mutate({ id:u.id, data:{ actif:true } });
                              }
                            }}>
                            {u.actif?<><Lock size={9}/> Désactiver</>:<><Unlock size={9}/> Activer</>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && (
                    <tr><td colSpan={7}><div className="empty-state"><p>Aucun utilisateur</p></div></td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Onglet Rôles & Permissions */}
      {onglet === 'roles' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {Object.entries(ROLES_CONFIG).map(([role, cfg])=>(
            <div key={role} style={{ background:'white', border:`1.5px solid ${cfg.color}30`, borderRadius:10, padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <BadgeRole role={role}/>
                  <div style={{ fontSize:11, color:'#888', marginTop:4 }}>{cfg.desc}</div>
                </div>
                <span style={{ fontSize:11, color:'#888' }}>
                  {list.filter(u=>u.role===role&&u.actif).length} actif(s)
                </span>
              </div>
              <div style={{ fontSize:10, color:'#555', fontWeight:600, marginBottom:4 }}>Permissions :</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                {(PERMISSIONS_PAR_ROLE[role]||['Accès de base']).map(p=>(
                  <span key={p} style={{ fontSize:9, background:cfg.bg, color:cfg.color, borderRadius:5, padding:'1px 6px' }}>✓ {p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Onglet Historisation */}
      {onglet === 'historisation' && (
        <div>
          <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>{logs.length} action(s) enregistrée(s)</div>
          <div className="card" style={{ padding:0, overflowX:'auto' }}>
            <table className="table-erp">
              <thead>
                <tr><th>Date/Heure</th><th>Utilisateur</th><th>Action</th><th>Module</th><th>Description</th><th>Filiale</th></tr>
              </thead>
              <tbody>
                {logs.map(l=>(
                  <tr key={l.id}>
                    <td style={{ fontSize:11, whiteSpace:'nowrap', color:'#888' }}>{fmtDate(l.createdAt)}</td>
                    <td style={{ fontSize:12, fontWeight:500 }}>{l.utilisateurNom}</td>
                    <td>
                      <span style={{ fontSize:10, background:{'CREATE':'#EAF3DE','DELETE':'#FCEBEB','UPDATE':'#FAEEDA','LOGIN':'#EEF3FB','PASSWORD_CHANGE':'#F7F7F5'}[l.action]||'#F7F7F5', color:{'CREATE':'#27500A','DELETE':'#A32D2D','UPDATE':'#BA7517','LOGIN':'#1a3f6f','PASSWORD_CHANGE':'#888'}[l.action]||'#888', borderRadius:6, padding:'1px 7px', fontWeight:500 }}>
                        {ACTION_LABELS[l.action]||l.action}
                      </span>
                    </td>
                    <td style={{ fontSize:11, color:'#888' }}>{l.entite}</td>
                    <td style={{ fontSize:11, maxWidth:250, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {l.entiteLabel||'—'}
                    </td>
                    <td style={{ fontSize:10, color:'#888' }}>{l.filiale?.replace('_',' ')}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6}><div className="empty-state"><p>Aucune action enregistrée</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal créer accès depuis employé */}
      {showCreerAcces && (
        <ModalCreerAcces
          employe={null}
          onClose={()=>setShowCreerAcces(false)}
          onSave={creerAccesMut.mutate}
          loading={creerAccesMut.isPending}
        />
      )}

      {/* Modal créer compte directement */}
      {showCreate && (
        <ModalNouveauCompte
          onClose={()=>setShowCreate(false)}
          onSave={createUserMut.mutate}
          loading={createUserMut.isPending}
        />
      )}

      {/* Résultat création/reset */}
      {resultatAcces && <ModalResultatAcces result={resultatAcces} onClose={()=>setResultatAcces(null)}/>}
      {resetResult && (
        <ModalResultatAcces
          result={resetResult}
          onClose={()=>setResetResult(null)}
        />
      )}

      {creerAccesDirect && (
        <ModalCreerAcces
          employe={creerAccesDirect}
          onClose={() => setCreerAccesDirect(null)}
          onSave={creerAccesMut.mutate}
          loading={creerAccesMut.isPending}
        />
      )}
      {toast && (
        <div style={{ position:'fixed', bottom:20, right:16, background:toast.t==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Modal nouveau compte direct ─────────────────────────────────────────────────
function ModalNouveauCompte({ onClose, onSave, loading }) {
  const [form, setForm] = useState({ prenom:'', nom:'', email:'', telephone:'', role:'EMPLOYE', filiale:'GROUPE', motDePasse:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const mdpAuto = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    set('motDePasse', Array.from({length:10},()=>chars[Math.floor(Math.random()*chars.length)]).join(''));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:500 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>👤 Nouveau compte ERP</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div className="form-grid">
          <div><label className="label">Prénom *</label><input className="input" value={form.prenom} onChange={e=>set('prenom',e.target.value)}/></div>
          <div><label className="label">Nom *</label><input className="input" value={form.nom} onChange={e=>set('nom',e.target.value)}/></div>
          <div><label className="label">Email * (identifiant)</label><input className="input" type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="prenom.nom@2ig.ci"/></div>
          <div><label className="label">Téléphone</label><input className="input" value={form.telephone} onChange={e=>set('telephone',e.target.value)}/></div>
          <div>
            <label className="label">Rôle *</label>
            <select className="input" value={form.role} onChange={e=>set('role',e.target.value)}>
              {Object.entries(ROLES_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Filiale *</label>
            <select className="input" value={form.filiale} onChange={e=>set('filiale',e.target.value)}>
              {FILIALES.map(f=><option key={f} value={f}>{f.replace('_',' ')}</option>)}
            </select>
          </div>
          <div className="full">
            <label className="label">Mot de passe temporaire *</label>
            <div style={{ display:'flex', gap:6 }}>
              <input className="input" style={{ flex:1, fontFamily:'monospace' }} value={form.motDePasse} onChange={e=>set('motDePasse',e.target.value)} placeholder="Min. 8 caractères"/>
              <button className="btn btn-ghost btn-sm" onClick={mdpAuto} type="button">🎲 Auto</button>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
            disabled={!form.prenom||!form.nom||!form.email||!form.motDePasse||loading}
            onClick={()=>onSave(form)}>
            {loading?'Création...':'Créer le compte'}
          </button>
        </div>
      </div>
    </div>
  );
}
