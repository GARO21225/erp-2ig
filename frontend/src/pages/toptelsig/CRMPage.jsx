/**
 * TOPTELSIG — CRM Commercial
 * Dashboard + Pipeline + Liste + Fiche prospect + Import
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
import {
  Plus, X, ChevronRight, AlertTriangle, CheckCircle,
  Phone, MessageSquare, Upload
} from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────
const CANAUX = [
  { key:'appel', label:'📞 Appel téléphonique', color:'#1a3f6f' },
  { key:'whatsapp', label:'💬 WhatsApp', color:'#25D366' },
  { key:'sms', label:'📱 SMS', color:'#E87722' },
  { key:'email', label:'📧 Email', color:'#1a3f6f' },
  { key:'visite', label:'🤝 Visite bureau', color:'#8B1A1A' },
  { key:'recommandation', label:'⭐ Recommandation', color:'#BA7517' },
];
const RESULTATS = [
  { key:'interesse', label:'Intéressé', color:'#1a3f6f' },
  { key:'pas_interesse', label:'Pas intéressé', color:'#888' },
  { key:'rappeler', label:'Rappeler', color:'#BA7517' },
  { key:'converti', label:'🎉 Converti en client', color:'#27500A' },
  { key:'perdu', label:'❌ Perdu', color:'#A32D2D' },
];
const PIPELINE_COLORS = {
  PROSPECT:'#888', CONTACTE:'#BA7517', INTERESSE:'#1a3f6f',
  NEGOCIE:'#E87722', CLIENT:'#27500A', PERDU:'#A32D2D'
};
const SOURCES = ['Facebook','WhatsApp','Référence','Site Web','Affichage','Prospection terrain','Partenaire','Autre'];
const PIE_COLORS = ['#1a3f6f','#25D366','#E87722','#8B1A1A','#0A66C2','#BA7517'];

const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(1)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${n||0} F`;

// ── Timeline relance ──────────────────────────────────────────────────────────
function TimelineItem({ relance, isLast }) {
  const canal = CANAUX.find(c => c.key === relance.canal) || { label: relance.canal, color:'#888' };
  const resultat = RESULTATS.find(r => r.key === relance.resultat);
  const retard = relance.statut === 'planifiee' && relance.prochain && new Date(relance.prochain) < new Date();
  return (
    <div style={{ display:'flex', gap:10, marginBottom: isLast?0:14 }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:canal.color+'20', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13 }}>
          {relance.canal==='whatsapp'?'💬':relance.canal==='appel'?'📞':relance.canal==='email'?'📧':relance.canal==='visite'?'🤝':'📋'}
        </div>
        {!isLast && <div style={{ width:1, flex:1, background:'#e8e7e1', minHeight:14, marginTop:4 }}/>}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
          <span style={{ fontWeight:600, fontSize:12 }}>{canal.label}</span>
          <span style={{ fontSize:10, color:'#888' }}>{new Date(relance.dateRelance).toLocaleString('fr',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
        </div>
        <span style={{ fontSize:11, color:'#888' }}>par {relance.commercialNom}</span>
        {relance.notes && <div style={{ fontSize:12, color:'#333', background:'#F7F7F5', borderRadius:6, padding:'5px 8px', margin:'4px 0' }}>{relance.notes}</div>}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {resultat && <span style={{ fontSize:10, background:resultat.color+'18', color:resultat.color, borderRadius:10, padding:'1px 7px', fontWeight:500 }}>{resultat.label}</span>}
          {relance.dureeMin && <span style={{ fontSize:10, color:'#888' }}>⏱ {relance.dureeMin} min</span>}
          {relance.prochain && <span style={{ fontSize:10, background:retard?'#FCEBEB':'#FAEEDA', color:retard?'#A32D2D':'#BA7517', borderRadius:10, padding:'1px 7px' }}>{retard?'⚠ En retard':'📅'} {new Date(relance.prochain).toLocaleDateString('fr')}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Formulaire nouvelle relance ───────────────────────────────────────────────
function FormRelance({ prospect, onClose, onSave, loading }) {
  const [form, setForm] = useState({ canal:'appel', resultat:'', notes:'', prochain:'', dureeMin:'', raisonPerte:'' });
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
                  style={{ padding:'5px 10px', borderRadius:16, border:`1.5px solid ${form.canal===c.key?c.color:'#e8e7e1'}`, background:form.canal===c.key?c.color+'18':'white', color:form.canal===c.key?c.color:'#666', fontSize:11, cursor:'pointer', fontWeight:form.canal===c.key?600:400 }}>
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
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Résumé de l'échange, décisions prises..."
              style={{ width:'100%', padding:'8px 10px', border:'0.5px solid #e8e7e1', borderRadius:8, fontSize:12, resize:'vertical', minHeight:60, fontFamily:'inherit', boxSizing:'border-box' }}/>
          </div>
          {form.resultat === 'perdu' && (
            <div className="full">
              <label className="label" style={{ color:'#A32D2D' }}>Raison de la perte *</label>
              <textarea value={form.raisonPerte} onChange={e=>set('raisonPerte',e.target.value)} placeholder="Prix, concurrent, délais..."
                style={{ width:'100%', padding:'8px 10px', border:'1px solid #F7C1C1', borderRadius:8, fontSize:12, resize:'vertical', minHeight:40, fontFamily:'inherit', boxSizing:'border-box', background:'#FCEBEB' }}/>
            </div>
          )}
          {(form.resultat === 'rappeler' || form.resultat === '') && (
            <div><label className="label">Prochaine relance</label><input className="input" type="datetime-local" value={form.prochain} onChange={e=>set('prochain',e.target.value)}/></div>
          )}
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!form.canal||!form.notes||loading}
            style={{ background:'#1a3f6f', border:'none' }}
            onClick={() => onSave({ ...form, raisonPerte: form.resultat==='perdu'?form.raisonPerte:undefined })}>
            {loading ? '...' : '✅ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fiche prospect ────────────────────────────────────────────────────────────
function FicheProspect({ prospect, onClose, onRefresh }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const estClient = prospect.statut === 'CLIENT';

  const { data: relances = [] } = useQuery({
    queryKey: ['relances-crm', prospect.id],
    queryFn: () => toptelsigAPI.crmRelances(prospect.id),
    staleTime: 10000,
  });

  const addRelance = useMutation({
    mutationFn: (data) => toptelsigAPI.crmAddRelance(prospect.id, data),
    onSuccess: (res) => {
      qc.invalidateQueries(['relances-crm', prospect.id]);
      qc.invalidateQueries(['crm-prospects']);
      qc.invalidateQueries(['crm-dashboard']);
      setShowForm(false);
      // Si converti → ouvrir fiche souscripteur
      if (res?.souscripteurConverti) {
        onClose();
        navigate(`/toptelsig/souscripteurs/${prospect.id}`);
      }
      onRefresh?.();
    }
  });

  const planifiees = relances.filter(r => r.statut === 'planifiee' && r.prochain && new Date(r.prochain) > new Date());
  const enRetard = relances.filter(r => r.statut === 'planifiee' && r.prochain && new Date(r.prochain) < new Date());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:620, maxHeight:'85vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div>
            <h2 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:18 }}>{prospect.prenom} {prospect.nom}</h2>
            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{prospect.telephone} {prospect.email?`· ${prospect.email}`:''}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20}/></button>
        </div>

        {/* Badges statut */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
          <span style={{ background:(PIPELINE_COLORS[prospect.statut]||'#888')+'20', color:PIPELINE_COLORS[prospect.statut]||'#888', borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:600 }}>
            {prospect.statut}
          </span>
          {enRetard.length > 0 && <span style={{ background:'#FCEBEB', color:'#A32D2D', borderRadius:20, padding:'3px 10px', fontSize:11 }}>⚠ {enRetard.length} relance(s) en retard</span>}
          {planifiees.length > 0 && <span style={{ background:'#FAEEDA', color:'#BA7517', borderRadius:20, padding:'3px 10px', fontSize:11 }}>📅 Prochaine: {new Date(planifiees[0].prochain).toLocaleDateString('fr')}</span>}
          <span style={{ background:'#EEF3FB', color:'#1a3f6f', borderRadius:20, padding:'3px 10px', fontSize:11 }}>{relances.length} relance(s)</span>
        </div>

        {/* Infos CRM */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
          <div style={{ background:'#F7F7F5', borderRadius:8, padding:'8px 12px' }}>
            <div style={{ fontSize:10, color:'#888', marginBottom:2 }}>Commercial responsable</div>
            <div style={{ fontSize:12, fontWeight:600 }}>{prospect.commercialNom || 'Non assigné'}</div>
          </div>
          <div style={{ background:'#F7F7F5', borderRadius:8, padding:'8px 12px' }}>
            <div style={{ fontSize:10, color:'#888', marginBottom:2 }}>Source d'acquisition</div>
            <div style={{ fontSize:12, fontWeight:600 }}>{prospect.sourceAcquisition || '—'}</div>
          </div>
          {prospect.raisonPerte && (
            <div style={{ background:'#FCEBEB', borderRadius:8, padding:'8px 12px', gridColumn:'span 2' }}>
              <div style={{ fontSize:10, color:'#A32D2D', marginBottom:2 }}>Raison de la perte</div>
              <div style={{ fontSize:12, color:'#A32D2D' }}>{prospect.raisonPerte}</div>
            </div>
          )}
          {estClient && (
            <div style={{ background:'#EAF3DE', borderRadius:8, padding:'8px 12px', gridColumn:'span 2' }}>
              <div style={{ fontSize:12, color:'#27500A' }}>✅ Client actif — converti par {prospect.commercialNom||'—'} via {prospect.canalConversion||'—'}</div>
              <button className="btn btn-ghost btn-xs" style={{ marginTop:6, color:'#27500A', borderColor:'#27500A' }}
                onClick={() => { onClose(); navigate(`/toptelsig/souscripteurs/${prospect.id}`); }}>
                👁 Voir la fiche souscripteur →
              </button>
            </div>
          )}
        </div>

        {/* Bouton relance — BLOQUÉ si client */}
        {estClient ? (
          <div style={{ background:'#EAF3DE', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#27500A', display:'flex', alignItems:'center', gap:8 }}>
            <CheckCircle size={14}/>
            Client converti — les relances commerciales ne sont plus applicables.
            Gérez ce client dans <button style={{ color:'#1a3f6f', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 }}
              onClick={() => { onClose(); navigate('/toptelsig/souscripteurs'); }}>Souscripteurs</button>.
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" style={{ width:'100%', marginBottom:14, background:'#1a3f6f', border:'none' }}
            onClick={() => setShowForm(true)}>
            <Plus size={13}/> Enregistrer une interaction
          </button>
        )}

        {/* Timeline */}
        <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, marginBottom:10 }}>📋 Timeline ({relances.length})</div>
        {relances.length === 0 ? (
          <div style={{ textAlign:'center', color:'#aaa', fontSize:12, padding:20 }}>Aucune interaction enregistrée</div>
        ) : (
          <div style={{ maxHeight:320, overflowY:'auto', paddingRight:4 }}>
            {relances.map((r,i) => <TimelineItem key={r.id} relance={r} isLast={i===relances.length-1}/>)}
          </div>
        )}

        {showForm && (
          <FormRelance prospect={prospect} onClose={() => setShowForm(false)}
            onSave={data => addRelance.mutate(data)} loading={addRelance.isPending}/>
        )}
      </div>
    </div>
  );
}

// ── Modal import prospects ────────────────────────────────────────────────────
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
      if (data.length < 2) { setErreur('Fichier vide'); return; }
      const headers = data[0].map(h => String(h).toLowerCase().trim());
      const parsed = data.slice(1).filter(r => r.some(c => c)).map(row => {
        const get = (k) => row[headers.indexOf(k)] || '';
        return { prenom:String(get('prenom')), nom:String(get('nom')), telephone:String(get('telephone')), email:String(get('email')||''), profession:String(get('profession')||''), sourceAcquisition:String(get('source')||''), statut:'PROSPECT' };
      }).filter(r => r.prenom && r.nom && r.telephone);
      setRows(parsed);
      setErreur(parsed.length === 0 ? 'Aucune ligne valide (colonnes: prenom, nom, telephone requises)' : '');
    } catch (err) { setErreur(err.message); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:520 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>📤 Import prospects/clients</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div style={{ background:'#F7F7F5', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:11, color:'#888' }}>
          Colonnes Excel : <strong>prenom</strong>, <strong>nom</strong>, <strong>telephone</strong>, email, profession, source
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={handleFile}/>
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => fileRef.current?.click()}>
            <Upload size={13}/> Choisir un fichier Excel/CSV
          </button>
          <button className="btn btn-ghost btn-sm" style={{ borderColor:'#1a3f6f20', color:'#1a3f6f' }}
            onClick={async () => {
              try {
                const blob = await toptelsigAPI.crmTemplateImport();
                const url = URL.createObjectURL(new Blob([blob]));
                const a = document.createElement('a'); a.href=url; a.download='template_prospects_crm.csv'; a.click();
                URL.revokeObjectURL(url);
              } catch { alert('Erreur téléchargement template'); }
            }}>
            📥 Template
          </button>
        </div>
        {erreur && <div style={{ color:'#A32D2D', fontSize:12, marginBottom:8 }}>{erreur}</div>}
        {rows.length > 0 && (
          <div style={{ background:'#EAF3DE', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#27500A', marginBottom:12 }}>
            ✅ {rows.length} prospect(s) prêts à importer
          </div>
        )}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={rows.length===0||loading}
            style={{ background:'#1a3f6f', border:'none' }} onClick={() => onSave(rows)}>
            {loading ? 'Import...' : `Importer ${rows.length} contact(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PAGE CRM PRINCIPALE ───────────────────────────────────────────────────────
export default function CRMPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [view, setView] = useState('dashboard');
  const [statutFilter, setStatutFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg, t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3000); };

  const { data: dashboard } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: toptelsigAPI.crmDashboard,
    staleTime: 30000, refetchInterval: 60000,
  });
  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ['crm-prospects', statutFilter, search],
    queryFn: () => toptelsigAPI.crmProspects({ statut:statutFilter, search }),
    staleTime: 15000,
  });

  const createProspect = useMutation({
    mutationFn: toptelsigAPI.createSouscripteur,
    onSuccess: (r) => {
      qc.invalidateQueries(['crm-prospects','crm-dashboard']);
      setShowCreate(false);
      showToast('Prospect créé ✓');
    }
  });

  const importProspects = useMutation({
    mutationFn: async (rows) => {
      let ok = 0;
      for (const row of rows) {
        try {
          await toptelsigAPI.createSouscripteur({ ...row, code: `IMP-${Date.now().toString(36).toUpperCase().slice(-4)}` });
          ok++;
        } catch {}
      }
      return ok;
    },
    onSuccess: (ok) => {
      qc.invalidateQueries(['crm-prospects','crm-dashboard']);
      setShowImport(false);
      showToast(`${ok} prospect(s) importés ✓`);
    }
  });

  const kpi = dashboard?.kpi || {};
  const pipeline = dashboard?.pipeline || [];
  const alertes = dashboard?.alertesRelance || [];
  const canaux = dashboard?.relancesParCanal || [];
  const conversions = dashboard?.conversions || [];

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:22, color:'#1a3f6f' }}>🎯 CRM — Pilotage Commercial</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Prospects · Relances · Conversions · TOPTELSIG</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {['dashboard','pipeline','liste'].map(v=>(
            <button key={v} onClick={()=>setView(v)} className={`filter-btn ${view===v?'active':''}`}>
              {v==='dashboard'?'📊 Dashboard':v==='pipeline'?'🔄 Pipeline':'📋 Liste'}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={()=>setShowImport(true)}><Upload size={13}/> Importer</button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }} onClick={()=>setShowCreate(true)}>
            <Plus size={13}/> Nouveau prospect
          </button>
        </div>
      </div>

      {/* Alertes */}
      {alertes.length > 0 && (
        <div style={{ background:'#FDF2F2', border:'1px solid #F7C1C1', borderRadius:8, padding:'8px 14px', marginBottom:14, display:'flex', gap:8, alignItems:'center' }}>
          <AlertTriangle size={14} color="#A32D2D"/>
          <span style={{ color:'#A32D2D', fontWeight:600, fontSize:13 }}>{alertes.length} relance(s) en retard</span>
          {alertes.slice(0,3).map(a => (
            <span key={a.id} style={{ background:'white', border:'1px solid #F7C1C1', borderRadius:6, padding:'1px 7px', fontSize:11, cursor:'pointer', color:'#A32D2D' }}
              onClick={() => { const p = prospects.find(x=>x.id===a.souscripteurId); if(p) setSelected(p); }}>
              {a.souscripteur?.prenom} {a.souscripteur?.nom}
            </span>
          ))}
        </div>
      )}

      {/* DASHBOARD */}
      {view === 'dashboard' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:20 }}>
            {[
              { label:'Total contacts', value:kpi.nbTotal||0, color:'#1a3f6f', icon:'👥' },
              { label:'Prospects actifs', value:kpi.nbProspects||0, color:'#888', icon:'🎯' },
              { label:'Clients convertis', value:kpi.nbClients||0, color:'#27500A', icon:'✅' },
              { label:'Perdus', value:kpi.nbPerdus||0, color:'#A32D2D', icon:'❌' },
              { label:'Taux conversion', value:`${kpi.tauxConversion||0}%`, color:'#27500A', icon:'📈' },
              { label:'Relances/mois', value:kpi.nbRelancesMois||0, color:'#E87722', icon:'📞' },
            ].map((k,i)=>(
              <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
                <div style={{ fontSize:16, marginBottom:3 }}>{k.icon}</div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ fontSize:20, color:k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
            {/* Entonnoir */}
            <div className="card">
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>🔄 Entonnoir de conversion</div>
              {pipeline.filter(p=>p.count>0).map((p,i)=>{
                const color = Object.values(PIPELINE_COLORS)[i] || '#888';
                return (
                  <div key={i} style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:12, color }}>{p.statut}</span>
                      <span style={{ fontFamily:'Syne', fontWeight:700, fontSize:14 }}>{p.count}</span>
                    </div>
                    <div style={{ height:8, background:'#F7F7F5', borderRadius:4 }}>
                      <div style={{ height:'100%', width:`${kpi.nbTotal>0?Math.round(p.count/kpi.nbTotal*100):0}%`, background:color, borderRadius:4 }}/>
                    </div>
                    <div style={{ fontSize:10, color:'#aaa' }}>{kpi.nbTotal>0?Math.round(p.count/kpi.nbTotal*100):0}%</div>
                  </div>
                );
              })}
            </div>

            {/* Canaux */}
            <div className="card">
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>📡 Canaux de relance (mois)</div>
              {canaux.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={canaux.map(c=>({name:c.canal,value:c.count}))} cx="50%" cy="50%" outerRadius={70} paddingAngle={3} dataKey="value">
                      {canaux.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={v=>[`${v} relance(s)`,'']}/>
                    <Legend formatter={v=><span style={{ fontSize:11 }}>{v}</span>}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>Aucune relance ce mois</div>
              )}
            </div>
          </div>

          {conversions.length > 0 && (
            <div className="card">
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:10 }}>🎉 Conversions récentes</div>
              {conversions.map((c,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', background:'#EAF3DE', borderRadius:7, marginBottom:5 }}>
                  <CheckCircle size={13} color="#27500A"/>
                  <span style={{ fontWeight:600, fontSize:12 }}>{c.prenom} {c.nom}</span>
                  <span style={{ fontSize:11, color:'#888' }}>par {c.commercialNom||'—'}</span>
                  {c.canalConversion && <span style={{ fontSize:10, background:'white', borderRadius:10, padding:'1px 7px', border:'1px solid #27500A20', color:'#27500A' }}>{c.canalConversion}</span>}
                  <span style={{ fontSize:10, color:'#888', marginLeft:'auto' }}>{new Date(c.updatedAt).toLocaleDateString('fr')}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* PIPELINE + LISTE */}
      {(view === 'pipeline' || view === 'liste') && (
        <>
          <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            {['','PROSPECT','CONTACTE','INTERESSE','NEGOCIE','CLIENT','PERDU'].map(s=>(
              <button key={s} onClick={()=>setStatutFilter(s)} className={`filter-btn ${statutFilter===s?'active':''}`}
                style={{ display:'flex', alignItems:'center', gap:4 }}>
                {!s && '👥 Tous'}
                {s && <><span style={{ width:8, height:8, borderRadius:'50%', background:PIPELINE_COLORS[s]||'#888', display:'inline-block' }}/>{s}</>}
              </button>
            ))}
            <input className="input" style={{ marginLeft:'auto', width:200 }} placeholder="🔍 Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>

          {view === 'liste' && (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <table className="table-erp">
                <thead>
                  <tr><th>Prospect</th><th>Téléphone</th><th>Commercial</th><th>Statut</th><th>Relances</th><th>Dernière</th><th>Prochaine</th><th>Source</th><th></th></tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td colSpan={9} style={{ textAlign:'center', padding:20, color:'#888' }}>Chargement...</td></tr>}
                  {prospects.map(p => {
                    const enRetard = p.relances?.some(r=>r.statut==='planifiee'&&r.prochain&&new Date(r.prochain)<new Date());
                    return (
                      <tr key={p.id} style={{ cursor:'pointer' }} onClick={()=>setSelected(p)}>
                        <td style={{ fontWeight:600 }}>{p.prenom} {p.nom}</td>
                        <td style={{ fontSize:11, color:'#888' }}>{p.telephone}</td>
                        <td style={{ fontSize:11 }}>{p.commercialNom||'—'}</td>
                        <td><span style={{ fontSize:10, background:(PIPELINE_COLORS[p.statut]||'#888')+'18', color:PIPELINE_COLORS[p.statut]||'#888', borderRadius:10, padding:'2px 7px', fontWeight:500 }}>{p.statut}</span></td>
                        <td style={{ textAlign:'center', fontWeight:600, color:'#1a3f6f' }}>{p._crm?.nbRelances||0}</td>
                        <td style={{ fontSize:11 }}>{p._crm?.derniereRelance ? new Date(p._crm.derniereRelance.date).toLocaleDateString('fr') : <span style={{ color:'#aaa' }}>Jamais</span>}</td>
                        <td style={{ fontSize:11 }}>{p._crm?.prochaineRelance ? <span style={{ color:'#BA7517' }}>📅 {new Date(p._crm.prochaineRelance).toLocaleDateString('fr')}</span> : enRetard ? <span style={{ color:'#A32D2D', fontWeight:600 }}>⚠ Retard</span> : '—'}</td>
                        <td style={{ fontSize:11, color:'#888' }}>{p.sourceAcquisition||'—'}</td>
                        <td><ChevronRight size={12} color="#888"/></td>
                      </tr>
                    );
                  })}
                  {!isLoading && prospects.length === 0 && <tr><td colSpan={9}><div className="empty-state"><p>Aucun contact</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {view === 'pipeline' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>
              {prospects.map(p => {
                const enRetard = p.relances?.some(r=>r.statut==='planifiee'&&r.prochain&&new Date(r.prochain)<new Date());
                return (
                  <div key={p.id} style={{ background:'white', border:`1.5px solid ${enRetard?'#F7C1C1':'#e8e7e1'}`, borderRadius:10, padding:14, cursor:'pointer' }} onClick={()=>setSelected(p)}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13 }}>{p.prenom} {p.nom}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{p.telephone}</div>
                      </div>
                      <span style={{ fontSize:10, background:(PIPELINE_COLORS[p.statut]||'#888')+'18', color:PIPELINE_COLORS[p.statut]||'#888', borderRadius:10, padding:'2px 7px', fontWeight:500, height:'fit-content' }}>{p.statut}</span>
                    </div>
                    <div style={{ fontSize:11, color:'#888' }}>📞 {p._crm?.nbRelances||0} relance(s) · {p.commercialNom||'Non assigné'}</div>
                    {enRetard && <div style={{ fontSize:11, color:'#A32D2D', marginTop:4 }}>⚠ Relance en retard</div>}
                    {p.statut === 'CLIENT' && <div style={{ fontSize:11, color:'#27500A', marginTop:4 }}>✅ Client — voir dans Souscripteurs</div>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Fiche prospect */}
      {selected && <FicheProspect prospect={selected} onClose={()=>setSelected(null)} onRefresh={()=>{ qc.invalidateQueries(['crm-prospects']); qc.invalidateQueries(['crm-dashboard']); setSelected(null); }}/>}

      {/* Nouveau prospect */}
      {showCreate && <ModalCreateProspect onClose={()=>setShowCreate(false)} onSave={createProspect.mutate} loading={createProspect.isPending}/>}

      {/* Import */}
      {showImport && <ModalImport onClose={()=>setShowImport(false)} onSave={importProspects.mutate} loading={importProspects.isPending}/>}

      {toast && <div style={{ position:'fixed', bottom:20, right:16, background:toast.t==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>{toast.msg}</div>}
    </div>
  );
}

function ModalCreateProspect({ onClose, onSave, loading }) {
  const { user } = useAuthStore();
  const [form, setForm] = useState({ nom:'', prenom:'', telephone:'', email:'', adresse:'', profession:'', statut:'PROSPECT', sourceAcquisition:'', commercialId:user?.id||'', commercialNom:user?`${user.prenom} ${user.nom}`:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const { data: commerciaux = [] } = useQuery({
    queryKey: ['commerciaux-toptelsig'],
    queryFn: () => employesAPI.list({ filiale:'TOPTELSIG', statut:'ACTIF', limit:50 }),
    staleTime: 300000,
  });
  const listeCommerciaux = Array.isArray(commerciaux) ? commerciaux : (commerciaux?.data || []);
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
          <div className="full"><label className="label">Profession</label><input className="input" value={form.profession} onChange={e=>set('profession',e.target.value)}/></div>
          <div className="full">
            <label className="label">Commercial responsable</label>
            <div style={{ display:'flex', gap:6 }}>
              <select className="input" style={{ flex:2 }}
                value={form.commercialId}
                onChange={e => {
                  const emp = listeCommerciaux.find(x=>x.id===e.target.value);
                  set('commercialId', e.target.value);
                  if (emp) set('commercialNom', `${emp.prenom} ${emp.nom}`);
                  else if (!e.target.value) set('commercialNom', '');
                }}>
                <option value="">— Non assigné</option>
                {listeCommerciaux.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.poste||'Commercial'}</option>)}
              </select>
              <input className="input" style={{ flex:1 }} placeholder="Ou saisir un nom..."
                value={form.commercialNom}
                onChange={e => { set('commercialNom', e.target.value); set('commercialId', ''); }}/>
            </div>
            <div style={{ fontSize:10, color:'#888', marginTop:2 }}>Sélectionner dans la liste ou saisir directement un nom</div>
          </div>
          <div>
            <label className="label">Source</label>
            <select className="input" value={form.sourceAcquisition} onChange={e=>set('sourceAcquisition',e.target.value)}>
              <option value="">—</option>
              {SOURCES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Statut initial</label>
            <select className="input" value={form.statut} onChange={e=>set('statut',e.target.value)}>
              {['PROSPECT','CONTACTE','INTERESSE'].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!form.nom||!form.prenom||!form.telephone||loading}
            style={{ background:'#1a3f6f', border:'none' }}
            onClick={()=>onSave({...form, code:`PROS-${Date.now().toString(36).toUpperCase().slice(-5)}`})}>
            {loading?'Création...':'Créer le prospect'}
          </button>
        </div>
      </div>
    </div>
  );
}
