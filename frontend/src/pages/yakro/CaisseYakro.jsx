/**
 * YAKRO GRILL — Caisse du Jour
 * Onglets : Résumé · Historique passages · Export
 */
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import { Download, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(2)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${Math.round(n||0)} F`;
const fmtFull = n => Math.round(n||0).toLocaleString('fr') + ' F';
const fmtH = d => new Date(d).toLocaleTimeString('fr', { hour:'2-digit', minute:'2-digit' });
const fmtD = d => new Date(d).toLocaleDateString('fr', { day:'2-digit', month:'short' });

const PIE_COLORS = ['#27500A','#E87722','#FFCC00','#1a3f6f','#00B9F1','#5F5E5A'];
const MODE_LABELS = { ESPECES:'Espèces', ORANGE_MONEY:'Orange Money', MTN_MONEY:'MTN Money', MOOV_MONEY:'Moov Money', WAVE:'Wave', BANQUE:'Banque/TPE' };

function LigneCommande({ cmd }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border:'0.5px solid #e8e7e1', borderRadius:8, overflow:'hidden', marginBottom:4 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', cursor:'pointer', background:'white' }}
        onClick={() => setOpen(v => !v)}>
        <div style={{ width:24, textAlign:'center' }}>
          {open ? <ChevronDown size={12} color="#888"/> : <ChevronRight size={12} color="#888"/>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontFamily:'Syne', fontWeight:700, fontSize:12 }}>{cmd.numero}</span>
            <span style={{ fontSize:11, color:'#888' }}>{cmd.table}</span>
            <span style={{ fontSize:10, background:'#EEF3FB', color:'#1a3f6f', borderRadius:6, padding:'1px 6px' }}>
              👤 {cmd.serveurNom}
            </span>
            <span style={{ fontSize:10, color:'#888' }}>
              {cmd.nbCouverts} pers.
            </span>
          </div>
        </div>
        <div style={{ flexShrink:0, textAlign:'right' }}>
          <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:14, color:'#8B1A1A' }}>{fmtFull(cmd.total)}</div>
          <div style={{ fontSize:10, color:'#888' }}>{fmtH(cmd.createdAt)}</div>
        </div>
        <div style={{ flexShrink:0, display:'flex', gap:4, flexWrap:'wrap', maxWidth:140 }}>
          {cmd.paiements.map((p,i) => (
            <span key={i} style={{ fontSize:9, background:PIE_COLORS[i%PIE_COLORS.length]+'20', color:PIE_COLORS[i%PIE_COLORS.length], borderRadius:6, padding:'1px 5px', fontWeight:500 }}>
              {MODE_LABELS[p.type]||p.type}
            </span>
          ))}
        </div>
      </div>
      {open && (
        <div style={{ background:'#FAFAF8', borderTop:'0.5px solid #f0efe9', padding:'8px 12px 10px 46px' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead>
              <tr style={{ color:'#888', borderBottom:'0.5px solid #e8e7e1' }}>
                <th style={{ textAlign:'left', padding:'3px 8px 3px 0' }}>Article</th>
                <th style={{ textAlign:'center', padding:'3px 8px' }}>Qté</th>
                <th style={{ textAlign:'right', padding:'3px 0 3px 8px' }}>P.U</th>
                <th style={{ textAlign:'right', padding:'3px 0 3px 8px' }}>Sous-total</th>
              </tr>
            </thead>
            <tbody>
              {cmd.lignes.map((l,i) => (
                <tr key={i} style={{ borderBottom:'0.5px solid #f5f5f5' }}>
                  <td style={{ padding:'4px 8px 4px 0', fontWeight:500 }}>{l.nom}</td>
                  <td style={{ textAlign:'center', padding:'4px 8px' }}>{l.quantite}</td>
                  <td style={{ textAlign:'right', padding:'4px 0 4px 8px', color:'#888' }}>{fmtFull(l.prixUnitaire)}</td>
                  <td style={{ textAlign:'right', padding:'4px 0 4px 8px', fontWeight:600 }}>{fmtFull(l.sous_total)}</td>
                </tr>
              ))}
              <tr style={{ borderTop:'1.5px solid #e8e7e1', background:'#F7F7F5' }}>
                <td colSpan={3} style={{ padding:'5px 8px 5px 0', fontWeight:700 }}>TOTAL</td>
                <td style={{ textAlign:'right', padding:'5px 0 5px 8px', fontFamily:'Syne', fontWeight:800, color:'#8B1A1A' }}>{fmtFull(cmd.total)}</td>
              </tr>
            </tbody>
          </table>
          {cmd.paiements.length > 0 && (
            <div style={{ marginTop:6, fontSize:10, color:'#888', display:'flex', gap:10, flexWrap:'wrap' }}>
              {cmd.paiements.map((p,i) => (
                <span key={i}>{MODE_LABELS[p.type]||p.type}: <strong>{fmtFull(p.montant)}</strong>{p.reference ? ` (${p.reference})` : ''}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CaisseYakro() {
  const [onglet, setOnglet] = useState('resume');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0,10));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['caisse-yakro'],
    queryFn: yakroAPI.caisse,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: historique = [], isLoading: loadHisto } = useQuery({
    queryKey: ['historique-caisse', dateFilter],
    queryFn: () => yakroAPI.historique({
      dateDebut: dateFilter ? `${dateFilter}T00:00:00` : undefined,
      dateFin: dateFilter ? `${dateFilter}T23:59:59` : undefined,
      limit: 200,
    }),
    staleTime: 15000,
  });

  const total = data?.totalJour || 0;
  const totalBar = data?.totalBar || 0;
  const totalCuisine = data?.totalCuisine || 0;
  const parPaiement = data?.parPaiement || [];
  const nbCommandes = data?.nbCommandes || 0;
  const ticketMoyen = nbCommandes > 0 ? Math.round(total / nbCommandes) : 0;

  const piePaiement = parPaiement.filter(p => p.montant > 0).map((p,i) => ({
    name: MODE_LABELS[p.type] || p.type,
    value: p.montant,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const exportCSV = () => {
    const rows = [['Numéro','Heure','Table','Serveur','Couverts','Total','Modes paiement','Détail articles']];
    (Array.isArray(historique) ? historique : []).forEach(c => {
      rows.push([
        c.numero, fmtH(c.createdAt), c.table, c.serveurNom, c.nbCouverts, c.total,
        c.paiements.map(p=>`${MODE_LABELS[p.type]||p.type}:${p.montant}`).join(' / '),
        c.lignes.map(l=>`${l.nom}×${l.quantite}`).join(', '),
      ]);
    });
    const csv = '\uFEFF' + rows.map(r => r.join(';')).join('\r\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `caisse_yakro_${dateFilter}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const listHisto = Array.isArray(historique) ? historique : [];
  const totalHisto = listHisto.reduce((s,c) => s + (c.total||0), 0);

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#8B1A1A' }}>🏦 Caisse du Jour</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            {nbCommandes} ticket(s) · <strong>{fmtF(total)}</strong> encaissé
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>refetch()}><RefreshCw size={13}/></button>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}><Download size={13}/> Exporter CSV</button>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid #e8e7e1', marginBottom:20 }}>
        {[['resume','📊 Résumé'],['historique','🧾 Historique passages']].map(([k,v])=>(
          <button key={k} onClick={()=>setOnglet(k)}
            style={{ padding:'8px 16px', border:'none', background:'none', cursor:'pointer', fontSize:12,
              fontWeight:onglet===k?600:400, color:onglet===k?'#8B1A1A':'#888',
              borderBottom:onglet===k?'2px solid #8B1A1A':'2px solid transparent' }}>
            {v}
          </button>
        ))}
      </div>

      {/* Onglet Résumé */}
      {onglet === 'resume' && (
        <>
          {/* KPI */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
            {[
              { label:'CA Total', value:fmtF(total), color:'#8B1A1A' },
              { label:'Bar 🍾', value:fmtF(totalBar), color:'#E87722' },
              { label:'Cuisine 🍽️', value:fmtF(totalCuisine), color:'#27500A' },
              { label:'Ticket moyen', value:fmtF(ticketMoyen), color:'#1a3f6f' },
            ].map((k,i)=>(
              <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
                <div className="kpi-label">{k.label}</div>
                <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:20, color:k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Graphiques */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
            {/* Bar vs Cuisine */}
            <div className="card">
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, marginBottom:12 }}>Bar vs Cuisine</div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={[
                  { name:'Bar 🍾', montant: totalBar, fill:'#E87722' },
                  { name:'Cuisine 🍽️', montant: totalCuisine, fill:'#8B1A1A' }
                ]} barSize={50}>
                  <XAxis dataKey="name" tick={{ fontSize:11 }}/>
                  <YAxis tick={{ fontSize:9 }} tickFormatter={v=>v>=1000?`${Math.round(v/1000)}k`:v}/>
                  <Tooltip formatter={v=>[fmtFull(v),'']}/>
                  <Bar dataKey="montant" radius={[6,6,0,0]}>
                    {[{fill:'#E87722'},{fill:'#8B1A1A'}].map((e,i)=>
                      <Cell key={i} fill={e.fill}/>
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Modes paiement */}
            <div className="card">
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, marginBottom:12 }}>Modes de paiement</div>
              {piePaiement.length > 0 ? (
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  <div style={{ width:110, height:110, flexShrink:0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={piePaiement} cx="50%" cy="50%" outerRadius={50} innerRadius={22} paddingAngle={3} dataKey="value">
                          {piePaiement.map((e,i)=><Cell key={i} fill={e.color}/>)}
                        </Pie>
                        <Tooltip formatter={v=>[fmtFull(v),'']}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>
                    {piePaiement.map((p,i)=>{
                      const pct = total>0?Math.round(p.value/total*100):0;
                      return (
                        <div key={i}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:1 }}>
                            <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <span style={{ width:7,height:7,borderRadius:'50%',background:p.color,display:'inline-block' }}/>
                              {p.name}
                            </span>
                            <span style={{ fontWeight:600 }}>{pct}%</span>
                          </div>
                          <div style={{ height:3,background:'#F7F7F5',borderRadius:2 }}>
                            <div style={{ height:'100%',width:`${pct}%`,background:p.color,borderRadius:2 }}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : <div style={{ height:110, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>Aucun paiement</div>}
            </div>
          </div>

          {/* Par catégorie */}
          {data?.parCategorie?.length > 0 && (
            <div className="card">
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, marginBottom:10 }}>Ventes par catégorie</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8 }}>
                {data.parCategorie.slice(0,10).map((c,i) => (
                  <div key={i} style={{ background:c.isBar?'#FEF6F0':'#F7F7F5', borderRadius:8, padding:'8px 12px', borderLeft:`3px solid ${c.isBar?'#E87722':'#8B1A1A'}` }}>
                    <div style={{ fontSize:10, color:'#888', marginBottom:2 }}>{c.isBar?'🍾':'🍽️'} {c.categorie?.replace(/_/g,' ')}</div>
                    <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, color:c.isBar?'#E87722':'#8B1A1A' }}>{fmtF(c.montant)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Onglet Historique */}
      {onglet === 'historique' && (
        <div>
          {/* Filtre date + stats */}
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
            <div>
              <label className="label" style={{ marginBottom:4 }}>Date</label>
              <input type="date" className="input" style={{ width:160 }}
                value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:10 }}>
              {[
                { label:`${listHisto.length} tickets`, color:'#1a3f6f' },
                { label:`Total: ${fmtF(totalHisto)}`, color:'#8B1A1A' },
              ].map((k,i)=>(
                <div key={i} style={{ background:k.color+'12', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:600, color:k.color }}>
                  {k.label}
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={exportCSV}><Download size={12}/> CSV</button>
            </div>
          </div>

          {loadHisto ? (
            <div style={{ textAlign:'center', color:'#888', padding:40 }}>Chargement...</div>
          ) : listHisto.length === 0 ? (
            <div className="empty-state"><p>Aucun ticket encaissé ce jour</p></div>
          ) : (
            <div>
              {listHisto.map(cmd => <LigneCommande key={cmd.id} cmd={cmd}/>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
