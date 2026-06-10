import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft, X } from 'lucide-react';
import ExportBar from '../../components/ui/ExportBar';
import { exportExcel } from '../../lib/export';

const fmtF = n => {
  if (!n && n !== 0) return '0 F';
  if (n >= 1000000) return `${(n/1000000).toFixed(2)}M F`;
  if (n >= 1000) return `${Math.round(n/1000)}k F`;
  return Math.round(n).toLocaleString('fr') + ' F';
};
const TYPES_PAI = ['ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE'];
const FILIALES_F = [['YAKRO_GRILL','Yakro Grill'],['TOPTELSIG','TOPTELSIG'],['LIYA','LiYA'],['GROUPE','Groupe']];
const PERIODES = [['aujourd',"Aujourd'hui"],['semaine','7 jours'],['mois','Mois'],['annee','Année']];
const PIE_COLORS = ['#E87722','#27500A','#FFCD00','#1a3f6f','#00B9F1','#5F5E5A'];
const BAR_COLORS = ['#1a3f6f','#E87722','#8B1A1A','#27500A','#BA7517','#888'];

export default function FinancePage() {
  const { filiale } = useAuthStore();
  const qc = useQueryClient();
  const [periode, setPeriode] = useState('mois');
  const [filialeFilter, setFilialeFilter] = useState(filiale === 'GROUPE' ? '' : filiale);
  const [showEnc, setShowEnc] = useState(false);
  const [showDec, setShowDec] = useState(false);
  const [formEnc, setFormEnc] = useState({ montant:'', typePaiement:'ESPECES', motif:'', categorie:'', filiale: filiale === 'GROUPE' ? 'YAKRO_GRILL' : filiale });
  const [formDec, setFormDec] = useState({ montant:'', typePaiement:'ESPECES', motif:'', categorie:'', beneficiaire:'', filiale: filiale === 'GROUPE' ? 'YAKRO_GRILL' : filiale });
  const [toast, setToast] = useState(null);
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const { data: stats } = useQuery({
    queryKey: ['finance-stats', periode, filialeFilter],
    queryFn: () => financeAPI.stats({ periode, filiale: filialeFilter || undefined }),
    staleTime: 30000,
  });
  const { data: enc = [] } = useQuery({
    queryKey: ['encaissements', periode, filialeFilter],
    queryFn: () => financeAPI.encaissements({ periode, filiale: filialeFilter || undefined, limit: 50 }),
  });
  const { data: dec = [] } = useQuery({
    queryKey: ['decaissements', periode, filialeFilter],
    queryFn: () => financeAPI.decaissements({ periode, filiale: filialeFilter || undefined, limit: 50 }),
  });
  const { data: caisses = [] } = useQuery({
    queryKey: ['caisses'],
    queryFn: () => financeAPI.caisses(),
    staleTime: 30000,
  });

  const createEnc = useMutation({
    mutationFn: financeAPI.createEncaissement,
    onSuccess: () => { qc.invalidateQueries(['finance-stats','encaissements','caisses']); setShowEnc(false); showToast('Encaissement enregistré ✓'); },
    onError: e => showToast(e?.error || 'Erreur', 'error'),
  });
  const createDec = useMutation({
    mutationFn: financeAPI.createDecaissement,
    onSuccess: () => { qc.invalidateQueries(['finance-stats','decaissements','caisses']); setShowDec(false); showToast('Décaissement enregistré ✓'); },
    onError: e => showToast(e?.error || 'Erreur', 'error'),
  });

  const totalEnc = stats?.totalEncaissements || 0;
  const totalDec = stats?.totalDecaissements || 0;
  const solde = totalEnc - totalDec;
  const tresorerie = Array.isArray(caisses) ? caisses.reduce((s,c) => s + (c.solde||0), 0) : 0;
  const courbe = stats?.courbe || [];
  const parCateg = stats?.parCategorie || [];
  const parPaiement = stats?.parTypePaiement || [];

  const listeEnc = Array.isArray(enc) ? enc : [];
  const listeDec = Array.isArray(dec) ? dec : [];

  const exportData = () => {
    exportExcel('finance_encaissements', 'Encaissements',
      ['Date','Filiale','Montant','Paiement','Motif'],
      listeEnc.map(e => [new Date(e.createdAt).toLocaleDateString('fr'), e.filiale, e.montant, e.typePaiement, e.motif])
    );
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20 }}>💰 Finance Groupe</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Trésorerie & mouvements · toutes filiales</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <ExportBar onExcelClick={exportData} />
          <button className="btn btn-primary btn-sm" style={{ background:'#27500A', border:'none' }} onClick={() => setShowEnc(true)}>
            <ArrowUpRight size={13} /> Encaissement
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color:'#A32D2D', borderColor:'#F7C1C1' }} onClick={() => setShowDec(true)}>
            <ArrowDownLeft size={13} /> Décaissement
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {PERIODES.map(([k,v]) => (
          <button key={k} onClick={() => setPeriode(k)} className={`filter-btn ${periode===k?'active':''}`}>{v}</button>
        ))}
        {filiale === 'GROUPE' && (
          <select className="input" style={{ width:150 }} value={filialeFilter} onChange={e => setFilialeFilter(e.target.value)}>
            <option value="">Toutes filiales</option>
            {FILIALES_F.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
      </div>

      {/* KPI */}
      <div className="grid-kpi" style={{ marginBottom:20 }}>
        {[
          { label:'Encaissements', value:fmtF(totalEnc), sub:`${listeEnc.length} opération(s)`, color:'#27500A', icon:ArrowUpRight },
          { label:'Décaissements', value:fmtF(totalDec), sub:`${listeDec.length} opération(s)`, color:'#A32D2D', icon:ArrowDownLeft },
          { label:'Solde net', value:fmtF(Math.abs(solde)), sub: solde>=0?'Excédent':'Déficit', color:solde>=0?'#27500A':'#A32D2D', icon: solde>=0?TrendingUp:TrendingDown },
          { label:'Trésorerie caisses', value:fmtF(tresorerie), sub:`${Array.isArray(caisses)?caisses.length:0} caisse(s)`, color:'#1a3f6f', icon:Wallet },
        ].map((k,i) => (
          <div key={i} className="kpi">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ fontSize:18, color:k.color }}>{k.value}</div>
                <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{k.sub}</div>
              </div>
              <div style={{ width:32,height:32,borderRadius:8,background:k.color+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <k.icon size={15} style={{ color:k.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Caisses */}
      {Array.isArray(caisses) && caisses.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10, marginBottom:20 }}>
          {caisses.map(c => (
            <div key={c.id} className="card" style={{ padding:'12px 16px' }}>
              <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>{c.nom}</div>
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:18, color:c.solde>=0?'#1a3f6f':'#A32D2D' }}>{fmtF(c.solde)}</div>
              <span className="badge badge-blue" style={{ fontSize:10, marginTop:6 }}>{c.filiale?.replace('_',' ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Graphiques */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>📈 Évolution enc/déc (7 jours)</div>
          {courbe.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={courbe}>
                <defs>
                  <linearGradient id="gEnc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#27500A" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#27500A" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gDec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A32D2D" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#A32D2D" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9"/>
                <XAxis dataKey="jour" tick={{ fontSize:10 }}/>
                <YAxis tick={{ fontSize:10 }} tickFormatter={v=>v>=1000000?`${(v/1000000).toFixed(1)}M`:`${Math.round(v/1000)}k`}/>
                <Tooltip formatter={(v,n) => [fmtF(v), n]}/>
                <Legend iconSize={10} wrapperStyle={{ fontSize:11 }}/>
                <Area type="monotone" dataKey="encaissements" name="Encaissements" stroke="#27500A" fill="url(#gEnc)" strokeWidth={2}/>
                <Area type="monotone" dataKey="decaissements" name="Décaissements" stroke="#A32D2D" fill="url(#gDec)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>En attente de données</div>
          )}
        </div>

        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>💳 Modes de paiement</div>
          {parPaiement.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={parPaiement} cx="50%" cy="50%" outerRadius={75} paddingAngle={3} dataKey="value">
                  {parPaiement.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={v => [fmtF(v), '']}/>
                <Legend formatter={v => <span style={{ fontSize:10 }}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>Aucun paiement</div>
          )}
        </div>
      </div>

      {/* Décaissements par catégorie */}
      {parCateg.length > 0 && (
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>📊 Décaissements par catégorie</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={parCateg} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9" horizontal={false}/>
              <XAxis type="number" tick={{ fontSize:10 }} tickFormatter={v=>v>=1000000?`${(v/1000000).toFixed(1)}M`:`${Math.round(v/1000)}k`}/>
              <YAxis dataKey="categorie" type="category" tick={{ fontSize:10 }} width={90}/>
              <Tooltip formatter={v => [fmtF(v), '']}/>
              <Bar dataKey="montant" name="Montant" radius={[0,4,4,0]}>
                {parCateg.map((_,i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tableaux */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #e8e7e1', fontFamily:'Syne', fontWeight:700, fontSize:13 }}>↑ Derniers encaissements</div>
          <div className="table-container">
            <table className="table-erp">
              <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Motif</th></tr></thead>
              <tbody>
                {listeEnc.slice(0,10).map(e => (
                  <tr key={e.id}>
                    <td style={{ fontSize:11 }}>{new Date(e.createdAt).toLocaleDateString('fr', { day:'2-digit', month:'short' })}</td>
                    <td style={{ fontWeight:600, color:'#27500A' }}>{(e.montant||0).toLocaleString('fr')} F</td>
                    <td><span className="badge badge-green" style={{ fontSize:9 }}>{e.typePaiement}</span></td>
                    <td style={{ fontSize:11, color:'#888' }}>{e.motif}</td>
                  </tr>
                ))}
                {listeEnc.length === 0 && <tr><td colSpan={4}><div className="empty-state"><p>Aucun encaissement</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #e8e7e1', fontFamily:'Syne', fontWeight:700, fontSize:13 }}>↓ Derniers décaissements</div>
          <div className="table-container">
            <table className="table-erp">
              <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Motif</th></tr></thead>
              <tbody>
                {listeDec.slice(0,10).map(d => (
                  <tr key={d.id}>
                    <td style={{ fontSize:11 }}>{new Date(d.createdAt).toLocaleDateString('fr', { day:'2-digit', month:'short' })}</td>
                    <td style={{ fontWeight:600, color:'#A32D2D' }}>{(d.montant||0).toLocaleString('fr')} F</td>
                    <td><span className="badge badge-red" style={{ fontSize:9 }}>{d.typePaiement}</span></td>
                    <td style={{ fontSize:11, color:'#888' }}>{d.motif}</td>
                  </tr>
                ))}
                {listeDec.length === 0 && <tr><td colSpan={4}><div className="empty-state"><p>Aucun décaissement</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal encaissement */}
      {showEnc && (
        <div className="modal-overlay" onClick={() => setShowEnc(false)}>
          <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', color:'#27500A' }}>↑ Nouvel encaissement</h3>
              <button onClick={() => setShowEnc(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div className="form-grid">
              <div className="full"><label className="label">Montant (FCFA) *</label><input className="input" type="number" value={formEnc.montant} onChange={e => setFormEnc(f=>({...f,montant:e.target.value}))} placeholder="0"/></div>
              <div><label className="label">Mode paiement</label>
                <select className="input" value={formEnc.typePaiement} onChange={e => setFormEnc(f=>({...f,typePaiement:e.target.value}))}>
                  {TYPES_PAI.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Filiale</label>
                <select className="input" value={formEnc.filiale} onChange={e => setFormEnc(f=>({...f,filiale:e.target.value}))}>
                  {FILIALES_F.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="full"><label className="label">Motif *</label><input className="input" value={formEnc.motif} onChange={e => setFormEnc(f=>({...f,motif:e.target.value}))} placeholder="Recette, paiement..."/></div>
              <div className="full"><label className="label">Catégorie</label><input className="input" value={formEnc.categorie} onChange={e => setFormEnc(f=>({...f,categorie:e.target.value}))}/></div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
              <button className="btn btn-ghost" onClick={() => setShowEnc(false)}>Annuler</button>
              <button disabled={!formEnc.montant||!formEnc.motif||createEnc.isPending}
                onClick={() => createEnc.mutate({...formEnc, montant:Number(formEnc.montant)})}
                style={{ background:'#27500A', color:'white', border:'none', borderRadius:8, padding:'8px 18px', cursor:'pointer', fontWeight:500 }}>
                {createEnc.isPending ? '...' : 'Encaisser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal décaissement */}
      {showDec && (
        <div className="modal-overlay" onClick={() => setShowDec(false)}>
          <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', color:'#A32D2D' }}>↓ Nouveau décaissement</h3>
              <button onClick={() => setShowDec(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div className="form-grid">
              <div className="full"><label className="label">Montant (FCFA) *</label><input className="input" type="number" value={formDec.montant} onChange={e => setFormDec(f=>({...f,montant:e.target.value}))}/></div>
              <div><label className="label">Mode paiement</label>
                <select className="input" value={formDec.typePaiement} onChange={e => setFormDec(f=>({...f,typePaiement:e.target.value}))}>
                  {TYPES_PAI.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Filiale</label>
                <select className="input" value={formDec.filiale} onChange={e => setFormDec(f=>({...f,filiale:e.target.value}))}>
                  {FILIALES_F.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="full"><label className="label">Motif *</label><input className="input" value={formDec.motif} onChange={e => setFormDec(f=>({...f,motif:e.target.value}))}/></div>
              <div className="full"><label className="label">Bénéficiaire</label><input className="input" value={formDec.beneficiaire} onChange={e => setFormDec(f=>({...f,beneficiaire:e.target.value}))}/></div>
              <div className="full"><label className="label">Catégorie</label><input className="input" value={formDec.categorie} onChange={e => setFormDec(f=>({...f,categorie:e.target.value}))}/></div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
              <button className="btn btn-ghost" onClick={() => setShowDec(false)}>Annuler</button>
              <button disabled={!formDec.montant||!formDec.motif||createDec.isPending}
                onClick={() => createDec.mutate({...formDec, montant:Number(formDec.montant)})}
                className="btn btn-danger">
                {createDec.isPending ? '...' : 'Décaisser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position:'fixed', bottom:20, right:16, background:toast.type==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>{toast.msg}</div>}
    </div>
  );
}
