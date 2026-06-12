/**
 * CENTRE DE PILOTAGE FINANCIER — ERP 2IG
 * Vue stratégique DG/DAF : CA, marges, trésorerie, répartition, alertes, drill-down
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, ComposedChart
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft,
  AlertTriangle, Plus, X, Download, RefreshCw, ChevronDown,
  Building2, Truck, Flame, CheckCircle, Activity
} from 'lucide-react';
import ExportBar from '../../components/ui/ExportBar';
import { exportExcel, exportPDF } from '../../lib/export';

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtF = n => {
  if (!n && n !== 0) return '0 F';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}${(abs/1000000).toFixed(2)}M F`;
  if (abs >= 1000) return `${sign}${Math.round(abs/1000)}k F`;
  return `${sign}${Math.round(abs).toLocaleString('fr')} F`;
};
const fmtPct = n => `${n >= 0 ? '+' : ''}${n}%`;
const varColor = n => n > 0 ? '#27500A' : n < 0 ? '#A32D2D' : '#888';

const PIE_COLORS = ['#1a3f6f','#E87722','#27500A','#FFCC00','#0A66C2','#5F5E5A','#A32D2D','#888'];
const FILIALE_CONFIG = {
  YAKRO_GRILL: { label:'Yakro Grill', color:'#8B1A1A', icon:Flame },
  TOPTELSIG: { label:'TOPTELSIG', color:'#1a3f6f', icon:Building2 },
  LIYA: { label:'LiYA', color:'#E85D04', icon:Truck },
  GROUPE: { label:'Groupe', color:'#1a1a1a', icon:Activity },
};
const PERIODES = [
  ['aujourd', "Auj."], ['hier', 'Hier'], ['semaine', '7j'],
  ['mois', 'Mois'], ['trimestre', 'Trimestre'], ['annee', 'Année'],
];

// ── Tooltip enrichi ──────────────────────────────────────────────────────────
const RichTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:10, padding:'10px 14px', fontSize:11, boxShadow:'0 8px 24px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight:700, marginBottom:6, color:'#1a1a1a' }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:p.color, flexShrink:0 }}/>
          <span style={{ color:'#555' }}>{p.name}:</span>
          <strong style={{ color:p.color }}>{typeof p.value==='number' ? fmtF(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, variation, sub, color='#1a3f6f', icon:Icon, onClick, highlight }) {
  return (
    <div className="kpi" style={{ cursor:onClick?'pointer':'default', borderTop:`3px solid ${color}`, transition:'box-shadow 0.2s', boxShadow: highlight?`0 0 0 2px ${color}40`:undefined }}
      onClick={onClick}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
        <div style={{ minWidth:0 }}>
          <div className="kpi-label" style={{ marginBottom:4 }}>{label}</div>
          <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:20, color, lineHeight:1 }}>{value}</div>
          {sub && <div style={{ fontSize:10, color:'#888', marginTop:3 }}>{sub}</div>}
          {variation !== undefined && (
            <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:5, fontSize:11, color:varColor(variation) }}>
              {variation > 0 ? <TrendingUp size={11}/> : variation < 0 ? <TrendingDown size={11}/> : null}
              <span>{fmtPct(variation)} vs période préc.</span>
            </div>
          )}
        </div>
        {Icon && (
          <div style={{ width:36, height:36, borderRadius:10, background:color+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Icon size={16} style={{ color }}/>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Alerte ───────────────────────────────────────────────────────────────────
function AlerteBadge({ alerte }) {
  const bg = alerte.gravite === 'CRITIQUE' ? '#FDF2F2' : '#FAEEDA';
  const border = alerte.gravite === 'CRITIQUE' ? '#F7C1C1' : '#FAC775';
  const textColor = alerte.gravite === 'CRITIQUE' ? '#A32D2D' : '#412402';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:bg, border:`1px solid ${border}`, borderRadius:8 }}>
      <AlertTriangle size={13} color={textColor} style={{ flexShrink:0 }}/>
      <span style={{ fontSize:12, color:textColor }}>{alerte.msg}</span>
      <span style={{ fontSize:10, background:textColor+'18', color:textColor, borderRadius:10, padding:'1px 6px', marginLeft:'auto', flexShrink:0 }}>{alerte.gravite}</span>
    </div>
  );
}

// ── Composant barre filiale ───────────────────────────────────────────────────
function FilialeBar({ data, totalCA }) {
  if (!data?.length) return <div style={{ color:'#ccc', fontSize:12, textAlign:'center', padding:20 }}>Aucune donnée</div>;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {data.sort((a,b) => b.ca-a.ca).map((f,i) => {
        const cfg = FILIALE_CONFIG[f.filiale] || {};
        const pct = totalCA > 0 ? Math.round(f.ca/totalCA*100) : 0;
        return (
          <div key={i}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:cfg.color||'#888' }}/>
                <span style={{ fontSize:12, fontWeight:500 }}>{cfg.label||f.filiale}</span>
              </div>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <span style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, color:cfg.color||'#888' }}>{fmtF(f.ca)}</span>
                <span style={{ fontSize:10, color:'#888' }}>{pct}%</span>
                {f.marge !== undefined && (
                  <span style={{ fontSize:10, background:f.marge>=0?'#EAF3DE':'#FCEBEB', color:f.marge>=0?'#27500A':'#A32D2D', borderRadius:6, padding:'1px 6px' }}>
                    {f.marge}%
                  </span>
                )}
              </div>
            </div>
            <div style={{ height:8, background:'#F7F7F5', borderRadius:4 }}>
              <div style={{ height:'100%', width:`${pct}%`, background:cfg.color||'#888', borderRadius:4, transition:'width 0.6s ease' }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────────────────
export default function FinancePage() {
  const { filiale } = useAuthStore();
  const qc = useQueryClient();
  const [periode, setPeriode] = useState('mois');
  const [filialeFilter, setFilialeFilter] = useState('');
  const [showFiltresAvances, setShowFiltresAvances] = useState(false);
  const [showEnc, setShowEnc] = useState(false);
  const [showDec, setShowDec] = useState(false);
  const [formEnc, setFormEnc] = useState({ montant:'', typePaiement:'ESPECES', motif:'', categorie:'', filiale:filiale==='GROUPE'?'YAKRO_GRILL':filiale });
  const [formDec, setFormDec] = useState({ montant:'', typePaiement:'ESPECES', motif:'', categorie:'', beneficiaire:'', filiale:filiale==='GROUPE'?'YAKRO_GRILL':filiale });
  const [toast, setToast] = useState(null);
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };
  const [drillDown, setDrillDown] = useState(null); // { type, label, value }

  const { data: d, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['finance-pilotage', periode, filialeFilter],
    queryFn: () => financeAPI.pilotage({ periode, filiale: filialeFilter||undefined }),
    staleTime: 30000,
    refetchInterval: 120000,
  });

  const { data: listeEnc = [] } = useQuery({
    queryKey: ['enc-detail', periode, filialeFilter],
    queryFn: () => financeAPI.encaissements({ periode, filiale:filialeFilter||undefined, limit:50 }),
  });
  const { data: listeDec = [] } = useQuery({
    queryKey: ['dec-detail', periode, filialeFilter],
    queryFn: () => financeAPI.decaissements({ periode, filiale:filialeFilter||undefined, limit:50 }),
  });

  const createEnc = useMutation({ mutationFn: financeAPI.createEncaissement, onSuccess:()=>{ qc.invalidateQueries(['finance-pilotage','enc-detail']); setShowEnc(false); showToast('Encaissement enregistré ✓'); } });
  const createDec = useMutation({ mutationFn: financeAPI.createDecaissement, onSuccess:()=>{ qc.invalidateQueries(['finance-pilotage','dec-detail']); setShowDec(false); showToast('Décaissement enregistré ✓'); } });

  const kpi = d?.kpi || {};
  const filiales = d?.filiales || [];
  const paiements = d?.paiements || [];
  const depenses = d?.depenses || [];
  const caisses = d?.caisses || [];
  const activites = d?.activites || {};
  const courbe = d?.courbe || [];
  const alertes = d?.alertes || [];
  const TYPES_PAI = ['ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE'];
  const encList = Array.isArray(listeEnc) ? listeEnc : [];
  const decList = Array.isArray(listeDec) ? listeDec : [];

  const exportExcelData = () => {
    exportExcel('finance_pilotage', 'Pilotage', ['Filiale','CA','Dépenses','Résultat','Marge %'],
      filiales.map(f => [f.filiale, f.ca, f.dep, f.resultat, f.marge+'%']));
  };

  return (
    <div className="page-enter">
      {isError && (
        <div style={{ background:'#FCEBEB', border:'1px solid #F7C1C1', borderRadius:8, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#A32D2D' }}>
          ⚠ Erreur chargement Finance : {error?.response?.data?.error || error?.message || 'Erreur serveur'}
          <button className="btn btn-ghost btn-xs" style={{ marginLeft:12 }} onClick={()=>refetch()}>Réessayer</button>
        </div>
      )}
      {/* ── HEADER ── */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:22 }}>
            💹 Centre de Pilotage Financier
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            Groupe 2IG · Vision stratégique DG/DAF · {new Date().toLocaleDateString('fr', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>refetch()} title="Actualiser"><RefreshCw size={13}/></button>
          <ExportBar onExcelClick={exportExcelData} />
          <button className="btn btn-primary btn-sm" style={{ background:'#27500A', border:'none' }} onClick={()=>setShowEnc(true)}>
            <ArrowUpRight size={13}/> Encaissement
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color:'#A32D2D', borderColor:'#F7C1C1' }} onClick={()=>setShowDec(true)}>
            <ArrowDownLeft size={13}/> Décaissement
          </button>
        </div>
      </div>

      {/* ── FILTRES GLOBAUX ── */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        {PERIODES.map(([k,v]) => (
          <button key={k} onClick={()=>setPeriode(k)} className={`filter-btn ${periode===k?'active':''}`}>{v}</button>
        ))}
        <div style={{ width:1, height:20, background:'#e8e7e1', margin:'0 4px' }}/>
        {filiale === 'GROUPE' && (
          <>
            {[['','Groupe entier'],['YAKRO_GRILL','Yakro Grill'],['TOPTELSIG','TOPTELSIG'],['LIYA','LiYA']].map(([k,v]) => (
              <button key={k} onClick={()=>setFilialeFilter(k)} className={`filter-btn ${filialeFilter===k?'active':''}`}>{v}</button>
            ))}
          </>
        )}
        <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={()=>setShowFiltresAvances(!showFiltresAvances)}>
          ⚙️ Filtres avancés <ChevronDown size={12}/>
        </button>
        {isLoading && <div style={{ fontSize:11, color:'#888', display:'flex', alignItems:'center', gap:4 }}><RefreshCw size={10} style={{ animation:'spin 1s linear infinite' }}/> Chargement...</div>}
      </div>

      {/* ── ALERTES ── */}
      {alertes.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:16 }}>
          {alertes.map((a,i) => <AlerteBadge key={i} alerte={a}/>)}
        </div>
      )}

      {/* ── KPI EXÉCUTIFS ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20 }}>
        <KPICard label="CA Groupe" value={fmtF(kpi.caTotal)} variation={kpi.variationCA} color="#1a3f6f" icon={TrendingUp} sub={`Période préc: ${fmtF(kpi.caPrec)}`}/>
        <KPICard label="Dépenses" value={fmtF(kpi.depTotal)} variation={kpi.variationDep} color="#A32D2D" icon={ArrowDownLeft} sub={`Période préc: ${fmtF(kpi.depPrec)}`}/>
        <KPICard label="Résultat Brut" value={fmtF(kpi.resultatBrut)} color={kpi.resultatBrut>=0?'#27500A':'#A32D2D'} icon={Activity} sub={`Marge: ${kpi.marge||0}%`}/>
        <KPICard label="Trésorerie" value={fmtF(kpi.tresorerie)} color="#1a3f6f" icon={Wallet} sub={`${caisses.length} caisse(s)`}/>
        <KPICard label="Retards paiement" value={kpi.retardsPmt||0} color={kpi.retardsPmt>0?'#A32D2D':'#27500A'} icon={kpi.retardsPmt>0?AlertTriangle:CheckCircle} sub="Échéances foncières"/>
      </div>

      {/* ── LIGNE 1 : Courbe CA + Répartition filiales ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:14, marginBottom:20 }}>
        {/* Courbe 30 jours */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:4 }}>📈 Évolution Encaissements / Décaissements</div>
          <div style={{ fontSize:11, color:'#888', marginBottom:12 }}>30 derniers jours</div>
          {courbe.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={courbe}>
                <defs>
                  <linearGradient id="gCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a3f6f" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#1a3f6f" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9"/>
                <XAxis dataKey="date" tick={{ fontSize:9 }} interval={4}/>
                <YAxis tick={{ fontSize:9 }} tickFormatter={v=>v>=1000000?`${(v/1000000).toFixed(1)}M`:v>=1000?`${Math.round(v/1000)}k`:v}/>
                <Tooltip content={<RichTooltip/>}/>
                <Legend iconSize={10} wrapperStyle={{ fontSize:11 }}/>
                <Area type="monotone" dataKey="encaissements" name="Encaissements" fill="url(#gCA)" stroke="#1a3f6f" strokeWidth={2}/>
                <Bar dataKey="decaissements" name="Décaissements" fill="#A32D2D" opacity={0.7} radius={[2,2,0,0]}/>
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>
              {isLoading ? 'Chargement...' : 'Aucune donnée pour cette période'}
            </div>
          )}
        </div>

        {/* Répartition par filiale */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:4 }}>🏢 Répartition CA par filiale</div>
          <div style={{ fontSize:11, color:'#888', marginBottom:16 }}>Contribution au CA groupe + marges</div>
          <FilialeBar data={filiales} totalCA={kpi.caTotal}/>
          {filiales.length === 0 && !isLoading && (
            <div style={{ color:'#ccc', fontSize:12, textAlign:'center', padding:20 }}>Aucune donnée pour cette période</div>
          )}
        </div>
      </div>

      {/* ── LIGNE 2 : Activités + Modes paiement ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:20 }}>
        {/* Performance par activité */}
        {[
          { key:'yakro', label:'🔥 Yakro Grill', color:'#8B1A1A', metric1:{ label:'CA restaurant', val:activites.yakro?.ca }, metric2:{ label:'Commandes', val:activites.yakro?.nbCommandes } },
          { key:'toptelsig', label:'📍 TOPTELSIG', color:'#1a3f6f', metric1:{ label:'CA foncier', val:activites.toptelsig?.ca }, metric2:{ label:'Lots vendus', val:activites.toptelsig?.lotsVendus } },
          { key:'liya', label:'🛵 LiYA', color:'#E85D04', metric1:{ label:'CA livraison', val:activites.liya?.ca }, metric2:{ label:'Livraisons', val:activites.liya?.nbLivraisons } },
        ].map((act,i) => (
          <div key={i} className="card" style={{ borderTop:`3px solid ${act.color}` }}>
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, marginBottom:12 }}>{act.label}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ background:'#F7F7F5', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                <div style={{ fontSize:9, color:'#888', marginBottom:2 }}>{act.metric1.label}</div>
                <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:16, color:act.color }}>{fmtF(act.metric1.val||0)}</div>
              </div>
              <div style={{ background:'#F7F7F5', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                <div style={{ fontSize:9, color:'#888', marginBottom:2 }}>{act.metric2.label}</div>
                <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:16, color:act.color }}>{(act.metric2.val||0).toLocaleString('fr')}</div>
              </div>
            </div>
            {/* Part du CA */}
            {kpi.caTotal > 0 && (
              <div style={{ marginTop:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#888', marginBottom:3 }}>
                  <span>Part du CA groupe</span>
                  <span style={{ fontWeight:600, color:act.color }}>
                    {Math.round((act.metric1.val||0)/kpi.caTotal*100)}%
                  </span>
                </div>
                <div style={{ height:5, background:'#F7F7F5', borderRadius:3 }}>
                  <div style={{ height:'100%', width:`${kpi.caTotal>0?Math.min(Math.round((act.metric1.val||0)/kpi.caTotal*100),100):0}%`, background:act.color, borderRadius:3, transition:'width 0.6s' }}/>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── LIGNE 3 : Modes paiement + Dépenses par catégorie ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        {/* Modes de paiement */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>💳 Répartition des encaissements par mode</div>
          {paiements.length > 0 ? (
            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              <div style={{ width:160, height:160, flexShrink:0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paiements} cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3} dataKey="montant">
                      {paiements.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={v=>[fmtF(v),'']}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                {paiements.sort((a,b)=>b.montant-a.montant).map((p,i) => {
                  const total = paiements.reduce((s,x)=>s+x.montant,0);
                  const pct = total>0 ? Math.round(p.montant/total*100) : 0;
                  return (
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
                          <span style={{ width:8, height:8, borderRadius:'50%', background:PIE_COLORS[i%PIE_COLORS.length], display:'inline-block' }}/>
                          {p.mode?.replace('_',' ')}
                        </div>
                        <div style={{ display:'flex', gap:8, fontSize:11 }}>
                          <span style={{ fontWeight:600 }}>{fmtF(p.montant)}</span>
                          <span style={{ color:'#888' }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ height:3, background:'#F7F7F5', borderRadius:2 }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:PIE_COLORS[i%PIE_COLORS.length], borderRadius:2 }}/>
                      </div>
                      <div style={{ fontSize:9, color:'#aaa', textAlign:'right' }}>{p.nbTransactions||0} transactions · moy. {fmtF(p.ticketMoyen||0)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>
              {isLoading ? 'Chargement...' : 'Aucune transaction pour cette période'}
            </div>
          )}
        </div>

        {/* Top 10 dépenses par catégorie */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>📊 Analyse des dépenses par catégorie</div>
          {depenses.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {depenses.slice(0,8).map((dep,i) => {
                const gravite = dep.pct > 30 ? 'rouge' : dep.pct > 15 ? 'orange' : 'vert';
                const barColor = gravite==='rouge' ? '#A32D2D' : gravite==='orange' ? '#E87722' : '#27500A';
                return (
                  <div key={i}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                      <span style={{ fontSize:11 }}>{dep.categorie || 'Autre'}</span>
                      <div style={{ display:'flex', gap:8 }}>
                        <span style={{ fontFamily:'Syne', fontWeight:600, fontSize:11 }}>{fmtF(dep.montant)}</span>
                        <span style={{ fontSize:10, background:barColor+'18', color:barColor, borderRadius:6, padding:'1px 6px', minWidth:30, textAlign:'center' }}>{dep.pct}%</span>
                      </div>
                    </div>
                    <div style={{ height:4, background:'#F7F7F5', borderRadius:2 }}>
                      <div style={{ height:'100%', width:`${dep.pct}%`, background:barColor, borderRadius:2, transition:'width 0.6s' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>
              {isLoading ? 'Chargement...' : 'Aucune dépense pour cette période'}
            </div>
          )}
        </div>
      </div>

      {/* ── CAISSES ── */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>🏦 État des caisses & trésorerie</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
          {caisses.map(c => {
            const cfg = FILIALE_CONFIG[c.filiale] || {};
            return (
              <div key={c.id} style={{ background:'#F7F7F5', borderRadius:10, padding:'12px 14px', borderLeft:`3px solid ${cfg.color||'#888'}` }}>
                <div style={{ fontSize:11, color:'#888', marginBottom:3 }}>{c.nom}</div>
                <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:20, color:c.solde>=0?(cfg.color||'#1a3f6f'):'#A32D2D' }}>{fmtF(c.solde)}</div>
                <span style={{ fontSize:10, background:(cfg.color||'#888')+'18', color:cfg.color||'#888', borderRadius:6, padding:'2px 8px', marginTop:6, display:'inline-block' }}>{cfg.label||c.filiale}</span>
              </div>
            );
          })}
          {caisses.length === 0 && <div style={{ color:'#ccc', fontSize:12 }}>Aucune caisse active</div>}
        </div>

        {/* Solde total */}
        <div style={{ marginTop:16, padding:'12px 16px', background:'white', borderRadius:10, border:'0.5px solid #e8e7e1', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontWeight:600, fontSize:13 }}>💰 Trésorerie totale groupe</span>
          <span style={{ fontFamily:'Syne', fontWeight:800, fontSize:22, color:kpi.tresorerie>=0?'#1a3f6f':'#A32D2D' }}>{fmtF(kpi.tresorerie)}</span>
        </div>
      </div>

      {/* ── MOUVEMENTS DÉTAILLÉS ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #e8e7e1', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, color:'#27500A' }}>↑ Encaissements récents</div>
            <span style={{ fontSize:11, color:'#888' }}>{encList.length} entrée(s)</span>
          </div>
          <div className="table-container">
            <table className="table-erp">
              <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Filiale</th><th>Motif</th></tr></thead>
              <tbody>
                {encList.slice(0,8).map(e => (
                  <tr key={e.id}>
                    <td style={{ fontSize:10 }}>{new Date(e.createdAt).toLocaleDateString('fr',{day:'2-digit',month:'short'})}</td>
                    <td style={{ fontWeight:700, color:'#27500A', fontSize:12 }}>{fmtF(e.montant)}</td>
                    <td><span className="badge badge-green" style={{ fontSize:9 }}>{e.typePaiement?.replace('_',' ')}</span></td>
                    <td style={{ fontSize:10, color:'#888' }}>{e.filiale?.replace('_',' ')}</td>
                    <td style={{ fontSize:10, color:'#555', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.motif}</td>
                  </tr>
                ))}
                {encList.length===0 && <tr><td colSpan={5}><div className="empty-state" style={{ padding:16 }}><p>Aucun encaissement</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #e8e7e1', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, color:'#A32D2D' }}>↓ Décaissements récents</div>
            <span style={{ fontSize:11, color:'#888' }}>{decList.length} sortie(s)</span>
          </div>
          <div className="table-container">
            <table className="table-erp">
              <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Filiale</th><th>Motif</th></tr></thead>
              <tbody>
                {decList.slice(0,8).map(d => (
                  <tr key={d.id}>
                    <td style={{ fontSize:10 }}>{new Date(d.createdAt).toLocaleDateString('fr',{day:'2-digit',month:'short'})}</td>
                    <td style={{ fontWeight:700, color:'#A32D2D', fontSize:12 }}>{fmtF(d.montant)}</td>
                    <td><span className="badge badge-red" style={{ fontSize:9 }}>{d.typePaiement?.replace('_',' ')}</span></td>
                    <td style={{ fontSize:10, color:'#888' }}>{d.filiale?.replace('_',' ')}</td>
                    <td style={{ fontSize:10, color:'#555', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.motif}</td>
                  </tr>
                ))}
                {decList.length===0 && <tr><td colSpan={5}><div className="empty-state" style={{ padding:16 }}><p>Aucun décaissement</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {showEnc && (
        <div className="modal-overlay" onClick={()=>setShowEnc(false)}>
          <div className="modal" style={{ maxWidth:440 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', color:'#27500A' }}>↑ Nouvel encaissement</h3>
              <button onClick={()=>setShowEnc(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div className="form-grid">
              <div className="full"><label className="label">Montant *</label><input className="input" type="number" value={formEnc.montant} onChange={e=>setFormEnc(f=>({...f,montant:e.target.value}))} placeholder="0 FCFA"/></div>
              <div><label className="label">Mode paiement</label>
                <select className="input" value={formEnc.typePaiement} onChange={e=>setFormEnc(f=>({...f,typePaiement:e.target.value}))}>
                  {TYPES_PAI.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Filiale</label>
                <select className="input" value={formEnc.filiale} onChange={e=>setFormEnc(f=>({...f,filiale:e.target.value}))}>
                  {[['YAKRO_GRILL','Yakro Grill'],['TOPTELSIG','TOPTELSIG'],['LIYA','LiYA'],['GROUPE','Groupe']].map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="full"><label className="label">Motif *</label><input className="input" value={formEnc.motif} onChange={e=>setFormEnc(f=>({...f,motif:e.target.value}))}/></div>
              <div className="full"><label className="label">Catégorie</label><input className="input" value={formEnc.categorie} onChange={e=>setFormEnc(f=>({...f,categorie:e.target.value}))}/></div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
              <button className="btn btn-ghost" onClick={()=>setShowEnc(false)}>Annuler</button>
              <button disabled={!formEnc.montant||!formEnc.motif||createEnc.isPending}
                style={{ background:'#27500A', color:'white', border:'none', borderRadius:8, padding:'8px 18px', cursor:'pointer', fontWeight:500, opacity:!formEnc.montant||!formEnc.motif?0.5:1 }}
                onClick={()=>createEnc.mutate({...formEnc, montant:Number(formEnc.montant)})}>
                {createEnc.isPending?'...':'Encaisser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDec && (
        <div className="modal-overlay" onClick={()=>setShowDec(false)}>
          <div className="modal" style={{ maxWidth:440 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', color:'#A32D2D' }}>↓ Nouveau décaissement</h3>
              <button onClick={()=>setShowDec(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div className="form-grid">
              <div className="full"><label className="label">Montant *</label><input className="input" type="number" value={formDec.montant} onChange={e=>setFormDec(f=>({...f,montant:e.target.value}))}/></div>
              <div><label className="label">Mode paiement</label>
                <select className="input" value={formDec.typePaiement} onChange={e=>setFormDec(f=>({...f,typePaiement:e.target.value}))}>
                  {TYPES_PAI.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Filiale</label>
                <select className="input" value={formDec.filiale} onChange={e=>setFormDec(f=>({...f,filiale:e.target.value}))}>
                  {[['YAKRO_GRILL','Yakro Grill'],['TOPTELSIG','TOPTELSIG'],['LIYA','LiYA'],['GROUPE','Groupe']].map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="full"><label className="label">Motif *</label><input className="input" value={formDec.motif} onChange={e=>setFormDec(f=>({...f,motif:e.target.value}))}/></div>
              <div className="full"><label className="label">Bénéficiaire</label><input className="input" value={formDec.beneficiaire} onChange={e=>setFormDec(f=>({...f,beneficiaire:e.target.value}))}/></div>
              <div className="full"><label className="label">Catégorie</label>
                <select className="input" value={formDec.categorie} onChange={e=>setFormDec(f=>({...f,categorie:e.target.value}))}>
                  <option value="">— Choisir —</option>
                  {['Salaires','Carburant','Approvisionnement','Marketing','Communication','Maintenance','Loyer','Transport','Fiscalité','Prestations','Divers'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
              <button className="btn btn-ghost" onClick={()=>setShowDec(false)}>Annuler</button>
              <button disabled={!formDec.montant||!formDec.motif||createDec.isPending} className="btn btn-danger"
                onClick={()=>createDec.mutate({...formDec, montant:Number(formDec.montant)})}>
                {createDec.isPending?'...':'Décaisser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position:'fixed', bottom:20, right:16, background:toast.type==='error'?'#A32D2D':'#27500A', color:'white', padding:'12px 20px', borderRadius:10, fontSize:13, zIndex:9999, boxShadow:'0 4px 16px rgba(0,0,0,0.2)' }}>{toast.msg}</div>}
    </div>
  );
}
