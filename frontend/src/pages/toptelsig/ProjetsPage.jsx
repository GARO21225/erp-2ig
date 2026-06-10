import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI } from '../../lib/api';
import { Plus, X, MapPin, Download, Upload, Search } from 'lucide-react';
import ImportButton from '../../components/ui/ImportButton';
import ExportBar from '../../components/ui/ExportBar';
import TemplateButton from '../../components/ui/TemplateButton';
import { exportExcel, exportPDF } from '../../lib/export';
import CarteProjetsCi from '../../components/ui/CarteProjetsCi';
import { VILLES_CI, LOCALISATIONS_CI } from '../../lib/catalogue-rh';

const STATUTS = { EN_COURS:'badge-blue', TERMINE:'badge-green', SUSPENDU:'badge-amber', ANNULE:'badge-red' };

// Combobox ville avec saisie libre + suggestions
function ComboboxVille({ value, onChange, placeholder = 'Choisir ou saisir...' }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const filtered = VILLES_CI.filter(v => v.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  const handleSelect = (v) => { setQuery(v); onChange(v); setOpen(false); };
  const handleChange = (e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); };

  return (
    <div style={{ position: 'relative' }}>
      <input className="input" value={query} onChange={handleChange}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder} />
      {open && filtered.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'white', border:'0.5px solid #e8e7e1', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.1)', maxHeight:200, overflowY:'auto' }}>
          {filtered.map(v => (
            <div key={v} onMouseDown={() => handleSelect(v)}
              style={{ padding:'8px 12px', cursor:'pointer', fontSize:13 }}
              onMouseEnter={e => e.target.style.background='#F1EFE8'}
              onMouseLeave={e => e.target.style.background='transparent'}>{v}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// Combobox localisation filtrée par ville
function ComboboxLocalisation({ value, onChange, ville }) {
  const suggestions = ville && LOCALISATIONS_CI[ville] ? LOCALISATIONS_CI[ville] : [];
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter(l => l.toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  const handleSelect = (v) => { setQuery(v); onChange(v); setOpen(false); };
  const handleChange = (e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); };

  return (
    <div style={{ position:'relative' }}>
      <input className="input" value={query} onChange={handleChange}
        onFocus={() => filtered.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={ville ? `Localisation à ${ville}...` : 'Localisation (saisie libre)'} />
      {open && filtered.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'white', border:'0.5px solid #e8e7e1', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.1)', maxHeight:180, overflowY:'auto' }}>
          {filtered.map(l => (
            <div key={l} onMouseDown={() => handleSelect(l)}
              style={{ padding:'8px 12px', cursor:'pointer', fontSize:13 }}
              onMouseEnter={e => e.target.style.background='#F1EFE8'}
              onMouseLeave={e => e.target.style.background='transparent'}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// Générer un code projet automatique
function genCode(nom, ville) {
  const year = new Date().getFullYear().toString().slice(-2);
  const n = (nom || 'PRJ').slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const v = (ville || 'CI').slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'X');
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${n}-${v}${year}-${rand}`;
}

function ModalProjet({ projet, onClose, onSave, loading }) {
  const isEdit = !!projet;
  const [form, setForm] = useState({
    code: projet?.code || '',
    nom: projet?.nom || '',
    ville: projet?.ville || '',
    localisation: projet?.localisation || '',
    superficie: projet?.superficie || '',
    nombreLots: projet?.nombreLots || '',
    prixLotMin: projet?.prixLotMin || '',
    prixLotMax: projet?.prixLotMax || '',
    description: projet?.description || '',
    statut: projet?.statut || 'EN_COURS',
    latitude: projet?.latitude || '',
    longitude: projet?.longitude || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-générer le code quand nom ou ville change
  const handleVilleChange = (v) => {
    set('ville', v);
    set('localisation', ''); // reset localisation
    if (!isEdit && !form.code) set('code', genCode(form.nom, v));
  };
  const handleNomChange = (e) => {
    set('nom', e.target.value);
    if (!isEdit && !form.code) set('code', genCode(e.target.value, form.ville));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:600 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>
            {isEdit ? 'Modifier le projet' : 'Nouveau projet foncier'}
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>

        <div className="form-grid">
          <div>
            <label className="label">Code projet *</label>
            <div style={{ display:'flex', gap:6 }}>
              <input className="input" value={form.code} onChange={e => set('code', e.target.value)} placeholder="Ex: YAM-AB24-001" style={{ flex:1 }} />
              <button type="button" onClick={() => set('code', genCode(form.nom, form.ville))}
                style={{ padding:'0 10px', background:'#EEF3FB', border:'none', borderRadius:7, cursor:'pointer', fontSize:11, color:'#1a3f6f', whiteSpace:'nowrap' }}>
                🔄 Auto
              </button>
            </div>
          </div>
          <div>
            <label className="label">Nom du projet *</label>
            <input className="input" value={form.nom} onChange={handleNomChange} placeholder="Ex: Résidence Les Palmiers" />
          </div>

          <div>
            <label className="label">Ville *</label>
            <ComboboxVille value={form.ville} onChange={handleVilleChange} />
          </div>
          <div>
            <label className="label">Localisation / Quartier</label>
            <ComboboxLocalisation value={form.localisation} onChange={v => set('localisation', v)} ville={form.ville} />
          </div>

          <div>
            <label className="label">Superficie (m²) *</label>
            <input className="input" type="number" value={form.superficie} onChange={e => set('superficie', e.target.value)} />
          </div>
          <div>
            <label className="label">Nombre de lots *</label>
            <input className="input" type="number" value={form.nombreLots} onChange={e => set('nombreLots', e.target.value)} />
          </div>

          <div>
            <label className="label">Prix lot min (FCFA)</label>
            <input className="input" type="number" value={form.prixLotMin} onChange={e => set('prixLotMin', e.target.value)} />
          </div>
          <div>
            <label className="label">Prix lot max (FCFA)</label>
            <input className="input" type="number" value={form.prixLotMax} onChange={e => set('prixLotMax', e.target.value)} />
          </div>

          <div>
            <label className="label">Latitude (GPS)</label>
            <input className="input" type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="Ex: 5.3600" />
          </div>
          <div>
            <label className="label">Longitude (GPS)</label>
            <input className="input" type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="Ex: -4.0083" />
          </div>

          <div className="full">
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} style={{ resize:'vertical' }} />
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={loading || !form.code || !form.nom}
            onClick={() => onSave({
              ...form,
              superficie: Number(form.superficie), nombreLots: Number(form.nombreLots),
              prixLotMin: Number(form.prixLotMin) || 0, prixLotMax: Number(form.prixLotMax) || 0,
              latitude: form.latitude ? Number(form.latitude) : null,
              longitude: form.longitude ? Number(form.longitude) : null,
            })}>
            {loading ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── LotsPanel : liste + CRUD des lots d'un projet ──────────────────────────
function LotsPanel({ projet }) {
  const qc = useQueryClient();
  const [editLot, setEditLot] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newLot, setNewLot] = useState({ numero: '', ilot: '', superficie: '', prix: '' });

  const { data: lots = [] } = useQuery({
    queryKey: ['lots-projet', projet?.id],
    queryFn: () => toptelsigAPI.lotsProjet(projet.id),
    enabled: !!projet?.id,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => toptelsigAPI.updateLot(id, data),
    onSuccess: () => { qc.invalidateQueries(['lots-projet', projet.id]); setEditLot(null); }
  });
  const deleteMut = useMutation({
    mutationFn: toptelsigAPI.deleteLot,
    onSuccess: () => qc.invalidateQueries(['lots-projet', projet.id]),
    onError: (e) => alert(e?.error || e.message),
  });
  const createMut = useMutation({
    mutationFn: (data) => toptelsigAPI.createLot(data),
    onSuccess: () => { qc.invalidateQueries(['lots-projet', projet.id]); setShowAdd(false); setNewLot({ numero: '', ilot: '', superficie: '', prix: '' }); }
  });

  const STATUT_COLORS = { DISPONIBLE: '#27500A', RESERVE: '#BA7517', VENDU: '#A32D2D', LITIGE: '#888', ANNULE: '#888' };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>📦 Lots ({lots.length})</span>
        <button className="btn btn-ghost btn-xs" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={11} /> Ajouter lot
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#F7F7F5', borderRadius: 8, padding: 10, marginBottom: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
          <div><label className="label" style={{ fontSize: 10 }}>N° lot</label><input className="input" style={{ fontSize: 12 }} value={newLot.numero} onChange={e => setNewLot(f => ({...f, numero: e.target.value}))} placeholder="A-001" /></div>
          <div><label className="label" style={{ fontSize: 10 }}>Îlot</label><input className="input" style={{ fontSize: 12 }} value={newLot.ilot} onChange={e => setNewLot(f => ({...f, ilot: e.target.value}))} placeholder="A" /></div>
          <div><label className="label" style={{ fontSize: 10 }}>Superficie m²</label><input className="input" type="number" style={{ fontSize: 12 }} value={newLot.superficie} onChange={e => setNewLot(f => ({...f, superficie: e.target.value}))} /></div>
          <div><label className="label" style={{ fontSize: 10 }}>Prix FCFA</label><input className="input" type="number" style={{ fontSize: 12 }} value={newLot.prix} onChange={e => setNewLot(f => ({...f, prix: e.target.value}))} /></div>
          <button className="btn btn-primary btn-xs" style={{ background: '#1a3f6f' }}
            disabled={!newLot.numero || !newLot.superficie || !newLot.prix || createMut.isPending}
            onClick={() => createMut.mutate({ projetId: projet.id, numero: newLot.numero, ilot: newLot.ilot || null, superficie: Number(newLot.superficie), prix: Number(newLot.prix) })}>
            ✓
          </button>
        </div>
      )}

      {lots.length > 0 && (
        <div className="table-container">
          <table className="table-erp" style={{ fontSize: 11 }}>
            <thead><tr><th>N° Lot</th><th>Îlot</th><th>Superficie</th><th>Prix FCFA</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {lots.slice(0, 50).map(l => (
                <tr key={l.id}>
                  {editLot?.id === l.id ? (
                    <>
                      <td><input className="input" style={{ fontSize: 11, padding: '3px 6px' }} defaultValue={l.numero} onChange={e => setEditLot(f => ({...f, numero: e.target.value}))} /></td>
                      <td><input className="input" style={{ fontSize: 11, padding: '3px 6px' }} defaultValue={l.ilot || ''} onChange={e => setEditLot(f => ({...f, ilot: e.target.value}))} /></td>
                      <td><input className="input" type="number" style={{ fontSize: 11, padding: '3px 6px' }} defaultValue={l.superficie} onChange={e => setEditLot(f => ({...f, superficie: e.target.value}))} /></td>
                      <td><input className="input" type="number" style={{ fontSize: 11, padding: '3px 6px' }} defaultValue={l.prix} onChange={e => setEditLot(f => ({...f, prix: e.target.value}))} /></td>
                      <td><select className="input" style={{ fontSize: 11, padding: '3px 6px' }} value={editLot.statut || l.statut} onChange={e => setEditLot(f => ({...f, statut: e.target.value}))}>
                        {['DISPONIBLE','RESERVE','LITIGE','ANNULE'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select></td>
                      <td style={{ display: 'flex', gap: 3 }}>
                        <button className="btn btn-primary btn-xs" onClick={() => updateMut.mutate({ id: l.id, data: editLot })}>✓</button>
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditLot(null)}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 600 }}>{l.numero}</td>
                      <td style={{ color: '#888' }}>{l.ilot || '—'}</td>
                      <td>{l.superficie ? l.superficie.toLocaleString('fr') : '—'}</td>
                      <td style={{ fontWeight: 600, color:'#1a3f6f' }}>{l.prix ? l.prix.toLocaleString('fr') + ' F' : '—'}</td>
                      <td style={{ fontSize:10, color:'#888' }}>{l.superficie && l.prix ? Math.round(l.prix/l.superficie).toLocaleString('fr') + ' F/m²' : '—'}</td>
                      <td><span className="badge" style={{ fontSize: 10, color: STATUT_COLORS[l.statut], background: STATUT_COLORS[l.statut]+'18' }}>{l.statut}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 3 }}>
                          <button className="btn btn-ghost btn-xs" onClick={() => setEditLot({...l})} title="Modifier"><Edit2 size={10} /></button>
                          {l.statut !== 'VENDU' && (
                            <button className="btn btn-ghost btn-xs" style={{ color: '#A32D2D' }}
                              onClick={() => { if(confirm(`Supprimer Lot ${l.numero} ?`)) deleteMut.mutate(l.id); }}
                              title="Supprimer"><Trash2 size={10} /></button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {lots.length > 50 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#888', fontSize: 10 }}>{lots.length - 50} lots supplémentaires — utiliser l'export Excel</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ProjetsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editProjet, setEditProjet] = useState(null);
  const [projetOuvert, setProjetOuvert] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const { data: projets = [] } = useQuery({ queryKey:['projets'], queryFn: toptelsigAPI.projets });

  const createMut = useMutation({
    mutationFn: toptelsigAPI.createProjet,
    onSuccess: () => { qc.invalidateQueries(['projets']); setShowCreate(false); showToast('Projet créé'); },
    onError: e => showToast(e?.error || e?.message || 'Erreur', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => toptelsigAPI.updateProjet(id, data),
    onSuccess: () => { qc.invalidateQueries(['projets']); setEditProjet(null); showToast('Projet mis à jour'); },
    onError: e => showToast(e?.error || 'Erreur', 'error'),
  });

  // Export Excel
  const handleExportExcel = () => {
    const entetes = ['Code','Nom','Ville','Localisation','Superficie (m²)','Nb lots','Prix min','Prix max','Statut'];
    const lignes = projets.map(p => [p.code, p.nom, p.ville, p.localisation||'', p.superficie, p.nombreLots, p.prixLotMin, p.prixLotMax, p.statut]);
    exportExcel('projets_fonciers', 'Projets', entetes, lignes);
  };

  const listeProjets = Array.isArray(projets) ? projets : [];

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20 }}>Projets Fonciers</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            {listeProjets.length} projet(s) · {listeProjets.filter(p=>p.statut==='EN_COURS').length} actif(s)
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <ExportBar onExcelClick={handleExportExcel} />
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> Nouveau projet
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid-kpi" style={{ marginBottom:20 }}>
        {[
          { label:'Projets actifs', value: listeProjets.filter(p=>p.statut==='EN_COURS').length },
          { label:'Total lots', value: listeProjets.reduce((s,p)=>s+(p._count?.lots||0),0).toLocaleString('fr') },
          { label:'Lots disponibles', value: listeProjets.reduce((s,p)=>s+(p.statsLots?.DISPONIBLE||0),0).toLocaleString('fr') },
          { label:'Lots vendus', value: listeProjets.reduce((s,p)=>s+(p.statsLots?.VENDU||0),0).toLocaleString('fr') },
          { label:'En réserve', value: listeProjets.reduce((s,p)=>s+(p.statsLots?.RESERVE||0),0).toLocaleString('fr') },
          { label:'Villes couvertes', value: [...new Set(listeProjets.map(p=>p.ville))].filter(Boolean).length },
        ].map((k,i) => (
          <div key={i} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize:22 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Carte Côte d'Ivoire */}
      <div className="card" style={{ marginBottom: 20 }}>
        <CarteProjetsCi projets={listeProjets} />
      </div>

      {/* Liste projets */}
      {listeProjets.length === 0 ? (
        <div className="card empty-state"><MapPin size={40} /><p>Aucun projet — créez votre premier projet foncier</p></div>
      ) : (
        <div className="grid-3">
          {listeProjets.map(p => (
            <div key={p.id} className="card" style={{ cursor:'pointer', borderTop:`3px solid #1a3f6f` }}
              onClick={() => setProjetOuvert(p.id === projetOuvert ? null : p.id)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14 }}>{p.nom}</div>
                  <div style={{ fontSize:11, color:'#888' }}>{p.code}</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
                    <MapPin size={10} style={{ verticalAlign:'middle', marginRight:3 }} />
                    {p.ville}{p.localisation ? ` · ${p.localisation}` : ''}
                  </div>
                </div>
                <span className={`badge ${STATUTS[p.statut]||'badge-gray'}`}>{p.statut}</span>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:10 }}>
                {[
                  { label:'Total', value: p._count?.lots || 0 },
                  { label:'Disponibles', value: p.statsLots?.DISPONIBLE||0, color:'#27500A' },
                  { label:'Vendus', value: p.statsLots?.VENDU||0, color:'#A32D2D' },
                  { label:'Prix min', value: p.prixLotMin>=1000000 ? `${(p.prixLotMin/1000000).toFixed(1)}M` : `${Math.round(p.prixLotMin/1000)}k` },
                ].map((m,i) => (
                  <div key={i} style={{ background:'#F7F7F5', borderRadius:6, padding:'5px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:9, color:'#888' }}>{m.label}</div>
                    <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, color:m.color||'#1a1a1a' }}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); setEditProjet(p); }}>✏️ Modifier</button>
                <select style={{ fontSize:10, padding:'3px 6px', borderRadius:6, border:'0.5px solid #ddd', cursor:'pointer' }}
                  value={p.statut} onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); updateMut.mutate({ id:p.id, data:{ statut:e.target.value } }); }}>
                  {['EN_COURS','PLANIFIE','SUSPENDU','TERMINE','ARCHIVE'].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Panneau import lots */}
              {projetOuvert === p.id && (
                <div style={{ marginTop:12, borderTop:'0.5px solid #e8e7e1', paddingTop:12 }} onClick={e=>e.stopPropagation()}>
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>📦 Import lots Excel :</span>
                    <TemplateButton url={`/toptelsig/lots/template?projetId=${p.id}`} label="Template lots" />
                    <ImportButton
                      onData={({ lignes, entetes }) => {
                        const token = JSON.parse(localStorage.getItem('2ig-auth')||'{}')?.state?.token;
                        const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
                        // Reconstruire en CSV et envoyer
                        const csv = '\uFEFF' + [entetes, ...lignes].map(r=>r.join(';')).join('\r\n');
                        const fd = new FormData();
                        fd.append('fichier', new Blob([csv], {type:'text/csv'}), 'lots.csv');
                        fd.append('projetId', p.id);
                        fetch(`${base}/toptelsig/lots/import`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd })
                          .then(r=>r.json()).then(d => { showToast(`${d.imported} lot(s) importé(s)`); qc.invalidateQueries(['lots']); })
                          .catch(()=>showToast('Erreur import','error'));
                      }}
                      label="Importer lots" color="#1a3f6f" />
                  </div>
                </div>
              )}
              {/* Liste des lots avec CRUD */}
              {projetOuvert === p.id && <LotsPanel projet={p} />}
            </div>
          ))}
        </div>
      )}

      {showCreate && <ModalProjet onClose={() => setShowCreate(false)} onSave={d => createMut.mutate(d)} loading={createMut.isPending} />}
      {editProjet && <ModalProjet projet={editProjet} onClose={() => setEditProjet(null)} onSave={d => updateMut.mutate({ id: editProjet.id, data: d })} loading={updateMut.isPending} />}
      {toast && <div style={{ position:'fixed', bottom:20, right:16, background:toast.type==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>{toast.msg}</div>}
    </div>
  );
}
