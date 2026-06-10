import { useQuery } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import { useState } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import ExportBar from '../../components/ui/ExportBar';
import { exportPDF } from '../../lib/export';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  ResponsiveContainer, Tooltip, Legend
} from 'recharts';

const TYPE_COLORS = {
  ESPECES:'#27500A', ORANGE_MONEY:'#E87722', MTN_MONEY:'#FFCC00',
  MOOV_MONEY:'#0066CC', WAVE:'#1A73E8', BANQUE:'#5F5E5A'
};
const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(2)}M F` : `${Math.round(n/1000)}k F`;

export default function CaisseYakro() {
  const [filtreDates, setFiltreDates] = useState(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['caisse-yakro', filtreDates],
    queryFn: yakroAPI.caisse,
    refetchInterval: 30000,
  });

  const total = data?.totalJour || 0;
  const totalBar = data?.totalBar || 0;
  const totalCuisine = data?.totalCuisine || 0;
  const pctBar = data?.pctBar || 0;
  const pctCuisine = data?.pctCuisine || 0;
  const parPaiement = data?.parPaiement || [];
  const parCategorie = data?.parCategorie || [];
  const rein = data?.reinvestissement || {};
  const nbCommandes = data?.nbCommandes || 0;

  const exportPDFCaisse = () => {
    const entetes = ['Catégorie','Montant (FCFA)','Type'];
    const lignes = parCategorie.map(c => [c.categorie, c.montant.toLocaleString('fr'), c.isBar ? 'Bar' : 'Cuisine']);
    lignes.push(['TOTAL BAR', totalBar.toLocaleString('fr'), ''], ['TOTAL CUISINE', totalCuisine.toLocaleString('fr'), ''], ['TOTAL GÉNÉRAL', total.toLocaleString('fr'), '']);
    exportPDF('Caisse du Jour — Yakro Grill', 'caisse_yakro', entetes, lignes, { sousTitre: `${nbCommandes} commandes · ${new Date().toLocaleDateString('fr')}` });
  };

  // Données pour camembert mode de paiement
  const piePaiement = parPaiement.map(p => ({ name: p.type?.replace('_',' '), value: p.montant }));
  const pieColors = Object.values(TYPE_COLORS);

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontSize:20, fontFamily:'Syne', fontWeight:800, color:'#8B1A1A' }}>🏦 Caisse du jour</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Yakro Grill · {new Date().toLocaleDateString('fr', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <FilterBar onChange={setFiltreDates} defaultPreset="today" color="#8B1A1A" />
          <ExportBar onPDFClick={exportPDFCaisse} />
          <button className="btn btn-ghost btn-sm" onClick={refetch}>🔄</button>
        </div>
      </div>

      {/* KPI principaux */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:20 }}>
        <div className="kpi" style={{ background:'linear-gradient(135deg, #8B1A1A, #A83030)', border:'none', color:'white' }}>
          <div style={{ fontSize:11, opacity:0.8, marginBottom:4 }}>CA TOTAL du jour</div>
          <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:26 }}>{fmtF(total)}</div>
          <div style={{ fontSize:11, opacity:0.7, marginTop:4 }}>{nbCommandes} commande(s) payée(s)</div>
        </div>
        <div className="kpi" style={{ borderLeft:'3px solid #E87722' }}>
          <div className="kpi-label">🍺 CA Bar</div>
          <div className="kpi-value" style={{ fontSize:22, color:'#E87722' }}>{fmtF(totalBar)}</div>
          <div style={{ marginTop:6 }}>
            <div style={{ height:4, background:'#f0efe9', borderRadius:2 }}>
              <div style={{ width:`${pctBar}%`, height:'100%', background:'#E87722', borderRadius:2 }} />
            </div>
            <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{pctBar}% du CA total</div>
          </div>
        </div>
        <div className="kpi" style={{ borderLeft:'3px solid #8B1A1A' }}>
          <div className="kpi-label">🍽️ CA Cuisine</div>
          <div className="kpi-value" style={{ fontSize:22, color:'#8B1A1A' }}>{fmtF(totalCuisine)}</div>
          <div style={{ marginTop:6 }}>
            <div style={{ height:4, background:'#f0efe9', borderRadius:2 }}>
              <div style={{ width:`${pctCuisine}%`, height:'100%', background:'#8B1A1A', borderRadius:2 }} />
            </div>
            <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{pctCuisine}% du CA total</div>
          </div>
        </div>
        <div className="kpi" style={{ borderLeft:'3px solid #27500A' }}>
          <div className="kpi-label">💰 Réinvestissement (50%)</div>
          <div className="kpi-value" style={{ fontSize:22, color:'#27500A' }}>{fmtF(rein.total || 0)}</div>
          <div style={{ fontSize:10, color:'#888', marginTop:4 }}>
            Bar: {fmtF(rein.bar||0)} · Cuisine: {fmtF(rein.cuisine||0)}
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        {/* CA bar vs cuisine */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>
            📊 Départage Bar vs Cuisine
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[{ name:'Bar 🍺', montant: totalBar, fill:'#E87722' }, { name:'Cuisine 🍽️', montant: totalCuisine, fill:'#8B1A1A' }]} barSize={40}>
              <XAxis dataKey="name" tick={{ fontSize:12 }} />
              <YAxis tick={{ fontSize:10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${Math.round(v/1000)}k`} />
              <Tooltip formatter={v => [v.toLocaleString('fr') + ' F', '']} />
              <Bar dataKey="montant" radius={[6,6,0,0]}>
                <Cell fill="#E87722" />
                <Cell fill="#8B1A1A" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:8, fontSize:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, background:'#E87722', borderRadius:2, display:'inline-block' }} />Bar: {pctBar}%</div>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, background:'#8B1A1A', borderRadius:2, display:'inline-block' }} />Cuisine: {pctCuisine}%</div>
          </div>
        </div>

        {/* Mode de paiement */}
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>
            💳 Modes de paiement
          </div>
          {piePaiement.length > 0 ? (
            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              <ResponsiveContainer width="45%" height={180}>
                <PieChart>
                  <Pie data={piePaiement} cx="50%" cy="50%" outerRadius={70} dataKey="value" paddingAngle={3}>
                    {piePaiement.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => [fmtF(v), '']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                {piePaiement.map((p, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:pieColors[i%pieColors.length], display:'inline-block' }} />
                      {p.name}
                    </div>
                    <strong style={{ color:pieColors[i%pieColors.length] }}>{fmtF(p.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>
              Aucun paiement aujourd'hui
            </div>
          )}
        </div>
      </div>

      {/* Détail par catégorie */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'12px 20px', borderBottom:'0.5px solid #e8e7e1', fontFamily:'Syne', fontWeight:700, fontSize:14 }}>
          📋 Détail par catégorie de menu
        </div>
        <div className="table-container">
          <table className="table-erp">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Département</th>
                <th>Montant</th>
                <th>% du CA</th>
                <th>Réinvest. (50%)</th>
              </tr>
            </thead>
            <tbody>
              {parCategorie.map((c, i) => (
                <tr key={i}>
                  <td style={{ fontWeight:500 }}>{c.categorie}</td>
                  <td>
                    <span className={`badge ${c.isBar ? 'badge-liya' : 'badge-yakro'}`} style={{ fontSize:10 }}>
                      {c.isBar ? '🍺 Bar' : '🍽️ Cuisine'}
                    </span>
                  </td>
                  <td style={{ fontWeight:600, color: c.isBar ? '#E87722' : '#8B1A1A' }}>
                    {c.montant.toLocaleString('fr')} F
                  </td>
                  <td style={{ fontSize:11, color:'#888' }}>
                    {total > 0 ? Math.round(c.montant/total*100) : 0}%
                  </td>
                  <td style={{ color:'#27500A' }}>
                    {Math.round(c.montant * 0.5).toLocaleString('fr')} F
                  </td>
                </tr>
              ))}
              {parCategorie.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state"><p>Aucune vente enregistrée aujourd'hui</p></div></td></tr>
              )}
              {parCategorie.length > 0 && (
                <tr style={{ background:'#F7F7F5', fontWeight:700 }}>
                  <td>TOTAL</td>
                  <td></td>
                  <td>{total.toLocaleString('fr')} F</td>
                  <td>100%</td>
                  <td style={{ color:'#27500A' }}>{(rein.total||0).toLocaleString('fr')} F</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
