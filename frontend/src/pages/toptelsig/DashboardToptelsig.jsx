import AssistantERP from '../../components/ui/AssistantERP';
import CentreActions from '../../components/ui/CentreActions';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toptelsigAPI } from '../../lib/api';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Building2, Users, TrendingUp, Wallet, AlertTriangle, CheckCircle, MapPin, ChevronRight } from 'lucide-react';
import CarteProjetsCi from '../../components/ui/CarteProjetsCi';

const fmtF = n => { if(!n) return '0 F'; if(n>=1000000) return `${(n/1000000).toFixed(2)}M F`; return `${Math.round(n/1000)}k F`; };
const PIE_COLORS = ['#27500A','#A32D2D','#BA7517','#1a3f6f','#888'];

const Tooltip2 = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:8, padding:'8px 12px', fontSize:11, boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight:600, marginBottom:4 }}>{label}</div>
      {payload?.map((p,i) => (
        <div key={i} style={{ color:p.color, display:'flex', gap:6 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:p.color, display:'inline-block', marginTop:3, flexShrink:0 }} />
          {p.name}: <strong>{typeof p.value==='number' ? p.value.toLocaleString('fr')+'F' : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function DashboardToptelsig() {
  const navigate = useNavigate();

  const { data: projets = [] } = useQuery({ queryKey:['projets'], queryFn: toptelsigAPI.projets, staleTime:30000 });
  const { data: ventesData } = useQuery({ queryKey:['ventes-dash'], queryFn: () => toptelsigAPI.ventes({ limit:100 }), staleTime:30000 });
  const { data: souscripteurs } = useQuery({ queryKey:['souscripteurs-dash'], queryFn: () => toptelsigAPI.souscripteurs({ limit:1, statut:'' }), staleTime:30000 });
  const { data: retards } = useQuery({ queryKey:['retards'], queryFn: toptelsigAPI.retards, staleTime:60000 });
  const { data: depenses } = useQuery({ queryKey:['depenses-dash'], queryFn: () => toptelsigAPI.depenses({ limit:100 }), staleTime:30000 });

  const ventes = Array.isArray(ventesData) ? ventesData : (ventesData?.data || []);
  const listeDepenses = Array.isArray(depenses) ? depenses : (depenses?.data || []);

  // Calculs KPI
  const totalLots = projets.reduce((s,p) => s+(p._count?.lots||0), 0);
  const lotsDispos = projets.reduce((s,p) => s+(p.statsLots?.DISPONIBLE||0), 0);
  const lotsVendus = projets.reduce((s,p) => s+(p.statsLots?.VENDU||0), 0);
  const lotsReserves = projets.reduce((s,p) => s+(p.statsLots?.RESERVE||0), 0);
  const caTotal = ventes.reduce((s,v) => s+v.prixVente, 0);
  const caPercu = ventes.reduce((s,v) => {
    const paiements = v.echeanciers?.filter(e=>e.statut==='PAYE').reduce((a,e)=>a+e.montantPaye,0) || 0;
    return s + paiements;
  }, 0);
  const nbRetards = Array.isArray(retards) ? retards.length : 0;
  const totalDepenses = listeDepenses.filter(d=>['PAYEE','JUSTIFIEE','CLOTUREE'].includes(d.statut)).reduce((s,d)=>s+d.montant,0);
  const nbSouscripteurs = souscripteurs?.total || souscripteurs?.length || 0;
  const tauxEncaissement = caTotal > 0 ? Math.round(caPercu/caTotal*100) : 0;

  // Données graphiques
  const pieData = [
    { name:'Disponibles', value: lotsDispos },
    { name:'Vendus', value: lotsVendus },
    { name:'Réservés', value: lotsReserves },
  ].filter(d => d.value > 0);

  const projetsStats = projets.slice(0, 8).map(p => ({
    nom: p.nom.length > 14 ? p.nom.slice(0,14)+'…' : p.nom,
    disponibles: p.statsLots?.DISPONIBLE || 0,
    vendus: p.statsLots?.VENDU || 0,
    reserves: p.statsLots?.RESERVE || 0,
  }));

  const depensesParCateg = Object.entries(
    listeDepenses.reduce((acc,d) => { acc[d.categorie||'Autre'] = (acc[d.categorie||'Autre']||0)+d.montant; return acc; }, {})
  ).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,m])=>({ categorie:c.length>12?c.slice(0,12)+'…':c, montant:m }));

  const ventesRecentes = [...ventes].sort((a,b)=>new Date(b.dateVente)-new Date(a.dateVente)).slice(0,5);

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:22, color:'#1a3f6f' }}>
            📍 Dashboard TOPTELSIG
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            {projets.filter(p=>p.statut==='EN_COURS').length} projet(s) actif(s) · Foncier Côte d'Ivoire
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/toptelsig/projets')}>📋 Projets</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/toptelsig/ventes')}>📊 Ventes</button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }} onClick={()=>navigate('/toptelsig/depenses')}>💳 Dépenses</button>
        </div>
      </div>

      {/* Alertes retards */}
      {nbRetards > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'#FDF2F2', border:'1px solid #F7C1C1', borderRadius:10, marginBottom:16 }}>
          <AlertTriangle size={16} color="#A32D2D" />
          <span style={{ fontSize:13, color:'#A32D2D', fontWeight:600 }}>
            {nbRetards} échéance(s) en retard
          </span>
          <button className="btn btn-ghost btn-xs" style={{ marginLeft:'auto' }} onClick={()=>navigate('/toptelsig/ventes')}>Voir →</button>
        </div>
      )}

      {/* KPI principaux */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { label:'CA Total portefeuille', value:fmtF(caTotal), sub:`${ventes.length} vente(s)`, color:'#1a3f6f', icon:TrendingUp },
          { label:'Perçu à ce jour', value:fmtF(caPercu), sub:`Tx encaissement : ${tauxEncaissement}%`, color:'#27500A', icon:CheckCircle },
          { label:'Restant à percevoir', value:fmtF(caTotal-caPercu), sub:`${nbRetards} retard(s)`, color: nbRetards>0?'#A32D2D':'#888', icon:Wallet },
          { label:'Souscripteurs', value:nbSouscripteurs, sub:`Clients enregistrés`, color:'#1a3f6f', icon:Users },
        ].map((k,i) => (
          <div key={i} className="kpi">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ fontSize:18, color:k.color }}>{k.value}</div>
                {k.sub && <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{k.sub}</div>}
              </div>
              <div style={{ width:32, height:32, borderRadius:8, background:k.color+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <k.icon size={15} style={{ color:k.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* KPI lots */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { label:'Total lots', value:totalLots, color:'#1a3f6f' },
          { label:'Disponibles', value:lotsDispos, color:'#27500A', pct: totalLots?Math.round(lotsDispos/totalLots*100):0 },
          { label:'Vendus', value:lotsVendus, color:'#A32D2D', pct: totalLots?Math.round(lotsVendus/totalLots*100):0 },
          { label:'Réservés', value:lotsReserves, color:'#BA7517', pct: totalLots?Math.round(lotsReserves/totalLots*100):0 },
        ].map((k,i) => (
          <div key={i} style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>{k.label}</div>
            <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:28, color:k.color }}>{k.value}</div>
            {k.pct !== undefined && (
              <div style={{ marginTop:6 }}>
                <div style={{ height:4, background:'#f0efe9', borderRadius:2 }}>
                  <div style={{ height:'100%', width:`${k.pct}%`, background:k.color, borderRadius:2, transition:'width 0.5s' }} />
                </div>
                <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{k.pct}%</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Graphiques ligne 1 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        {/* Répartition lots camembert */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>
            🥧 Répartition des lots
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="40%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData?.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={v => [`${v} lot(s)`, '']} />
                <Legend layout="vertical" align="right" verticalAlign="middle" formatter={v => <span style={{ fontSize:11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>
              Aucun lot importé
            </div>
          )}
        </div>

        {/* Lots par projet barres */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>
            📊 Lots par projet
          </div>
          {projetsStats.some(p=>p.disponibles+p.vendus>0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={projetsStats} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9" />
                <XAxis dataKey="nom" tick={{ fontSize:9 }} />
                <YAxis tick={{ fontSize:9 }} />
                <Tooltip content={<Tooltip2 />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize:10 }} />
                <Bar dataKey="disponibles" name="Disponibles" fill="#27500A" radius={[3,3,0,0]} />
                <Bar dataKey="vendus" name="Vendus" fill="#A32D2D" radius={[3,3,0,0]} />
                <Bar dataKey="reserves" name="Réservés" fill="#BA7517" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>En attente de données</div>
          )}
        </div>
      </div>

      {/* Carte CI */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>
          🗺 Carte des projets — Côte d'Ivoire
        </div>
        <CarteProjetsCi projets={projets} />
      </div>

      {/* États financiers + dépenses */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        {/* Taux encaissement progress */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:16 }}>
            💰 État financier
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { label:'CA portefeuille', value:caTotal, color:'#1a3f6f', pct:100 },
              { label:'Encaissé', value:caPercu, color:'#27500A', pct:tauxEncaissement },
              { label:'Restant', value:caTotal-caPercu, color:'#BA7517', pct:100-tauxEncaissement },
              { label:'Dépenses totales', value:totalDepenses, color:'#A32D2D', pct: caTotal>0?Math.round(totalDepenses/caTotal*100):0 },
            ].map((item,i) => (
              <div key={i}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#555' }}>{item.label}</span>
                  <span style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, color:item.color }}>{fmtF(item.value)}</span>
                </div>
                <div style={{ height:6, background:'#F7F7F5', borderRadius:3 }}>
                  <div style={{ height:'100%', width:`${Math.min(item.pct,100)}%`, background:item.color, borderRadius:3, transition:'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize:10, color:'#aaa', textAlign:'right' }}>{item.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dépenses par catégorie */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>
            📋 Dépenses par catégorie
          </div>
          {depensesParCateg.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={depensesParCateg} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize:9 }} tickFormatter={v=>v>=1000000?`${(v/1000000).toFixed(1)}M`:`${Math.round(v/1000)}k`} />
                <YAxis dataKey="categorie" type="category" tick={{ fontSize:9 }} width={70} />
                <Tooltip content={<Tooltip2 />} />
                <Bar dataKey="montant" name="Montant" fill="#1a3f6f" radius={[0,4,4,0]}>
                  {depensesParCateg?.map((_,i) => <Cell key={i} fill={['#1a3f6f','#E85D04','#27500A','#A32D2D','#BA7517','#888'][i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>Aucune dépense</div>
          )}
        </div>
      </div>

      {/* Caisse TOPTELSIG : Vendu - Dépenses = Solde net */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { label:'Total encaissé (ventes)', value:fmtF(caPercu), color:'#27500A', icon:'💰', sub:'Paiements reçus des souscripteurs' },
          { label:'Total dépenses payées', value:fmtF(totalDepenses), color:'#A32D2D', icon:'💳', sub:'Dépenses validées et payées' },
          { label:'Solde net TOPTELSIG', value:fmtF(caPercu-totalDepenses), color: caPercu-totalDepenses>=0?'#1a3f6f':'#A32D2D', icon:'⚖️', sub: caPercu-totalDepenses>=0?'Excédent':'Déficit' },
        ].map((k,i) => (
          <div key={i} className="kpi" style={{ borderLeft:`3px solid ${k.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ fontSize:20, color:k.color }}>{k.value}</div>
                <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{k.sub}</div>
              </div>
              <div style={{ fontSize:24 }}>{k.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ventes récentes */}
      <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:20 }}>
        <div style={{ padding:'12px 20px', borderBottom:'0.5px solid #e8e7e1', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14 }}>📝 Ventes récentes</div>
          <button className="btn btn-ghost btn-xs" onClick={()=>navigate('/toptelsig/ventes')}>Tout voir →</button>
        </div>
        <div className="table-container">
          <table className="table-erp">
            <thead><tr><th>Souscripteur</th><th>Lot / Projet</th><th>Prix vente</th><th>Statut</th><th>Date</th></tr></thead>
            <tbody>
              {ventesRecentes?.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight:500, fontSize:12 }}>{v.souscripteur ? `${v.souscripteur.prenom} ${v.souscripteur.nom}` : '—'}</td>
                  <td style={{ fontSize:11, color:'#888' }}>
                    {v.lot ? `Lot ${v.lot.numero}` : '—'} · {v.lot?.projet?.nom || ''}
                  </td>
                  <td style={{ fontWeight:600, color:'#1a3f6f' }}>{v.prixVente?.toLocaleString('fr')} F</td>
                  <td><span className={`badge ${v.statut==='SOLDE'?'badge-green':v.statut==='EN_COURS'?'badge-blue':'badge-red'}`} style={{ fontSize:10 }}>{v.statut}</span></td>
                  <td style={{ fontSize:11, color:'#888' }}>{v.dateVente ? new Date(v.dateVente).toLocaleDateString('fr') : '—'}</td>
                </tr>
              ))}
              {ventesRecentes.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state"><p>Aucune vente encore</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AssistantERP filiale="TOPTELSIG"/>
    </div>
  );
}
