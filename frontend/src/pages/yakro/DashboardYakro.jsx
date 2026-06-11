/**
 * YAKRO GRILL — Dashboard Exécutif
 * CA, Serveurs, Tables, Produits, Modes paiement, Alertes
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Users, ShoppingBag, AlertTriangle, RefreshCw } from 'lucide-react';

const fmtF = n => { if (!n && n !== 0) return '0 F'; const a = Math.abs(n); const s = n < 0 ? '-' : ''; if (a >= 1000000) return `${s}${(a/1000000).toFixed(2)}M F`; return `${s}${Math.round(a/1000)}k F`; };
const fmtFull = n => Math.round(n||0).toLocaleString('fr') + ' F';
const COULEURS = ['#8B1A1A','#E87722','#27500A','#1a3f6f','#BA7517','#5F5E5A','#639922','#888'];
const PIE_COLORS = ['#27500A','#E87722','#FFCC00','#1a3f6f','#00B9F1','#5F5E5A'];

function KPI({ label, value, sub, color='#8B1A1A', icon:Icon, trend }) {
  return (
    <div className="kpi" style={{ borderTop:`3px solid ${color}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ minWidth:0 }}>
          <div className="kpi-label">{label}</div>
          <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:20, color, lineHeight:1.1 }}>{value}</div>
          {sub && <div style={{ fontSize:10, color:'#888', marginTop:3 }}>{sub}</div>}
          {trend !== undefined && (
            <div style={{ fontSize:11, color:trend>=0?'#27500A':'#A32D2D', marginTop:4, display:'flex', alignItems:'center', gap:3 }}>
              {trend>=0?<TrendingUp size={11}/>:<TrendingDown size={11}/>}
              {Math.abs(trend)}% vs hier
            </div>
          )}
        </div>
        {Icon && <div style={{ width:32,height:32,borderRadius:8,background:color+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><Icon size={14} style={{ color }}/></div>}
      </div>
    </div>
  );
}

export default function DashboardYakro() {
  const [periode, setPeriode] = useState('jour');
  const { data: dash, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-yakro', periode],
    queryFn: () => yakroAPI.dashboard(periode),
    staleTime: 30000,
    refetchInterval: 60000,
  });
  const { data: stocks = [] } = useQuery({
    queryKey: ['stocks-alerte'],
    queryFn: () => yakroAPI.stocksAlerte?.() || Promise.resolve([]),
    staleTime: 120000,
  });

  const d = dash || {};
  const kpi = d.kpi || {};
  const serveurs = d.topServeurs || [];
  const tables = d.topTables || [];
  const produits = d.topProduits || [];
  const paiements = d.paiements || [];
  const courbe = d.courbe || [];
  const alertes = d.alertes || [];

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:22, color:'#8B1A1A' }}>
            🔥 Dashboard — Yakro Grill
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            Vue exécutive · {new Date().toLocaleDateString('fr', { weekday:'long', day:'2-digit', month:'long' })}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {['jour','semaine','mois','annee'].map(p=>(
            <button key={p} onClick={()=>setPeriode(p)} className={`filter-btn ${periode===p?'active':''}`}
              style={{ background:periode===p?'#8B1A1A':undefined, color:periode===p?'white':undefined, borderColor:periode===p?'#8B1A1A':undefined }}>
              {p==='jour'?"Auj.":p==='semaine'?"Semaine":p==='mois'?"Mois":"Année"}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={()=>refetch()}><RefreshCw size={13}/></button>
        </div>
      </div>

      {/* Alertes */}
      {alertes.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:16 }}>
          {alertes.map((a,i)=>(
            <div key={i} style={{ background:a.gravite==='CRITIQUE'?'#FDF2F2':'#FAEEDA', border:`1px solid ${a.gravite==='CRITIQUE'?'#F7C1C1':'#FAC775'}`, borderRadius:8, padding:'7px 14px', display:'flex', gap:8, alignItems:'center' }}>
              <AlertTriangle size={13} color={a.gravite==='CRITIQUE'?'#A32D2D':'#BA7517'}/>
              <span style={{ fontSize:12, color:a.gravite==='CRITIQUE'?'#A32D2D':'#412402' }}>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI exécutifs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20 }}>
        <KPI label="CA du jour" value={fmtF(kpi.caJour)} sub={`Objectif: ${fmtF(kpi.objectifJour)}`} color="#8B1A1A" icon={TrendingUp}/>
        <KPI label="Tickets" value={kpi.nbTickets||0} sub={`${kpi.nbClients||0} clients`} color="#E87722" icon={ShoppingBag}/>
        <KPI label="Ticket moyen" value={fmtF(kpi.ticketMoyen)} sub="Par commande" color="#1a3f6f"/>
        <KPI label="Marge brute est." value={fmtF(kpi.margeEstimee)} sub={`~${kpi.tauxMarge||0}% du CA`} color="#27500A" icon={TrendingUp}/>
        <KPI label="Tables occupées" value={`${kpi.tablesOccupees||0}/${kpi.totalTables||0}`} sub={`${kpi.tablesLibres||0} libres`} color="#BA7517" icon={Users}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        <KPI label="CA semaine" value={fmtF(kpi.caSemaine)} color="#8B1A1A"/>
        <KPI label="CA mois" value={fmtF(kpi.caMois)} color="#8B1A1A"/>
        <KPI label="Dépenses jour" value={fmtF(kpi.depensesJour)} color="#A32D2D"/>
        <KPI label="Résultat estimé" value={fmtF(kpi.resultatEstime)} color={(kpi.resultatEstime||0)>=0?'#27500A':'#A32D2D'}/>
      </div>

      {/* Graphiques ligne 1 */}
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:14, marginBottom:20 }}>
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>📈 Évolution CA</div>
          {courbe.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={courbe}>
                <defs><linearGradient id="gCA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8B1A1A" stopOpacity={0.15}/><stop offset="95%" stopColor="#8B1A1A" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9"/>
                <XAxis dataKey="label" tick={{ fontSize:10 }}/>
                <YAxis tick={{ fontSize:9 }} tickFormatter={v=>v>=1000000?`${(v/1000000).toFixed(1)}M`:v>=1000?`${Math.round(v/1000)}k`:v}/>
                <Tooltip formatter={v=>[fmtFull(v),'CA']}/>
                <Area type="monotone" dataKey="ca" name="CA" fill="url(#gCA)" stroke="#8B1A1A" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>Aucune donnée</div>}
        </div>

        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>💳 Modes de paiement</div>
          {paiements.length > 0 ? (
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ width:120, height:120, flexShrink:0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={paiements} cx="50%" cy="50%" outerRadius={55} innerRadius={25} paddingAngle={3} dataKey="montant">
                    {paiements.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                  </Pie><Tooltip formatter={v=>[fmtFull(v),'']}/></PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                {paiements.map((p,i)=>{
                  const total = paiements.reduce((s,x)=>s+x.montant,0);
                  const pct = total>0?Math.round(p.montant/total*100):0;
                  return (
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:1 }}>
                        <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ width:7,height:7,borderRadius:'50%',background:PIE_COLORS[i%PIE_COLORS.length],display:'inline-block' }}/>
                          {p.type?.replace('_',' ')}
                        </span>
                        <span style={{ fontWeight:600 }}>{pct}%</span>
                      </div>
                      <div style={{ height:3,background:'#F7F7F5',borderRadius:2 }}>
                        <div style={{ height:'100%',width:`${pct}%`,background:PIE_COLORS[i%PIE_COLORS.length],borderRadius:2 }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <div style={{ height:120, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>Aucun paiement</div>}
        </div>
      </div>

      {/* Ligne 2 : Serveurs + Tables + Produits */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:20 }}>
        {/* Top serveurs */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #e8e7e1', fontFamily:'Syne', fontWeight:700, fontSize:13, color:'#8B1A1A' }}>🏆 Top Serveurs</div>
          <table className="table-erp">
            <thead><tr><th>#</th><th>Serveur</th><th>CA</th><th>Tickets</th><th>Moy.</th></tr></thead>
            <tbody>
              {serveurs.slice(0,8).map((s,i)=>(
                <tr key={i}>
                  <td style={{ fontWeight:700, color:i<3?'#8B1A1A':'#888', fontSize:13 }}>{i+1}</td>
                  <td style={{ fontWeight:500, fontSize:12 }}>{s.nom}</td>
                  <td style={{ fontWeight:700, color:'#8B1A1A', fontSize:11 }}>{fmtF(s.ca)}</td>
                  <td style={{ fontSize:11, color:'#888' }}>{s.nbCommandes}</td>
                  <td style={{ fontSize:11, color:'#888' }}>{fmtF(s.ticketMoyen)}</td>
                </tr>
              ))}
              {serveurs.length === 0 && <tr><td colSpan={5}><div className="empty-state" style={{ padding:12 }}><p style={{ fontSize:12 }}>Aucune donnée</p></div></td></tr>}
            </tbody>
          </table>
        </div>

        {/* Top tables */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #e8e7e1', fontFamily:'Syne', fontWeight:700, fontSize:13, color:'#1a3f6f' }}>🪑 Top Tables</div>
          <table className="table-erp">
            <thead><tr><th>Table</th><th>CA</th><th>Clients</th><th>Tps moy.</th></tr></thead>
            <tbody>
              {tables.slice(0,8).map((t,i)=>(
                <tr key={i}>
                  <td style={{ fontWeight:700 }}>Table {t.numero}</td>
                  <td style={{ fontWeight:700, color:'#1a3f6f', fontSize:11 }}>{fmtF(t.ca)}</td>
                  <td style={{ fontSize:11, color:'#888' }}>{t.nbClients}</td>
                  <td style={{ fontSize:11, color:'#888' }}>{t.tempsMoyen ? `${t.tempsMoyen}min` : '—'}</td>
                </tr>
              ))}
              {tables.length === 0 && <tr><td colSpan={4}><div className="empty-state" style={{ padding:12 }}><p style={{ fontSize:12 }}>Aucune donnée</p></div></td></tr>}
            </tbody>
          </table>
        </div>

        {/* Top produits */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #e8e7e1', fontFamily:'Syne', fontWeight:700, fontSize:13, color:'#27500A' }}>🍽️ Top Produits</div>
          <table className="table-erp">
            <thead><tr><th>Produit</th><th>Qté</th><th>CA</th><th>Marge</th></tr></thead>
          <tbody>
              {produits.slice(0,8).map((p,i)=>(
                <tr key={i}>
                  <td style={{ fontWeight:500, fontSize:11 }}>{p.nom}</td>
                  <td style={{ fontSize:11, color:'#888' }}>{p.quantite}</td>
                  <td style={{ fontSize:11, fontWeight:600, color:'#27500A' }}>{fmtF(p.ca)}</td>
                  <td style={{ fontSize:10, color:p.marge>30?'#27500A':p.marge>15?'#BA7517':'#A32D2D' }}>{p.marge||0}%</td>
                </tr>
              ))}
              {produits.length === 0 && <tr><td colSpan={4}><div className="empty-state" style={{ padding:12 }}><p style={{ fontSize:12 }}>Aucune donnée</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
