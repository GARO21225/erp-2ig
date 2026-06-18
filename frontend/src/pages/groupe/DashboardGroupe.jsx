import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { dashboardAPI, alertesAPI } from '../../lib/api';
import AssistantERP from '../../components/ui/AssistantERP';
import CentreActions from '../../components/ui/CentreActions';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertTriangle, ChevronRight, Minus,
  Flame, MapPin, Truck, Users, Wallet, Package, Building2, Bike,
  Activity, Clock, CheckCircle
} from 'lucide-react';

const fmtF = (n) => {
  if (!n) return '0 F';
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M F`;
  if (n >= 1000) return `${Math.round(n/1000)}k F`;
  return Math.round(n).toLocaleString('fr') + ' F';
};
const fmtN = (n) => (n || 0).toLocaleString('fr');

const COLORS = { YAKRO: '#8B1A1A', TOPT: '#1a3f6f', LIYA: '#E85D04', ok: '#27500A' };
const PIE_COLORS = ['#8B1A1A', '#1a3f6f', '#E85D04', '#639922'];

// Tooltip personnalisé Recharts
const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          {p.name}: <strong>{prefix}{typeof p.value === 'number' ? p.value.toLocaleString('fr') : p.value}{suffix}</strong>
        </div>
      ))}
    </div>
  );
};

// KPI Card avec mini-trend
function KpiCard({ label, value, unit = '', delta, icon: Icon, color = '#1a3f6f', onClick, sub }) {
  const positive = delta > 0;
  return (
    <div className="kpi" style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value" style={{ fontSize: 22, color }}>
            {value}<span style={{ fontSize: 12, fontWeight: 400, color: '#888', marginLeft: 3 }}>{unit}</span>
          </div>
          {sub && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{sub}</div>}
          {delta !== undefined && (
            <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, color: positive ? '#27500A' : delta === 0 ? '#888' : '#A32D2D' }}>
              {positive ? <TrendingUp size={10} /> : delta === 0 ? <Minus size={10} /> : <TrendingDown size={10} />}
              {positive ? '+' : ''}{delta}% vs hier
            </div>
          )}
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

// Score Santé radial
function ScoreCard({ label, score, color, detail }) {
  const data = [{ value: score, fill: color }];
  return (
    <div style={{ textAlign: 'center', padding: '12px 8px' }}>
      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius={28} outerRadius={40} data={data} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#f0efe9' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: 'Syne', fontWeight: 800, fontSize: 15, color }}>
          {score}
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 10, color: '#888' }}>{detail}</div>
    </div>
  );
}

// ── Dashboards par filiale ────────────────────────────────────────────────
function DashboardYakro() {
  const navigate = useNavigate();
  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#8B1A1A' }}>🔥 Yakro Grill</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Restaurant · Yamoussoukro</p>
        </div>
      </div>
      <div className="grid-2">
        {[
          { label:'Plan de Salle (POS)', desc:'Gérer les tables et commandes', icon:Package, to:'/yakro/pos', color:'#8B1A1A' },
          { label:'Commandes du jour', desc:'Historique et suivi', icon:Package, to:'/yakro/commandes', color:'#8B1A1A' },
          { label:'Caisse du jour', desc:'CA et réinvestissement', icon:Wallet, to:'/yakro/caisse', color:'#8B1A1A' },
          { label:'Menu & Carte', desc:'80 articles', icon:Package, to:'/yakro/menu', color:'#8B1A1A' },
          { label:'Stocks & Approvisionnement', desc:'Matières premières', icon:Package, to:'/stocks', color:'#8B1A1A' },
          { label:'Réservations', desc:'Réserver une table', icon:Users, to:'/yakro/reservations', color:'#8B1A1A' },
        ].map((item,i) => (
          <div key={i} className="card" style={{ cursor:'pointer', borderLeft:'3px solid #8B1A1A' }} onClick={() => navigate(item.to)}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:8, background:'#FDF2F2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <item.icon size={16} style={{ color:'#8B1A1A' }} />
              </div>
              <div><div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14 }}>{item.label}</div><div style={{ fontSize:12, color:'#888' }}>{item.desc}</div></div>
              <ChevronRight size={14} color="#ccc" style={{ marginLeft:'auto' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardToptelsig() {
  const navigate = useNavigate();
  return (
    <div className="page-enter">
      <div className="page-header">
        <div><h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#1a3f6f' }}>📍 TOPTELSIG</h1><p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Foncier · Côte d'Ivoire</p></div>
      </div>
      <div className="grid-2">
        {[
          { label:'Projets Fonciers', desc:'Gérer les projets et lots', icon:Building2, to:'/toptelsig/projets' },
          { label:'Souscripteurs', desc:'Clients et contrats', icon:Users, to:'/toptelsig/souscripteurs' },
          { label:'Ventes & Échéanciers', desc:'Suivi des paiements', icon:TrendingUp, to:'/toptelsig/ventes' },
          { label:'Dépenses', desc:'Workflow 3 niveaux', icon:Wallet, to:'/toptelsig/depenses' },
          { label:'Prescripteurs', desc:'Réseau & commissions', icon:Users, to:'/toptelsig/prescripteurs' },
        ].map((item,i) => (
          <div key={i} className="card" style={{ cursor:'pointer', borderLeft:'3px solid #1a3f6f' }} onClick={() => navigate(item.to)}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:8, background:'#EEF3FB', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><item.icon size={16} style={{ color:'#1a3f6f' }} /></div>
              <div><div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14 }}>{item.label}</div><div style={{ fontSize:12, color:'#888' }}>{item.desc}</div></div>
              <ChevronRight size={14} color="#ccc" style={{ marginLeft:'auto' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardLiya() {
  const navigate = useNavigate();
  return (
    <div className="page-enter">
      <div className="page-header">
        <div><h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#E85D04' }}>🛵 LiYA</h1><p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Livraison · Yamoussoukro</p></div>
      </div>
      <div className="grid-2">
        {[
          { label:'Livraisons', to:'/liya/livraisons', icon:Truck },
          { label:'Motos & Flotte', to:'/liya/motos', icon:Bike },
          { label:'Carte GPS', to:'/liya/carte', icon:MapPin },
          { label:'Stock Clients 3PL', to:'/liya/stock3pl', icon:Package },
        ].map((item,i) => (
          <div key={i} className="card" style={{ cursor:'pointer', borderLeft:'3px solid #E85D04' }} onClick={() => navigate(item.to)}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:8, background:'#FFF0EB', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><item.icon size={16} style={{ color:'#E85D04' }} /></div>
              <div><div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14 }}>{item.label}</div></div>
              <ChevronRight size={14} color="#ccc" style={{ marginLeft:'auto' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard GROUPE (DG) enrichi ─────────────────────────────────────────
export default function DashboardGroupe() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // Ce composant attendait data/alertes/nbCritiques/scores en PROPS, mais
  // App.jsx le monte sans rien lui transmettre (<DashboardGroupe /> seul) —
  // alertes était donc toujours undefined, d'où le crash sur alertes.length
  // dès le premier rendu. Le composant récupère maintenant ses propres
  // données via useQuery, comme tous les autres dashboards de l'app
  // (DashboardToptelsig, DashboardYakro).
  const { data } = useQuery({ queryKey: ['dashboard-groupe'], queryFn: dashboardAPI.groupe, staleTime: 30000 });
  const { data: alertesData } = useQuery({ queryKey: ['dashboard-alertes'], queryFn: alertesAPI.critiques, staleTime: 60000 });
  const { data: scores = [] } = useQuery({ queryKey: ['dashboard-score-sante'], queryFn: dashboardAPI.scoreSante, staleTime: 60000 });

  const alertes = alertesData?.alertes || [];
  const nbCritiques = alertesData?.critiques || 0;

  const courbeCA = data?.graphiques?.courbeCA || [];
  const camembert = (data?.graphiques?.camembertCA || []).filter(d => d.value > 0);
  const empParFiliale = data?.graphiques?.empParFiliale || [];

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:22 }}>Centre de Commandement DG</h1>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
            <div className="dot dot-green dot-pulse" />
            <span style={{ fontSize:12, color:'#888' }}>Vision temps réel · Groupe 2iG · 3 filiales</span>
            <span style={{ fontSize:11, color:'#1a3f6f', fontWeight:600, marginLeft:8 }}>
              <Clock size={11} style={{ verticalAlign:'middle', marginRight:3 }} />
              {now.toLocaleTimeString('fr', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
            </span>
          </div>
        </div>
        {nbCritiques > 0 && (
          <div style={{ background:'#FDF2F2', border:'1px solid #F7C1C1', borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:6 }}>
            <AlertTriangle size={14} color="#A32D2D" />
            <span style={{ fontSize:13, fontWeight:700, color:'#A32D2D' }}>{nbCritiques} critique(s)</span>
          </div>
        )}
      </div>

      {/* Alertes */}
      {alertes?.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:16 }}>
          {alertes.slice(0,3).map((a,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', background: a.gravite==='CRITIQUE'?'#FDF2F2':'#FAEEDA', borderRadius:8, border:`1px solid ${a.gravite==='CRITIQUE'?'#F7C1C1':'#FAC775'}` }}>
              <AlertTriangle size={13} color={a.gravite==='CRITIQUE'?'#A32D2D':'#BA7517'} style={{ flexShrink:0 }} />
              <span style={{ fontSize:12, color:a.gravite==='CRITIQUE'?'#A32D2D':'#412402', flex:1 }}>{a.message}</span>
              {a.detail && <span style={{ fontSize:11, color:'#888', flexShrink:0 }}>{a.detail}</span>}
            </div>
          ))}
        </div>
      )}

      {/* KPI Principale */}
      <div className="grid-kpi" style={{ marginBottom:20 }}>
        <KpiCard label="CA Groupe (mois)" value={fmtF(data?.ca?.mois)} icon={TrendingUp} color="#1a3f6f"
          delta={data?.ca?.evolution} sub={`Aujourd'hui: ${fmtF(data?.ca?.aujourdhui)}`} />
        <KpiCard label="Trésorerie Nette" value={fmtF(data?.tresorerie)} icon={Wallet} color="#27500A" />
        <KpiCard label="Employés Actifs" value={fmtN(data?.employes?.actifs)} unit="pers." icon={Users} color="#1a3f6f" />
        <KpiCard label="Lots Vendus" value={`${fmtN(data?.toptelsig?.lotsVendus)}/${fmtN(data?.toptelsig?.lotsTotal)}`}
          icon={Building2} color="#E85D04" sub={`${data?.toptelsig?.tauxVente || 0}% du parc`} />
      </div>

      {/* Graphiques ligne 1 : Courbe CA + Camembert CA */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        {/* Courbe CA 7 jours */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>
            📈 Évolution CA — 7 derniers jours
          </div>
          {courbeCA.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={courbeCA}>
                <defs>
                  <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a3f6f" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1a3f6f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9" />
                <XAxis dataKey="jour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
                <Tooltip content={<CustomTooltip suffix=" F" />} />
                <Area type="monotone" dataKey="ca" name="CA" stroke="#1a3f6f" fill="url(#gradCA)" strokeWidth={2} dot={{ r: 3, fill: '#1a3f6f' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>
              Aucune donnée encore — les ventes apparaîtront ici
            </div>
          )}
        </div>

        {/* Camembert CA par filiale */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>
            🥧 CA par filiale (mois)
          </div>
          {camembert.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={camembert} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                  {camembert.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtF(v)} />
                <Legend formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:180, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, color:'#ccc' }}>
              <Package size={32} style={{ opacity:0.3 }} />
              <span style={{ fontSize:12 }}>En attente de données</span>
            </div>
          )}
        </div>
      </div>

      {/* Graphiques ligne 2 : Employés par filiale + Scores santé */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        {/* Barres employés */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>👥 Employés par filiale</div>
          {empParFiliale.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={empParFiliale} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9" />
                <XAxis dataKey="filiale" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip suffix=" emp." />} />
                <Bar dataKey="count" name="Employés" radius={[4,4,0,0]}>
                  {empParFiliale.map((e, i) => (
                    <Cell key={i} fill={e.filiale.includes('YAKRO') ? '#8B1A1A' : e.filiale.includes('LIYA') ? '#E85D04' : '#1a3f6f'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>Aucun employé enregistré</div>
          )}
        </div>

        {/* Scores santé */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:8 }}>💚 Scores de santé filiales</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))' }}>
            {(scores || []).map(s => (
              <ScoreCard key={s.filiale} label={s.label} score={Math.round(s.score)} color={s.filiale==='YAKRO_GRILL'?'#8B1A1A':s.filiale==='LIYA'?'#E85D04':'#1a3f6f'} detail={s.detail} />
            ))}
          </div>
          <div style={{ textAlign:'center', marginTop:8, fontSize:11, color:'#888' }}>
            Score basé sur CA, taux livraison, ventes lots
          </div>
        </div>
      </div>

      {/* KPI secondaires par filiale */}
      <div className="grid-3" style={{ marginBottom:20 }}>
        {/* Yakro */}
        <div className="card" style={{ borderTop:'3px solid #8B1A1A', cursor:'pointer' }} onClick={() => navigate('/yakro/pos')}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'#FDF2F2', display:'flex', alignItems:'center', justifyContent:'center' }}><Flame size={14} style={{ color:'#8B1A1A' }} /></div>
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13 }}>Yakro Grill</div>
            <ChevronRight size={12} color="#ccc" style={{ marginLeft:'auto' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {[
              { label:'CA aujourd\'hui', value: fmtF(data?.ca?.aujourdhui), alert: false },
              { label:'Commandes', value: fmtN(data?.commandes?.total), alert: false },
              { label:'Tx. conversion', value: (data?.commandes?.tauxConversion||0)+'%', alert: data?.commandes?.tauxConversion < 50 },
              { label:'Réinvest. 50%', value: fmtF((data?.ca?.aujourdhui||0)*0.5), alert: false },
            ].map((m,i) => (
              <div key={i} style={{ background:'#F7F7F5', borderRadius:6, padding:'6px 8px' }}>
                <div style={{ fontSize:10, color:'#888' }}>{m.label}</div>
                <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:12, color:m.alert?'#A32D2D':'#1a1a1a' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TOPTELSIG */}
        <div className="card" style={{ borderTop:'3px solid #1a3f6f', cursor:'pointer' }} onClick={() => navigate('/toptelsig/projets')}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'#EEF3FB', display:'flex', alignItems:'center', justifyContent:'center' }}><MapPin size={14} style={{ color:'#1a3f6f' }} /></div>
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13 }}>TOPTELSIG</div>
            <ChevronRight size={12} color="#ccc" style={{ marginLeft:'auto' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {[
              { label:'Projets actifs', value: fmtN(data?.toptelsig?.projetsActifs) },
              { label:'Lots vendus', value: fmtN(data?.toptelsig?.lotsVendus) },
              { label:'Lots dispos', value: fmtN(data?.toptelsig?.lotsDispo) },
              { label:'Retards pmt.', value: fmtN(data?.toptelsig?.retards), alert: data?.toptelsig?.retards > 0 },
            ].map((m,i) => (
              <div key={i} style={{ background:'#F7F7F5', borderRadius:6, padding:'6px 8px' }}>
                <div style={{ fontSize:10, color:'#888' }}>{m.label}</div>
                <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:12, color:m.alert?'#A32D2D':'#1a1a1a' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* LiYA */}
        <div className="card" style={{ borderTop:'3px solid #E85D04', cursor:'pointer' }} onClick={() => navigate('/liya/livraisons')}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'#FFF0EB', display:'flex', alignItems:'center', justifyContent:'center' }}><Truck size={14} style={{ color:'#E85D04' }} /></div>
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13 }}>LiYA</div>
            <ChevronRight size={12} color="#ccc" style={{ marginLeft:'auto' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {[
              { label:'Livraisons/jour', value: fmtN(data?.liya?.livraisonsJour) },
              { label:'Cette semaine', value: fmtN(data?.liya?.livraisonsSemaine) },
              { label:'Motos actives', value: `${data?.liya?.motosActives||0}/${data?.liya?.motosTotal||0}` },
              { label:'Taux réussite', value: (data?.liya?.tauxReussite||0)+'%', alert: data?.liya?.tauxReussite < 70 },
            ].map((m,i) => (
              <div key={i} style={{ background:'#F7F7F5', borderRadius:6, padding:'6px 8px' }}>
                <div style={{ fontSize:10, color:'#888' }}>{m.label}</div>
                <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:12, color:m.alert?'#A32D2D':'#1a1a1a' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <AssistantERP filiale="GROUPE"/>
    </div>
  );
}
