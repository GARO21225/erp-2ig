import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import {
  BarChart, Bar, FunnelChart, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Legend
} from 'recharts';
import {
  Phone, MessageSquare, Mail, MapPin, Users, TrendingUp,
  AlertTriangle, CheckCircle, Clock, Plus, X, ChevronRight,
  Activity, Target, Star
} from 'lucide-react';

const CANAUX = [
  { key:'appel', label:'📞 Appel téléphonique', color:'#1a3f6f' },
  { key:'whatsapp', label:'💬 WhatsApp', color:'#25D366' },
  { key:'sms', label:'📱 SMS', color:'#E87722' },
  { key:'email', label:'📧 Email', color:'#1a3f6f' },
  { key:'visite', label:'🤝 Visite bureau', color:'#8B1A1A' },
  { key:'linkedin', label:'🔗 LinkedIn', color:'#0A66C2' },
  { key:'recommandation', label:'⭐ Recommandation', color:'#BA7517' },
];
const RESULTATS = [
  { key:'interesse', label:'Intéressé', color:'#1a3f6f' },
  { key:'pas_interesse', label:'Pas intéressé', color:'#888' },
  { key:'rappeler', label:'Rappeler', color:'#BA7517' },
  { key:'converti', label:'🎉 Converti en client', color:'#27500A' },
  { key:'perdu', label:'❌ Perdu', color:'#A32D2D' },
];
const PIPELINE_COLORS = { PROSPECT:'#888', CONTACTE:'#BA7517', INTERESSE:'#1a3f6f', NEGOCIE:'#E87722', CLIENT:'#27500A', PERDU:'#A32D2D' };
const SOURCES = ['Réseaux sociaux', 'Salon immobilier', 'Bouche à oreille', 'Site web', 'Prescripteur', 'Publicité', 'Autre'];
const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(1)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${n||0} F`;

// ── Timeline d'une relance ──────────────────────────────────────────────────
function TimelineItem({ relance, isLast }) {
  const canal = CANAUX.find(c => c.key === relance.canal) || { label: relance.canal, color:'#888' };
  const resultat = RESULTATS.find(r => r.key === relance.resultat);
  const retard = relance.statut === 'planifiee' && relance.prochain && new Date(relance.prochain) < new Date();
  return (
    <div style={{ display:'flex', gap:12, marginBottom: isLast ? 0 : 16 }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
        <div style={{ width:32, height:32, borderRadius:'50%', background:canal.color+'20', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:14 }}>
          {relance.canal === 'whatsapp' ? '💬' : relance.canal === 'appel' ? '📞' : relance.canal === 'email' ? '📧' : relance.canal === 'visite' ? '🤝' : relance.canal === 'sms' ? '📱' : '📋'}
        </div>
        {!isLast && <div style={{ width:1, flex:1, background:'#e8e7e1', minHeight:16, marginTop:4 }} />}
      </div>
      <div style={{ flex:1, paddingBottom: isLast ? 0 : 8 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:3 }}>
          <div>
            <span style={{ fontWeight:600, fontSize:12 }}>{canal.label}</span>
            <span style={{ fontSize:11, color:'#888', marginLeft:8 }}>par {relance.commercialNom}</span>
          </div>
          <div style={{ fontSize:10, color:'#888', whiteSpace:'nowrap', marginLeft:8 }}>
            {new Date(relance.dateRelance).toLocaleString('fr', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
          </div>
        </div>
        {relance.notes && <div style={{ fontSize:12, color:'#333', background:'#F7F7F5', borderRadius:6, padding:'6px 8px', marginBottom:4 }}>{relance.notes}</div>}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {resultat && <span style={{ fontSize:10, background:resultat.color+'18', color:resultat.color, borderRadius:10, padding:'2px 8px', fontWeight:500 }}>{resultat.label}</span>}
          {relance.dureeMin && <span style={{ fontSize:10, color:'#888' }}>⏱ {relance.dureeMin} min</span>}
          {relance.prochain && (
            <span style={{ fontSize:10, background: retard?'#FCEBEB':'#FAEEDA', color: retard?'#A32D2D':'#BA7517', borderRadius:10, padding:'2px 8px' }}>
              {retard ? '⚠ Relance en retard' : `📅 Prévu ${new Date(relance.prochain).toLocaleDateString('fr')}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Formulaire nouvelle relance ─────────────────────────────────────────────
function FormRelance({ prospect, onClose, onSave, loading }) {
  const [form, setForm] = useState({ canal:'appel', resultat:'', notes:'', prochain:'', dureeMin:'', raisonPerte:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>
            📞 Relance — {prospect.prenom} {prospect.nom}
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div className="form-grid">
          <div className="full">
            <label className="label">Canal de contact *</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {CANAUX.map(c => (
                <button key={c.key} type="button" onClick={() => set('canal', c.key)}
                  style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${form.canal===c.key?c.color:'#e8e7e1'}`, background:form.canal===c.key?c.color+'18':'white', color:form.canal===c.key?c.color:'#666', fontSize:11, cursor:'pointer', fontWeight:form.canal===c.key?600:400 }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Résultat</label>
            <select className="input" value={form.resultat} onChange={e=>set('resultat',e.target.value)}>
              <option value="">— Sélectionner —</option>
              {RESULTATS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Durée (min)</label>
            <input className="input" type="number" value={form.dureeMin} onChange={e=>set('dureeMin',e.target.value)} placeholder="15"/>
          </div>
          <div className="full">
            <label className="label">Notes de l'échange *</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Résumé de la conversation, objections, décisions..."
              style={{ width:'100%', padding:'8px 10px', border:'0.5px solid #e8e7e1', borderRadius:8, fontSize:12, resize:'vertical', minHeight:70, fontFamily:'inherit', boxSizing:'border-box' }}/>
          </div>
          {form.resultat === 'perdu' && (
            <div className="full">
              <label className="label" style={{ color:'#A32D2D' }}>Raison de la perte *</label>
              <textarea value={form.raisonPerte} onChange={e=>set('raisonPerte',e.target.value)} placeholder="Prix, concurrent, délais, changement de projet..."
                style={{ width:'100%', padding:'8px 10px', border:'0.5px solid #F7C1C1', borderRadius:8, fontSize:12, resize:'vertical', minHeight:50, fontFamily:'inherit', boxSizing:'border-box', background:'#FCEBEB' }}/>
            </div>
          )}
          {(form.resultat === 'rappeler' || form.resultat === '') && (
            <div>
              <label className="label">Prochaine relance</label>
              <input className="input" type="datetime-local" value={form.prochain} onChange={e=>set('prochain',e.target.value)}/>
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!form.canal||!form.notes||loading}
            style={{ background:'#1a3f6f', border:'none' }} onClick={() => onSave({ ...form, raisonPerte: form.resultat==='perdu'?form.raisonPerte:undefined })}>
            {loading ? 'Enregistrement...' : '✅ Enregistrer la relance'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fiche prospect CRM ──────────────────────────────────────────────────────
function FicheProspect({ prospect, onClose, onRefresh }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editSource, setEditSource] = useState(false);
  const [source, setSource] = useState(prospect.sourceAcquisition || '');

  const { data: relances = [] } = useQuery({
    queryKey: ['relances-crm', prospect.id],
    queryFn: () => toptelsigAPI.crmRelances(prospect.id),
    staleTime: 10000,
  });

  const addRelance = useMutation({
    mutationFn: (data) => toptelsigAPI.crmAddRelance(prospect.id, data),
    onSuccess: () => { qc.invalidateQueries(['relances-crm', prospect.id]); qc.invalidateQueries(['crm-prospects']); setShowForm(false); onRefresh?.(); }
  });

  const updateSource = useMutation({
    mutationFn: (src) => toptelsigAPI.crmUpdate(prospect.id, { sourceAcquisition: src }),
    onSuccess: () => { setEditSource(false); qc.invalidateQueries(['crm-prospects']); }
  });

  const derniere = relances[0];
  const planifiees = relances.filter(r => r.statut === 'planifiee' && r.prochain && new Date(r.prochain) > new Date());
  const enRetard = relances.filter(r => r.statut === 'planifiee' && r.prochain && new Date(r.prochain) < new Date());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:620, maxHeight:'85vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <h2 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:18 }}>{prospect.prenom} {prospect.nom}</h2>
            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{prospect.telephone} {prospect.email ? `· ${prospect.email}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20}/></button>
        </div>

        {/* Badges et alertes */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          <span style={{ background:PIPELINE_COLORS[prospect.statut]+'20', color:PIPELINE_COLORS[prospect.statut], borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:600 }}>
            {prospect.statut}
          </span>
          {enRetard.length > 0 && (
            <span style={{ background:'#FCEBEB', color:'#A32D2D', borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:600 }}>
              ⚠ {enRetard.length} relance(s) en retard
            </span>
          )}
          {planifiees.length > 0 && (
            <span style={{ background:'#FAEEDA', color:'#BA7517', borderRadius:20, padding:'4px 12px', fontSize:11 }}>
              📅 Prochaine: {new Date(planifiees[0].prochain).toLocaleDateString('fr')}
            </span>
          )}
          {prospect._crm?.nbRelances > 0 && (
            <span style={{ background:'#EEF3FB', color:'#1a3f6f', borderRadius:20, padding:'4px 12px', fontSize:11 }}>
              {prospect._crm.nbRelances} relance(s) au total
            </span>
          )}
        </div>

        {/* Infos CRM */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
          <div style={{ background:'#F7F7F5', borderRadius:8, padding:'8px 12px' }}>
            <div style={{ fontSize:10, color:'#888', marginBottom:2 }}>Commercial responsable</div>
            <div style={{ fontSize:12, fontWeight:600 }}>{prospect.commercialNom || 'Non assigné'}</div>
          </div>
          <div style={{ background:'#F7F7F5', borderRadius:8, padding:'8px 12px' }}>
            <div style={{ fontSize:10, color:'#888', marginBottom:2 }}>Source d'acquisition</div>
            {editSource ? (
              <div style={{ display:'flex', gap:4 }}>
                <select className="input" style={{ fontSize:11, padding:'2px 6px' }} value={source} onChange={e=>setSource(e.target.value)}>
                  <option value="">Non définie</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => updateSource.mutate(source)} style={{ background:'#1a3f6f', color:'white', border:'none', borderRadius:4, padding:'2px 8px', cursor:'pointer', fontSize:11 }}>✓</button>
              </div>
            ) : (
              <div style={{ fontSize:12, fontWeight:600, cursor:'pointer', color: prospect.sourceAcquisition ? '#1a1a1a' : '#aaa' }}
                onClick={() => setEditSource(true)}>
                {prospect.sourceAcquisition || '+ Ajouter la source'} ✏️
              </div>
            )}
          </div>
          {prospect.raisonPerte && (
            <div style={{ background:'#FCEBEB', borderRadius:8, padding:'8px 12px', gridColumn:'span 2' }}>
              <div style={{ fontSize:10, color:'#A32D2D', marginBottom:2 }}>Raison de la perte</div>
              <div style={{ fontSize:12, color:'#A32D2D' }}>{prospect.raisonPerte}</div>
            </div>
          )}
          {prospect.statut === 'CLIENT' && (
            <div style={{ background:'#EAF3DE', borderRadius:8, padding:'8px 12px', gridColumn:'span 2' }}>
              <div style={{ fontSize:10, color:'#27500A', marginBottom:2 }}>Conversion</div>
              <div style={{ fontSize:12, color:'#27500A' }}>
                ✅ Converti par {prospect.commercialNom || '—'} via {prospect.canalConversion || '—'}
                {prospect.raisonConversion && ` · ${prospect.raisonConversion}`}
              </div>
            </div>
          )}
        </div>

        {/* Bouton nouvelle relance */}
        <button className="btn btn-primary btn-sm" style={{ width:'100%', marginBottom:16, background:'#1a3f6f', border:'none' }}
          onClick={() => setShowForm(true)}>
          <Plus size={13}/> Enregistrer une interaction
        </button>

        {/* Timeline */}
        <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, marginBottom:12 }}>
          📋 Timeline des interactions ({relances.length})
        </div>
        {relances.length === 0 ? (
          <div style={{ textAlign:'center', color:'#aaa', fontSize:12, padding:20 }}>
            Aucune interaction enregistrée — cliquez sur "Enregistrer une interaction"
          </div>
        ) : (
          <div style={{ maxHeight:350, overflowY:'auto', paddingRight:4 }}>
            {relances.map((r, i) => <TimelineItem key={r.id} relance={r} isLast={i===relances.length-1}/>)}
          </div>
        )}

        {showForm && (
          <FormRelance prospect={prospect} onClose={() => setShowForm(false)}
            onSave={(data) => addRelance.mutate(data)} loading={addRelance.isPending}/>
        )}
      </div>
    </div>
  );
}

// ── Page principale CRM ─────────────────────────────────────────────────────
export default function CRMPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [view, setView] = useState('dashboard'); // dashboard | pipeline | liste
  const [statutFilter, setStatutFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: dashboard } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: toptelsigAPI.crmDashboard,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ['crm-prospects', statutFilter, search],
    queryFn: () => toptelsigAPI.crmProspects({ statut: statutFilter, search }),
    staleTime: 15000,
  });

  const createProspect = useMutation({
    mutationFn: toptelsigAPI.createSouscripteur,
    onSuccess: () => { qc.invalidateQueries(['crm-prospects','crm-dashboard']); setShowCreate(false); }
  });

  const kpi = dashboard?.kpi || {};
  const pipeline = dashboard?.pipeline || [];
  const alertes = dashboard?.alertesRelance || [];
  const canaux = dashboard?.relancesParCanal || [];
  const conversions = dashboard?.conversions || [];

  const PIE_COLORS = ['#1a3f6f','#25D366','#E87722','#8B1A1A','#0A66C2','#BA7517'];

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:22, color:'#1a3f6f' }}>
            🎯 CRM — Pilotage Commercial
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            Suivi prospects, relances, conversions · TOPTELSIG Foncier
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {['dashboard','pipeline','liste'].map(v => (
            <button key={v} onClick={() => setView(v)} className={`filter-btn ${view===v?'active':''}`}>
              {v==='dashboard'?'📊 Dashboard':v==='pipeline'?'🔄 Pipeline':'📋 Liste'}
            </button>
          ))}
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }} onClick={() => setShowCreate(true)}>
            <Plus size={13}/> Nouveau prospect
          </button>
        </div>
      </div>

      {/* VUE DASHBOARD */}
      {view === 'dashboard' && (
        <>
          {/* Alertes relances en retard */}
          {alertes.length > 0 && (
            <div style={{ background:'#FDF2F2', border:'1px solid #F7C1C1', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
              <AlertTriangle size={16} color="#A32D2D"/>
              <span style={{ color:'#A32D2D', fontWeight:600, fontSize:13 }}>{alertes.length} relance(s) en retard à traiter</span>
              <div style={{ display:'flex', gap:6, marginLeft:8, flexWrap:'wrap' }}>
                {alertes.slice(0,3).map(a => (
                  <span key={a.id} style={{ background:'white', border:'1px solid #F7C1C1', borderRadius:6, padding:'2px 8px', fontSize:11, cursor:'pointer', color:'#A32D2D' }}
                    onClick={() => { const p = prospects.find(x=>x.id===a.souscripteurId); if(p) setSelected(p); }}>
                    {a.souscripteur?.prenom} {a.souscripteur?.nom}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* KPI */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:20 }}>
            {[
              { label:'Total contacts', value:kpi.nbTotal||0, color:'#1a3f6f', icon:'👥' },
              { label:'Prospects actifs', value:kpi.nbProspects||0, color:'#888', icon:'🎯' },
              { label:'Clients convertis', value:kpi.nbClients||0, color:'#27500A', icon:'✅' },
              { label:'Perdus', value:kpi.nbPerdus||0, color:'#A32D2D', icon:'❌' },
              { label:'Taux conversion', value:`${kpi.tauxConversion||0}%`, color:'#27500A', icon:'📈' },
              { label:'Relances/mois', value:kpi.nbRelancesMois||0, color:'#E87722', icon:'📞' },
            ].map((k,i) => (
              <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
                <div style={{ fontSize:16, marginBottom:4 }}>{k.icon}</div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ fontSize:20, color:k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
            {/* Entonnoir pipeline */}
            <div className="card">
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>🔄 Entonnoir de conversion</div>
              {pipeline.filter(p=>p.count>0).map((p,i) => (
                <div key={i} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:12, color:PIPELINE_COLORS[p.statut.replace('É','E').replace('Ê','E').replace('INTÉRESSÉ','INTERESSE')] || '#888' }}>{p.statut}</span>
                    <span style={{ fontFamily:'Syne', fontWeight:700, fontSize:14 }}>{p.count}</span>
                  </div>
                  <div style={{ height:8, background:'#F7F7F5', borderRadius:4 }}>
                    <div style={{ height:'100%', width:`${kpi.nbTotal>0?Math.round(p.count/kpi.nbTotal*100):0}%`, background:Object.values(PIPELINE_COLORS)[i]||'#888', borderRadius:4, transition:'width 0.5s' }}/>
                  </div>
                  <div style={{ fontSize:10, color:'#aaa' }}>{kpi.nbTotal>0?Math.round(p.count/kpi.nbTotal*100):0}%</div>
                </div>
              ))}
            </div>

            {/* Canaux les plus efficaces */}
            <div className="card">
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>📡 Canaux de relance (mois)</div>
              {canaux.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={canaux.map(c=>({name:c.canal,value:c.count}))} cx="50%" cy="50%" outerRadius={75} paddingAngle={3} dataKey="value">
                      {canaux.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={v=>[`${v} relance(s)`, '']}/>
                    <Legend formatter={v=><span style={{ fontSize:11 }}>{v}</span>}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>Aucune relance ce mois</div>
              )}
            </div>
          </div>

          {/* Conversions récentes */}
          {conversions.length > 0 && (
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>🎉 Conversions récentes</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {conversions.map((c,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'#EAF3DE', borderRadius:8 }}>
                    <CheckCircle size={14} color="#27500A"/>
                    <div style={{ flex:1 }}>
                      <span style={{ fontWeight:600, fontSize:12 }}>{c.prenom} {c.nom}</span>
                      <span style={{ fontSize:11, color:'#888', marginLeft:8 }}>converti par {c.commercialNom||'—'}</span>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {c.canalConversion && <span style={{ fontSize:10, background:'white', borderRadius:10, padding:'2px 8px', border:'1px solid #27500A20', color:'#27500A' }}>{c.canalConversion}</span>}
                      <span style={{ fontSize:10, color:'#888' }}>{new Date(c.updatedAt).toLocaleDateString('fr')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* VUE PIPELINE + LISTE */}
      {(view === 'pipeline' || view === 'liste') && (
        <>
          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            {['','PROSPECT','CONTACTE','INTERESSE','NEGOCIE','CLIENT','PERDU'].map(s => (
              <button key={s} onClick={() => setStatutFilter(s)} className={`filter-btn ${statutFilter===s?'active':''}`}
                style={{ display:'flex', alignItems:'center', gap:4 }}>
                {!s && '👥 Tous'}
                {s && <><span style={{ width:8, height:8, borderRadius:'50%', background:PIPELINE_COLORS[s]||'#888', display:'inline-block' }}/>{s}</>}
              </button>
            ))}
            <input className="input" style={{ marginLeft:'auto', width:200 }} placeholder="🔍 Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>

          {view === 'liste' && (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="table-container">
                <table className="table-erp">
                  <thead>
                    <tr>
                      <th>Prospect</th><th>Téléphone</th><th>Commercial</th>
                      <th>Statut</th><th>Relances</th><th>Dernière relance</th>
                      <th>Prochaine</th><th>Source</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && <tr><td colSpan={9} style={{ textAlign:'center', padding:20, color:'#888' }}>Chargement...</td></tr>}
                    {prospects.map(p => {
                      const enRetard = p._crm?.derniereRelance && p.relances?.some(r=>r.statut==='planifiee'&&r.prochain&&new Date(r.prochain)<new Date());
                      return (
                        <tr key={p.id} style={{ cursor:'pointer' }} onClick={() => setSelected(p)}>
                          <td style={{ fontWeight:600 }}>{p.prenom} {p.nom}</td>
                          <td style={{ fontSize:11, color:'#888' }}>{p.telephone}</td>
                          <td style={{ fontSize:11 }}>{p.commercialNom || '—'}</td>
                          <td><span style={{ fontSize:10, background:PIPELINE_COLORS[p.statut]+'20', color:PIPELINE_COLORS[p.statut]||'#888', borderRadius:10, padding:'2px 8px', fontWeight:500 }}>{p.statut}</span></td>
                          <td style={{ textAlign:'center', fontWeight:600, color:'#1a3f6f' }}>{p._crm?.nbRelances||0}</td>
                          <td style={{ fontSize:11 }}>
                            {p._crm?.derniereRelance ? (
                              <span>📞 {new Date(p._crm.derniereRelance.date).toLocaleDateString('fr')} · {p._crm.derniereRelance.canal}</span>
                            ) : <span style={{ color:'#aaa' }}>Jamais</span>}
                          </td>
                          <td style={{ fontSize:11 }}>
                            {p._crm?.prochaineRelance ? (
                              <span style={{ color:'#BA7517' }}>📅 {new Date(p._crm.prochaineRelance).toLocaleDateString('fr')}</span>
                            ) : enRetard ? (
                              <span style={{ color:'#A32D2D', fontWeight:600 }}>⚠ En retard</span>
                            ) : <span style={{ color:'#aaa' }}>—</span>}
                          </td>
                          <td style={{ fontSize:11, color:'#888' }}>{p.sourceAcquisition || '—'}</td>
                          <td>
                            <button className="btn btn-ghost btn-xs" style={{ color:'#1a3f6f' }} onClick={e=>{e.stopPropagation();setSelected(p);}}>
                              <ChevronRight size={12}/>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!isLoading && prospects.length === 0 && (
                      <tr><td colSpan={9}><div className="empty-state"><p>Aucun prospect trouvé</p></div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'pipeline' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>
              {prospects.map(p => {
                const enRetard = p.relances?.some(r=>r.statut==='planifiee'&&r.prochain&&new Date(r.prochain)<new Date());
                return (
                  <div key={p.id} style={{ background:'white', border:`1.5px solid ${enRetard?'#F7C1C1':'#e8e7e1'}`, borderRadius:10, padding:14, cursor:'pointer' }} onClick={() => setSelected(p)}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13 }}>{p.prenom} {p.nom}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{p.telephone}</div>
                      </div>
                      <span style={{ fontSize:10, background:PIPELINE_COLORS[p.statut]+'20', color:PIPELINE_COLORS[p.statut]||'#888', borderRadius:10, padding:'3px 8px', height:'fit-content', fontWeight:500 }}>{p.statut}</span>
                    </div>
                    <div style={{ display:'flex', gap:8, fontSize:11, color:'#888', marginBottom:6 }}>
                      <span>📞 {p._crm?.nbRelances||0} relance(s)</span>
                      {p.commercialNom && <span>· {p.commercialNom}</span>}
                    </div>
                    {p._crm?.derniereRelance && (
                      <div style={{ fontSize:11, color:'#555', marginBottom:4 }}>
                        Dernier contact : {new Date(p._crm.derniereRelance.date).toLocaleDateString('fr')} ({p._crm.derniereRelance.canal})
                      </div>
                    )}
                    {enRetard && <div style={{ fontSize:11, color:'#A32D2D', fontWeight:500 }}>⚠ Relance en retard</div>}
                    {p._crm?.prochaineRelance && !enRetard && (
                      <div style={{ fontSize:11, color:'#BA7517' }}>📅 Prévu {new Date(p._crm.prochaineRelance).toLocaleDateString('fr')}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Fiche prospect */}
      {selected && (
        <FicheProspect prospect={selected} onClose={() => setSelected(null)}
          onRefresh={() => { qc.invalidateQueries(['crm-prospects']); qc.invalidateQueries(['crm-dashboard']); setSelected(null); }}/>
      )}

      {/* Créer prospect */}
      {showCreate && (
        <ModalCreateProspect onClose={() => setShowCreate(false)} onSave={createProspect.mutate} loading={createProspect.isPending}/>
      )}
    </div>
  );
}

function ModalCreateProspect({ onClose, onSave, loading }) {
  const { user } = useAuthStore();
  const [form, setForm] = useState({ nom:'', prenom:'', telephone:'', email:'', adresse:'', profession:'', numeroCni:'', statut:'PROSPECT', sourceAcquisition:'', commercialId: user?.id||'', commercialNom: user ? `${user.prenom} ${user.nom}` : '' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:500 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>🎯 Nouveau prospect</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div className="form-grid">
          <div><label className="label">Prénom *</label><input className="input" value={form.prenom} onChange={e=>set('prenom',e.target.value)}/></div>
          <div><label className="label">Nom *</label><input className="input" value={form.nom} onChange={e=>set('nom',e.target.value)}/></div>
          <div><label className="label">Téléphone *</label><input className="input" value={form.telephone} onChange={e=>set('telephone',e.target.value)}/></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
          <div className="full"><label className="label">Profession</label><input className="input" value={form.profession} onChange={e=>set('profession',e.target.value)}/></div>
          <div>
            <label className="label">Source d'acquisition</label>
            <select className="input" value={form.sourceAcquisition} onChange={e=>set('sourceAcquisition',e.target.value)}>
              <option value="">— Non définie —</option>
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
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!form.nom||!form.prenom||!form.telephone||loading}
            style={{ background:'#1a3f6f', border:'none' }}
            onClick={() => onSave({ ...form, code:`PROS-${Date.now().toString(36).toUpperCase().slice(-5)}` })}>
            {loading ? 'Création...' : 'Créer le prospect'}
          </button>
        </div>
      </div>
    </div>
  );
}
