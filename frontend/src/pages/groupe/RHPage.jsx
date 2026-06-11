import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employesAPI } from '../../lib/api';
import { getDepartements, getPostes } from '../../lib/catalogue-rh';
import { useAuthStore } from '../../store';
import { Plus, Search, ChevronRight, X } from 'lucide-react';
import ExportBar from '../../components/ui/ExportBar';
import GEDPanel from '../../components/ui/GEDPanel';
import { exportExcel } from '../../lib/export';

const FILIALES_LABELS = { YAKRO_GRILL:'Yakro Grill', TOPTELSIG:'TOPTELSIG', LIYA:'LiYA', GROUPE:'Groupe' };
const FILIALES_COLORS = { YAKRO_GRILL:'#8B1A1A', TOPTELSIG:'#1a3f6f', LIYA:'#E85D04', GROUPE:'#444' };
const STATUT_BADGE = { ACTIF:'badge-green', CONGE:'badge-amber', SUSPENDU:'badge-red', DEMISSIONNAIRE:'badge-amber', QUITTE:'badge-gray' };

// ── Modal création ────────────────────────────────────────────────────────────
function ModalCreateEmploye({ onClose, onSave, loading }) {
  const { filiale: filialeConnexion } = useAuthStore();
  const [form, setForm] = useState({
    matricule:'', nom:'', prenom:'', telephone:'', email:'',
    filiale: filialeConnexion === 'GROUPE' ? 'YAKRO_GRILL' : filialeConnexion,
    departement:'', poste:'',
    dateEmbauche: new Date().toISOString().split('T')[0],
    salaireBase:'', adresse:'', numeroCni:'',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const depts = getDepartements(form.filiale);
  const postes = getPostes(form.filiale, form.departement);

  useEffect(() => {
    if (!form.filiale || !form.departement || form.matricule) return;
    const prefix = { YAKRO_GRILL:'YG', TOPTELSIG:'TOP', LIYA:'LIY', GROUPE:'GRP' }[form.filiale] || 'EMP';
    const deptCode = form.departement.slice(0,3).toUpperCase();
    const ts = Date.now().toString().slice(-4);
    set('matricule', `${prefix}-${deptCode}-${ts}`);
  }, [form.filiale, form.departement]);

  const isValid = form.matricule && form.nom && form.prenom && form.telephone && form.poste && form.filiale && form.salaireBase;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>👤 Nouvel employé</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div className="form-grid">
          <div>
            <label className="label">Filiale *</label>
            <select className="input" value={form.filiale} onChange={e => { set('filiale',e.target.value); set('departement',''); set('poste',''); set('matricule',''); }}>
              {Object.entries(FILIALES_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Département *</label>
            <select className="input" value={form.departement} onChange={e => { set('departement',e.target.value); set('poste',''); }}>
              <option value="">— Choisir —</option>
              {depts.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div className="full">
            <label className="label">Poste *</label>
            <select className="input" value={form.poste} onChange={e => set('poste',e.target.value)} disabled={!form.departement}>
              <option value="">— Choisir le département d'abord —</option>
              {postes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Matricule *</label>
            <input className="input" value={form.matricule} onChange={e => set('matricule',e.target.value)} placeholder="YG-CUI-0001"/>
          </div>
          <div><label className="label">Date d'embauche *</label><input className="input" type="date" value={form.dateEmbauche} onChange={e => set('dateEmbauche',e.target.value)}/></div>
          <div><label className="label">Prénom *</label><input className="input" value={form.prenom} onChange={e => set('prenom',e.target.value)}/></div>
          <div><label className="label">Nom *</label><input className="input" value={form.nom} onChange={e => set('nom',e.target.value)}/></div>
          <div><label className="label">Téléphone *</label><input className="input" value={form.telephone} onChange={e => set('telephone',e.target.value)}/></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => set('email',e.target.value)}/></div>
          <div className="full"><label className="label">Salaire de base (FCFA) *</label><input className="input" type="number" value={form.salaireBase} onChange={e => set('salaireBase',e.target.value)} placeholder="150000"/></div>
          <div className="full"><label className="label">Adresse</label><input className="input" value={form.adresse} onChange={e => set('adresse',e.target.value)}/></div>
          <div><label className="label">N° CNI</label><input className="input" value={form.numeroCni} onChange={e => set('numeroCni',e.target.value)}/></div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!isValid || loading}
            style={{ background:'#1a3f6f', border:'none' }}
            onClick={() => onSave({ ...form, salaireBase: Number(form.salaireBase) })}>
            {loading ? 'Création...' : "Créer l'employé"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal modification ────────────────────────────────────────────────────────
function ModalEditEmploye({ employe, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    nom: employe.nom||'', prenom: employe.prenom||'', telephone: employe.telephone||'',
    email: employe.email||'', poste: employe.poste||'', departement: employe.departement||'',
    filiale: employe.filiale||'YAKRO_GRILL', salaireBase: employe.salaireBase||'',
    adresse: employe.adresse||'', numeroCni: employe.numeroCni||'', statut: employe.statut||'ACTIF',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const depts = getDepartements(form.filiale);
  const postes = getPostes(form.filiale, form.departement);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>✏️ Modifier — {employe.prenom} {employe.nom}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}>✕</button>
        </div>
        <div className="form-grid">
          <div>
            <label className="label">Filiale</label>
            <select className="input" value={form.filiale} onChange={e => { set('filiale',e.target.value); set('departement',''); set('poste',''); }}>
              {Object.entries(FILIALES_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Département</label>
            <select className="input" value={form.departement} onChange={e => { set('departement',e.target.value); set('poste',''); }}>
              <option value="">— Choisir —</option>
              {depts.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div className="full">
            <label className="label">Poste</label>
            <select className="input" value={form.poste} onChange={e => set('poste',e.target.value)}>
              <option value="">{form.poste || '— Choisir —'}</option>
              {postes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div><label className="label">Prénom</label><input className="input" value={form.prenom} onChange={e => set('prenom',e.target.value)}/></div>
          <div><label className="label">Nom</label><input className="input" value={form.nom} onChange={e => set('nom',e.target.value)}/></div>
          <div><label className="label">Téléphone</label><input className="input" value={form.telephone} onChange={e => set('telephone',e.target.value)}/></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => set('email',e.target.value)}/></div>
          <div><label className="label">Salaire de base (FCFA)</label><input className="input" type="number" value={form.salaireBase} onChange={e => set('salaireBase',e.target.value)}/></div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={form.statut} onChange={e => set('statut',e.target.value)}>
              {['ACTIF','SUSPENDU','CONGE','QUITTE','DEMISSIONNAIRE'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="full"><label className="label">Adresse</label><input className="input" value={form.adresse} onChange={e => set('adresse',e.target.value)}/></div>
          <div><label className="label">N° CNI</label><input className="input" value={form.numeroCni} onChange={e => set('numeroCni',e.target.value)}/></div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={loading}
            style={{ background:'#1a3f6f', border:'none' }}
            onClick={() => onSave({ ...form, salaireBase: Number(form.salaireBase) })}>
            {loading ? 'Enregistrement...' : '✅ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fiche employé ─────────────────────────────────────────────────────────────
function EmployeDetail({ employe, onClose, onEdit, onSuspend, onReintegre, onQuitte }) {
  const [tab, setTab] = useState('info');
  if (!employe) return null;
  const color = FILIALES_COLORS[employe.filiale] || '#888';
  const tel = (employe.telephone||'').replace(/[\s\-+]/g,'').replace(/^0/,'225');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:640 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ width:42, height:42, borderRadius:'50%', background:color+'20', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne', fontWeight:700, color, fontSize:16 }}>
              {employe.prenom?.[0]}{employe.nom?.[0]}
            </div>
            <div>
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:16 }}>{employe.prenom} {employe.nom}</div>
              <div style={{ fontSize:12, color:'#888' }}>{employe.poste} · {employe.matricule}</div>
              <div style={{ display:'flex', gap:6, marginTop:6 }}>
                <a href={`tel:${employe.telephone}`} style={{ padding:'3px 10px', borderRadius:6, background:'#EAF3DE', color:'#27500A', textDecoration:'none', fontSize:11 }}>📞 Appeler</a>
                <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" style={{ padding:'3px 10px', borderRadius:6, background:'#FFF0EB', color:'#E85D04', textDecoration:'none', fontSize:11 }}>📱 WhatsApp</a>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <button onClick={() => { onClose(); onEdit(employe); }} style={{ padding:'5px 12px', borderRadius:7, border:'0.5px solid #1a3f6f', background:'#EEF3FB', color:'#1a3f6f', fontSize:11, cursor:'pointer' }}>✏️ Modifier</button>
            {employe.statut === 'ACTIF' && <button onClick={() => { if(confirm('Suspendre ?')) { onSuspend(employe.id); onClose(); } }} style={{ padding:'5px 12px', borderRadius:7, border:'0.5px solid #F7C1C1', background:'#FDF2F2', color:'#A32D2D', fontSize:11, cursor:'pointer' }}>⏸ Suspendre</button>}
            {employe.statut === 'SUSPENDU' && <button onClick={() => { onReintegre(employe.id); onClose(); }} style={{ padding:'5px 12px', borderRadius:7, border:'0.5px solid #C0DD97', background:'#EAF3DE', color:'#27500A', fontSize:11, cursor:'pointer' }}>✅ Réintégrer</button>}
            {employe.statut !== 'QUITTE' && <button onClick={() => { if(confirm('Enregistrer le départ ?')) { onQuitte(employe.id); onClose(); } }} style={{ padding:'5px 12px', borderRadius:7, border:'0.5px solid #e8e7e1', background:'white', color:'#888', fontSize:11, cursor:'pointer' }}>🚪 Départ</button>}
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', marginLeft:4 }}><X size={18}/></button>
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display:'flex', gap:2, marginBottom:20, borderBottom:'0.5px solid #e8e7e1' }}>
          {[['info','Infos'],['conges','Congés'],['avances','Avances'],['fiches','Paie'],['ged','📁 GED']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding:'6px 14px', border:'none', background:'none', cursor:'pointer', fontSize:12, fontWeight:tab===t?600:400, color:tab===t?'#1a1a1a':'#888', borderBottom:tab===t?`2px solid ${color}`:'2px solid transparent' }}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              ['Filiale', FILIALES_LABELS[employe.filiale]||employe.filiale],
              ['Département', employe.departement||'—'],
              ['Téléphone', employe.telephone],
              ['Email', employe.email||'—'],
              ['Date embauche', employe.dateEmbauche ? new Date(employe.dateEmbauche).toLocaleDateString('fr') : '—'],
              ['Salaire base', employe.salaireBase ? employe.salaireBase.toLocaleString('fr') + ' F' : '—'],
              ['Adresse', employe.adresse||'—'],
              ['Statut', employe.statut],
            ].map(([label,val]) => (
              <div key={label} style={{ background:'#F7F7F5', borderRadius:8, padding:'8px 12px' }}>
                <div style={{ fontSize:10, color:'#888', marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:13, fontWeight:500 }}>{val}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'conges' && (
          <div>
            {(!employe.conges || employe.conges.length === 0) && <div style={{ color:'#888', fontSize:13, padding:20, textAlign:'center' }}>Aucun congé</div>}
            {(employe.conges||[]).map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'0.5px solid #f0efe9' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{c.type}</div>
                  <div style={{ fontSize:11, color:'#888' }}>{new Date(c.dateDebut).toLocaleDateString('fr')} → {new Date(c.dateFin).toLocaleDateString('fr')}</div>
                </div>
                <span className={`badge ${c.statut==='APPROUVE'?'badge-green':c.statut==='REFUSE'?'badge-red':'badge-amber'}`}>{c.statut}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'avances' && (
          <div>
            {(!employe.avances || employe.avances.length === 0) && <div style={{ color:'#888', fontSize:13, padding:20, textAlign:'center' }}>Aucune avance</div>}
            {(employe.avances||[]).map(a => (
              <div key={a.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'0.5px solid #f0efe9' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{a.montant?.toLocaleString('fr')} F</div>
                  <div style={{ fontSize:11, color:'#888' }}>{new Date(a.createdAt).toLocaleDateString('fr')} · {a.motif||'—'}</div>
                </div>
                <span className={`badge ${a.statut==='APPROUVEE'?'badge-green':'badge-amber'}`}>{a.statut}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'fiches' && (
          <div style={{ color:'#888', fontSize:13, padding:20, textAlign:'center' }}>Fiches de paie — à venir</div>
        )}
        {tab === 'ged' && <GEDPanel entiteType="employe" entiteId={employe?.id}/>}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function RHPage() {
  const { filiale } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filialeFilter, setFilialeFilter] = useState(filiale === 'GROUPE' ? '' : filiale);
  const [statutFilter, setStatutFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showEdit, setShowEdit] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type='success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['employes', filialeFilter, search, statutFilter],
    queryFn: () => employesAPI.list({
      filiale: filialeFilter||undefined,
      search: search||undefined,
      statut: statutFilter||undefined,
      limit: 100,
    }),
    staleTime: 15000,
  });

  const { data: detail } = useQuery({
    queryKey: ['employe', selected?.id],
    queryFn: () => employesAPI.get(selected.id),
    enabled: !!selected?.id,
    staleTime: 30000,
  });

  const createMut = useMutation({
    mutationFn: employesAPI.create,
    onSuccess: () => { qc.invalidateQueries(['employes']); setShowCreate(false); showToast('Employé créé ✓'); },
    onError: e => showToast(e?.error||'Erreur création', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => employesAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['employes']); setShowEdit(null); showToast('Mis à jour ✓'); },
    onError: e => showToast(e?.error||'Erreur', 'error'),
  });

  const suspendMut = useMutation({
    mutationFn: id => employesAPI.update(id, { statut:'SUSPENDU' }),
    onSuccess: () => { qc.invalidateQueries(['employes']); showToast('Employé suspendu'); },
  });

  const reintegreMut = useMutation({
    mutationFn: id => employesAPI.update(id, { statut:'ACTIF' }),
    onSuccess: () => { qc.invalidateQueries(['employes']); showToast('Réintégré ✓'); },
  });

  const quitteMut = useMutation({
    mutationFn: id => employesAPI.update(id, { statut:'QUITTE' }),
    onSuccess: () => { qc.invalidateQueries(['employes']); showToast('Départ enregistré'); },
  });

  const employes = Array.isArray(data?.data) ? data.data : [];
  const total = data?.total || 0;
  const actifs = employes.filter(e => e.statut === 'ACTIF').length;

  const exportData = () => {
    exportExcel('employes_2ig', 'Employés',
      ['Prénom Nom','Poste','Filiale','Email','Téléphone','Salaire','Statut'],
      employes.map(e => [`${e.prenom} ${e.nom}`, e.poste||'—', FILIALES_LABELS[e.filiale]||e.filiale, e.email||'—', e.telephone||'—', e.salaireBase||0, e.statut])
    );
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontSize:20, fontFamily:'Syne', fontWeight:800 }}>👥 Ressources Humaines</h1>
          <div style={{ fontSize:12, color:'#888', marginTop:3 }}>{total} employés · {actifs} actifs</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <ExportBar onExcelClick={exportData} count={employes.length}/>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
            onClick={() => setShowCreate(true)}>
            <Plus size={14}/> Nouvel employé
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'Total effectif', value:total, color:'#1a3f6f' },
          { label:'Actifs', value:actifs, color:'#27500A' },
          { label:'En congé', value:employes.filter(e=>e.statut==='CONGE').length, color:'#BA7517' },
          { label:'Suspendus', value:employes.filter(e=>e.statut==='SUSPENDU').length, color:'#A32D2D' },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
            <div className="kpi-label">{k.label}</div>
            <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:22, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <div style={{ display:'flex', gap:8, background:'white', border:'0.5px solid #e8e7e1', borderRadius:8, padding:'6px 12px', flex:1 }}>
          <Search size={14} color="#888"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ border:'none', outline:'none', fontSize:13, flex:1 }}/>
        </div>
        {filiale === 'GROUPE' && (
          <select className="input" style={{ width:150 }} value={filialeFilter} onChange={e => setFilialeFilter(e.target.value)}>
            <option value="">Toutes filiales</option>
            {Object.entries(FILIALES_LABELS).filter(([k]) => k !== 'GROUPE').map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <select className="input" style={{ width:140 }} value={statutFilter} onChange={e => setStatutFilter(e.target.value)}>
          <option value="">Tous statuts</option>
          {['ACTIF','CONGE','SUSPENDU','DEMISSIONNAIRE','QUITTE'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Tableau */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {isLoading ? (
          <div style={{ padding:40, textAlign:'center', color:'#888' }}>Chargement...</div>
        ) : (
          <table className="table-erp">
            <thead>
              <tr><th>Employé</th><th>Poste</th><th>Filiale</th><th>Contact</th><th>Embauche</th><th>Salaire</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {employes.map(e => (
                <tr key={e.id} style={{ cursor:'pointer' }} onClick={() => setSelected(e)}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:(FILIALES_COLORS[e.filiale]||'#888')+'20', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:FILIALES_COLORS[e.filiale] }}>
                        {e.prenom?.[0]}{e.nom?.[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight:500, fontSize:13 }}>{e.prenom} {e.nom}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{e.matricule}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize:13 }}>{e.poste}</td>
                  <td><span className={`badge badge-${e.filiale==='YAKRO_GRILL'?'yakro':e.filiale==='LIYA'?'liya':'toptelsig'}`}>{FILIALES_LABELS[e.filiale]||e.filiale}</span></td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
                      <span style={{ color:'#666' }}>{e.telephone}</span>
                      <a href={`tel:${e.telephone}`} onClick={ev => ev.stopPropagation()} style={{ fontSize:13 }}>📞</a>
                      <a href={`https://wa.me/${(e.telephone||'').replace(/[\s\-+]/g,'').replace(/^0/,'225')}`} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} style={{ fontSize:13 }}>📱</a>
                    </div>
                  </td>
                  <td style={{ fontSize:12, color:'#888' }}>{e.dateEmbauche ? new Date(e.dateEmbauche).toLocaleDateString('fr') : '—'}</td>
                  <td style={{ fontSize:13 }}>{e.salaireBase?.toLocaleString('fr')} F</td>
                  <td><span className={`badge ${STATUT_BADGE[e.statut]||'badge-gray'}`}>{e.statut}</span></td>
                  <td><ChevronRight size={14} color="#ccc"/></td>
                </tr>
              ))}
              {employes.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state"><p>Aucun employé trouvé</p></div></td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <ModalCreateEmploye
          onClose={() => setShowCreate(false)}
          onSave={d => createMut.mutate(d)}
          loading={createMut.isPending}
        />
      )}

      {selected && (
        <EmployeDetail
          employe={detail || selected}
          onClose={() => setSelected(null)}
          onEdit={e => { setSelected(null); setShowEdit(e); }}
          onSuspend={id => suspendMut.mutate(id)}
          onReintegre={id => reintegreMut.mutate(id)}
          onQuitte={id => quitteMut.mutate(id)}
        />
      )}

      {showEdit && (
        <ModalEditEmploye
          employe={showEdit}
          onClose={() => setShowEdit(null)}
          onSave={d => updateMut.mutate({ id:showEdit.id, data:d })}
          loading={updateMut.isPending}
        />
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:20, right:16, background:toast.type==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
