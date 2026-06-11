/**
 * TOPTELSIG — CRM Commercial
 * CRM = Prospects SANS paiement
 * Les clients convertis sont dans Souscripteurs
 */
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI, employesAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Plus, X, ChevronRight, AlertTriangle, Upload, Home } from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────
const CANAUX = [
  { key:'appel',           label:'📞 Appel téléphonique', color:'#1a3f6f' },
  { key:'whatsapp',        label:'💬 WhatsApp',           color:'#25D366' },
  { key:'sms',             label:'📱 SMS',                color:'#E87722' },
  { key:'email',           label:'📧 Email',              color:'#1a3f6f' },
  { key:'visite',          label:'🤝 Visite bureau',      color:'#8B1A1A' },
  { key:'recommandation',  label:'⭐ Recommandation',     color:'#BA7517' },
];
const RESULTATS = [
  { key:'interesse',     label:'Intéressé',           color:'#1a3f6f' },
  { key:'pas_interesse', label:'Pas intéressé',       color:'#888'    },
  { key:'rappeler',      label:'Rappeler',             color:'#BA7517' },
  { key:'converti',      label:'🎉 Converti en client',color:'#27500A' },
  { key:'perdu',         label:'❌ Perdu',             color:'#A32D2D' },
];
const PIPELINE_COLORS = {
  PROSPECT:'#888', CONTACTE:'#BA7517', INTERESSE:'#1a3f6f',
  NEGOCIE:'#E87722', RESERVE:'#27500A', PERDU:'#A32D2D'
};
const SOURCES = ['Facebook','WhatsApp','Référence','Site Web','Affichage','Prospection terrain','Partenaire','Autre'];
const PIE_COLORS = ['#1a3f6f','#25D366','#E87722','#8B1A1A','#0A66C2','#BA7517'];

const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(1)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${n||0} F`;

// ── Modal proposer un lot ─────────────────────────────────────────────────────
function ModalProposerLot({ prospect, onClose, onSave, loading }) {
  const [projetId, setProjetId] = useState('');
  const [lotId, setLotId] = useState('');
  const [notes, setNotes] = useState('');

  const { data: projets = [] } = useQuery({
    queryKey: ['projets'],
    queryFn: toptelsigAPI.projets,
    staleTime: 300000,
  });

  const { data: projetData } = useQuery({
    queryKey: ['projet-complet', projetId],
    queryFn: () => toptelsigAPI.projetComplet(projetId),
    enabled: !!projetId,
    staleTime: 60000,
  });

  const listeProjets = Array.isArray(projets) ? projets : [];
  const lotsDisponibles = (projetData?.lots || []).filter(l => l.statut === 'DISPONIBLE');
  const lotChoisi = lotsDisponibles.find(l => l.id === lotId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16, color:'#1a3f6f' }}>
            🏘 Proposer un lot — {prospect.prenom} {prospect.nom}
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>

        <div style={{ background:'#EEF3FB', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#1a3f6f' }}>
          ℹ Une réservation sera créée. Le lot passera au statut <strong>RÉSERVÉ</strong>.
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label className="label">Projet *</label>
            <select className="input" value={projetId} onChange={e => { setProjetId(e.target.value); setLotId(''); }}>
              <option value="">— Sélectionner un projet</option>
              {listeProjets.map(p => <option key={p.id} value={p.id}>{p.nom} — {p.code}</option>)}
            </select>
          </div>

          {projetId && (
            <div>
              <label className="label">Lot disponible *</label>
              {lotsDisponibles.length === 0 ? (
                <div style={{ padding:'10px', background:'#FCEBEB', borderRadius:8, fontSize:12, color:'#A32D2D' }}>
                  ⚠ Aucun lot disponible dans ce projet
                </div>
              ) : (
                <select className="input" value={lotId} onChange={e => setLotId(e.target.value)}>
                  <option value="">— Sélectionner un lot</option>
                  {lotsDisponibles.map(l => (
                    <option key={l.id} value={l.id}>
                      Lot {l.numero}{l.ilot ? ` — Îlot ${l.ilot}` : ''} · {(l.superficie||0).toLocaleString('fr')} m² · {fmtF(l.prix)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {lotChoisi && (
            <div style={{ background:'#F7F7F5', borderRadius:8, padding:'12px 14px', fontSize:12 }}>
              <div style={{ fontWeight:700, marginBottom:6, color:'#1a3f6f' }}>Récapitulatif lot choisi</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div><span style={{ color:'#888' }}>Numéro : </span><strong>Lot {lotChoisi.numero}</strong></div>
                <div><span style={{ color:'#888' }}>Superficie : </span><strong>{(lotChoisi.superficie||0).toLocaleString('fr')} m²</strong></div>
                <div><span style={{ color:'#888' }}>Prix : </span><strong style={{ color:'#1a3f6f' }}>{fmtF(lotChoisi.prix)}</strong></div>
                {lotChoisi.ilot && <div><span style={{ color:'#888' }}>Îlot : </span><strong>{lotChoisi.ilot}</strong></div>}
              </div>
            </div>
          )}

          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Conditions particulières, préférences client..."
              style={{ resize:'vertical' }}/>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
            disabled={!projetId || !lotId || loading}
            onClick={() => onSave({ souscripteurId: prospect.id, lotId, notes })}>
            {loading ? '...' : '✓ Créer la réservation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal relance ─────────────────────────────────────────────────────────────
function ModalRelance({ prospect, onClose, onSave, loading }) {
  const [form, setForm] = useState({ canal:'appel', resultat:'', notes:'', prochain:'', dureeMin:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>📞 Relance — {prospect.prenom} {prospect.nom}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div className="form-grid">
          <div className="full">
            <label className="label">Canal *</label>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {CANAUX.map(c => (
                <button key={c.key} type="button" onClick={() => set('canal', c.key)}
                  style={{ padding:'5px 10px', borderRadius:16, border:`1.5px solid ${form.canal===c.key?c.color:'#e8e7e1'}`, background:form.canal===c.key?c.color+'18':'white', color:form.canal===c.key?c.color:'#666', fontSize:11, cursor:'pointer' }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Résultat</label>
            <select className="input" value={form.resultat} onChange={e=>set('resultat',e.target.value)}>
              <option value="">— Sélectionner —</option>
              {RESULTATS.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div><label className="label">Durée (min)</label><input className="input" type="number" value={form.dureeMin} onChange={e=>set('dureeMin',e.target.value)} placeholder="15"/></div>
          <div className="full">
            <label className="label">Notes *</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Résumé de l'échange..."
              style={{ width:'100%', padding:'8px 10px', border:'0.5px solid #e8e7e1', borderRadius:8, fontSize:12, resize:'vertical', minHeight:60, fontFamily:'inherit', boxSizing:'border-box' }}/>
          </div>
          {form.resultat === 'rappeler' && (
            <div className="full"><label className="label">Prochaine relance</label><input className="input" type="datetime-local" value={form.prochain} onChange={e=>set('prochain',e.target.value)}/></div>
          )}
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!form.canal||!form.notes||loading}
            style={{ background:'#1a3f6f', border:'none' }}
            onClick={() => onSave(form)}>
            {loading ? '...' : '✅ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal import ──────────────────────────────────────────────────────────────
function ModalImport({ onClose, onSave, loading }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [erreur, setErreur] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      const headers = data[0].map(h => String(h).toLowerCase().trim());
      const parsed = data.slice(1).filter(r=>r.some(c=>c)).map(row => {
        const get = (k) => row[headers.indexOf(k)] || '';
        return { prenom:String(get('prenom')), nom:String(get('nom')), telephone:String(get('telephone')), email:String(get('email')||''), sourceAcquisition:String(get('source')||''), commercialNom:String(get('commercial_nom')||''), statut:'PROSPECT' };
      }).filter(r=>r.prenom&&r.nom&&r.telephone);
      setRows(parsed);
      setErreur(parsed.length===0?'Aucune ligne valide (colonnes: prenom, nom, telephone requis)':'');
    } catch(err) { setErreur(err.message); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>📤 Import prospects</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div style={{ background:'#F7F7F5', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:11, color:'#888' }}>
          Colonnes Excel : <strong>prenom</strong>, <strong>nom</strong>, <strong>telephone</strong>, email, source, commercial_nom
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={handleFile}/>
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => fileRef.current?.click()}>
            <Upload size={13}/> Choisir un fichier
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color:'#1a3f6f' }}
            onClick={async () => {
              try {
                const blob = await toptelsigAPI.crmTemplateImport();
                const url = URL.createObjectURL(new Blob([blob]));
                const a = document.createElement('a'); a.href=url; a.download='template_prospects_crm.csv'; a.click();
                URL.revokeObjectURL(url);
              } catch { alert('Erreur template'); }
            }}>
            📥 Template
          </button>
        </div>
        {erreur && <div style={{ color:'#A32D2D', fontSize:12, marginBottom:8 }}>{erreur}</div>}
        {rows.length > 0 && <div style={{ background:'#EAF3DE', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#27500A', marginBottom:12 }}>✅ {rows.length} prospect(s) prêts</div>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={rows.length===0||loading}
            style={{ background:'#1a3f6f', border:'none' }} onClick={() => onSave(rows)}>
            {loading?'Import...':'Importer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────────────────
export default function CRMPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [view, setView] = useState('liste');
  const [statutFilter, setStatutFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [relanceFor, setRelanceFor] = useState(null);
  const [proposerFor, setProposerFor] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg, t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3000); };

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ['crm-prospects', statutFilter, search],
    queryFn: () => toptelsigAPI.crmProspects({ statut:statutFilter||undefined, search:search||undefined }),
    staleTime: 15000,
  });

  const { data: dashboard } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: toptelsigAPI.crmDashboard,
    staleTime: 60000,
  });

  const { data: commerciaux = [] } = useQuery({
    queryKey: ['commerciaux-toptelsig'],
    queryFn: () => employesAPI.list({ filiale:'TOPTELSIG', statut:'ACTIF', limit:50 }),
    staleTime: 300000,
  });
  const listeCommerciaux = Array.isArray(commerciaux) ? commerciaux : (commerciaux?.data || []);

  const addRelance = useMutation({
    mutationFn: ({ id, data }) => toptelsigAPI.crmAddRelance(id, data),
    onSuccess: (res) => {
      qc.invalidateQueries(['crm-prospects']);
      setRelanceFor(null);
      showToast('Relance enregistrée ✓');
      if (res?.souscripteurConverti) {
        showToast('🎉 Prospect converti en souscripteur !');
        navigate('/toptelsig/souscripteurs');
      }
    },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const proposerLot = useMutation({
    mutationFn: toptelsigAPI.crmProposerLot,
    onSuccess: (r) => {
      qc.invalidateQueries(['crm-prospects']);
      setProposerFor(null);
      showToast(`✓ Lot ${r.lot?.numero} réservé pour ${proposerFor?.prenom} ${proposerFor?.nom}`);
    },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const createProspect = useMutation({
    mutationFn: toptelsigAPI.createSouscripteur,
    onSuccess: () => { qc.invalidateQueries(['crm-prospects']); setShowCreate(false); showToast('Prospect créé ✓'); },
    onError: e => showToast(e?.error||'Erreur','error'),
  });

  const importProspects = useMutation({
    mutationFn: async (rows) => {
      let ok = 0;
      for (const row of rows) {
        try { await toptelsigAPI.createSouscripteur({ ...row, code:`IMP-${Date.now().toString(36).toUpperCase().slice(-4)}` }); ok++; } catch {}
      }
      return ok;
    },
    onSuccess: ok => { qc.invalidateQueries(['crm-prospects']); setShowImport(false); showToast(`${ok} prospect(s) importés ✓`); },
  });

  const list = Array.isArray(prospects) ? prospects : [];
  const kpi = dashboard?.kpi || {};
  const alertes = dashboard?.alertesRelance || [];

  const STATUTS_FILTRE = [
    ['','Tous'],['PROSPECT','Prospect'],['CONTACTE','Contacté'],
    ['INTERESSE','Intéressé'],['NEGOCIE','Négociation'],['RESERVE','Réservation'],
  ];

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:22, color:'#1a3f6f' }}>🎯 CRM — Prospects</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            Contacts sans paiement · {list.length} prospect(s) · Les clients avec paiement sont dans <button style={{ color:'#1a3f6f', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontSize:12, padding:0 }} onClick={()=>navigate('/toptelsig/souscripteurs')}>Souscripteurs →</button>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setShowImport(true)}><Upload size={13}/> Importer</button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }} onClick={()=>setShowCreate(true)}>
            <Plus size={13}/> Nouveau prospect
          </button>
        </div>
      </div>

      {/* Alertes relances en retard */}
      {alertes.length > 0 && (
        <div style={{ background:'#FDF2F2', border:'1px solid #F7C1C1', borderRadius:8, padding:'8px 14px', marginBottom:14, display:'flex', gap:8, alignItems:'center' }}>
          <AlertTriangle size={14} color="#A32D2D"/>
          <span style={{ color:'#A32D2D', fontWeight:600, fontSize:13 }}>{alertes.length} relance(s) en retard</span>
        </div>
      )}

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Total prospects', value:kpi.nbTotal||list.length, color:'#1a3f6f' },
          { label:'Contactés', value:list.filter(p=>p.statut==='CONTACTE').length, color:'#BA7517' },
          { label:'Intéressés', value:list.filter(p=>p.statut==='INTERESSE').length, color:'#E87722' },
          { label:'Réservations', value:list.filter(p=>p.statut==='RESERVE').length, color:'#27500A' },
          { label:'Perdus', value:list.filter(p=>p.statut==='PERDU').length, color:'#A32D2D' },
        ].map((k,i)=>(
          <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
            <div className="kpi-label">{k.label}</div>
            <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:20, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        {STATUTS_FILTRE.map(([k,v])=>(
          <button key={k} onClick={()=>setStatutFilter(k)} className={`filter-btn ${statutFilter===k?'active':''}`}>{v}</button>
        ))}
        <input className="input" style={{ marginLeft:'auto', width:200 }} placeholder="🔍 Rechercher..."
          value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {/* Tableau */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {isLoading ? <div style={{ padding:40, textAlign:'center', color:'#888' }}>Chargement...</div> : (
          <table className="table-erp">
            <thead>
              <tr>
                <th>Prospect</th><th>Téléphone</th><th>Statut</th>
                <th>Commercial</th><th>Source</th>
                <th>Relances</th><th>Dernière</th><th>Prochaine</th>
                <th>Lots proposés</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(p => {
                const enRetard = p._crm?.enRetardRelance;
                const nbVentes = p._crm?.nbVentes || 0;
                return (
                  <tr key={p.id} style={{ background:enRetard?'#FDF2F2':undefined }}>
                    <td>
                      <div style={{ fontWeight:600, fontSize:13 }}>{p.prenom} {p.nom}</div>
                      <div style={{ fontSize:10, color:'#888' }}>{p.profession||''}</div>
                    </td>
                    <td style={{ fontSize:12 }}>
                      <div>{p.telephone}</div>
                      <div style={{ display:'flex', gap:4, marginTop:2 }}>
                        <a href={`tel:${p.telephone}`} style={{ fontSize:11, color:'#27500A' }}>📞</a>
                        <a href={`https://wa.me/${(p.telephone||'').replace(/[\s\-+]/g,'').replace(/^0/,'225')}`}
                          target="_blank" rel="noreferrer" style={{ fontSize:11, color:'#25D366' }}>💬</a>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize:10, background:(PIPELINE_COLORS[p.statut]||'#888')+'18', color:PIPELINE_COLORS[p.statut]||'#888', borderRadius:10, padding:'2px 8px', fontWeight:500 }}>
                        {p.statut}
                      </span>
                    </td>
                    <td style={{ fontSize:11 }}>{p.commercialNom||'—'}</td>
                    <td style={{ fontSize:11, color:'#888' }}>{p.sourceAcquisition||'—'}</td>
                    <td style={{ textAlign:'center', fontWeight:600, color:'#1a3f6f' }}>{p._crm?.nbRelances||0}</td>
                    <td style={{ fontSize:11, color:'#888' }}>
                      {p._crm?.derniereRelance ? new Date(p._crm.derniereRelance.date).toLocaleDateString('fr',{day:'2-digit',month:'short'}) : '—'}
                    </td>
                    <td style={{ fontSize:11 }}>
                      {p._crm?.prochaineRelance
                        ? <span style={{ color:enRetard?'#A32D2D':'#BA7517' }}>{enRetard?'⚠ ':''}{new Date(p._crm.prochaineRelance).toLocaleDateString('fr',{day:'2-digit',month:'short'})}</span>
                        : '—'}
                    </td>
                    <td style={{ textAlign:'center' }}>
                      {nbVentes > 0
                        ? <span style={{ fontSize:10, background:'#EAF3DE', color:'#27500A', borderRadius:8, padding:'2px 8px' }}>✓ {nbVentes} lot(s)</span>
                        : <span style={{ fontSize:10, color:'#ccc' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        <button className="btn btn-xs" style={{ background:'#EEF3FB', color:'#1a3f6f', border:'none', fontSize:10 }}
                          onClick={() => setRelanceFor(p)}>📞 Relance</button>
                        <button className="btn btn-xs" style={{ background:'#EAF3DE', color:'#27500A', border:'none', fontSize:10 }}
                          onClick={() => setProposerFor(p)}>
                          <Home size={9}/> Proposer lot
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && list.length === 0 && (
                <tr><td colSpan={10}><div className="empty-state"><p>Aucun prospect</p></div></td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {relanceFor && (
        <ModalRelance
          prospect={relanceFor}
          onClose={() => setRelanceFor(null)}
          onSave={data => addRelance.mutate({ id:relanceFor.id, data })}
          loading={addRelance.isPending}
        />
      )}

      {proposerFor && (
        <ModalProposerLot
          prospect={proposerFor}
          onClose={() => setProposerFor(null)}
          onSave={data => proposerLot.mutate(data)}
          loading={proposerLot.isPending}
        />
      )}

      {showCreate && (
        <ModalCreateProspect
          onClose={() => setShowCreate(false)}
          onSave={createProspect.mutate}
          loading={createProspect.isPending}
          listeCommerciaux={listeCommerciaux}
        />
      )}

      {showImport && (
        <ModalImport
          onClose={() => setShowImport(false)}
          onSave={importProspects.mutate}
          loading={importProspects.isPending}
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

// ── Modal créer prospect ──────────────────────────────────────────────────────
function ModalCreateProspect({ onClose, onSave, loading, listeCommerciaux }) {
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    nom:'', prenom:'', telephone:'', email:'', adresse:'', profession:'',
    statut:'PROSPECT', sourceAcquisition:'',
    commercialId: user?.id||'', commercialNom: user?`${user.prenom} ${user.nom}`:'',
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>🎯 Nouveau prospect</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div className="form-grid">
          <div><label className="label">Prénom *</label><input className="input" value={form.prenom} onChange={e=>set('prenom',e.target.value)}/></div>
          <div><label className="label">Nom *</label><input className="input" value={form.nom} onChange={e=>set('nom',e.target.value)}/></div>
          <div><label className="label">Téléphone *</label><input className="input" value={form.telephone} onChange={e=>set('telephone',e.target.value)}/></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
          <div><label className="label">Profession</label><input className="input" value={form.profession} onChange={e=>set('profession',e.target.value)}/></div>
          <div>
            <label className="label">Source</label>
            <select className="input" value={form.sourceAcquisition} onChange={e=>set('sourceAcquisition',e.target.value)}>
              <option value="">—</option>
              {SOURCES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="full">
            <label className="label">Commercial responsable</label>
            <div style={{ display:'flex', gap:6 }}>
              <select className="input" style={{ flex:2 }} value={form.commercialId}
                onChange={e => {
                  const emp = listeCommerciaux.find(x=>x.id===e.target.value);
                  set('commercialId', e.target.value);
                  if (emp) set('commercialNom', `${emp.prenom} ${emp.nom}`);
                  else set('commercialNom','');
                }}>
                <option value="">— Non assigné</option>
                {listeCommerciaux.map(e=><option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.poste||'Commercial'}</option>)}
              </select>
              <input className="input" style={{ flex:1 }} placeholder="Ou saisir un nom..."
                value={form.commercialNom}
                onChange={e=>{set('commercialNom',e.target.value); set('commercialId','');}}/>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!form.nom||!form.prenom||!form.telephone||loading}
            style={{ background:'#1a3f6f', border:'none' }}
            onClick={()=>onSave({...form,code:`PROS-${Date.now().toString(36).toUpperCase().slice(-5)}`})}>
            {loading?'Création...':'Créer le prospect'}
          </button>
        </div>
      </div>
    </div>
  );
}
