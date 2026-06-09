import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft, Plus, X } from 'lucide-react';
import ExportBar from '../../components/ui/ExportBar';
import FilterBar from '../../components/ui/FilterBar';
import { exportExcel } from '../../lib/export';

const fmtF = (n) => {
  if (!n) return '0 F';
  if (n >= 1000000) return `${(n/1000000).toFixed(2)}M F`;
  if (n >= 1000) return `${Math.round(n/1000)}k F`;
  return Math.round(n).toLocaleString('fr') + ' F';
};

const TYPES_PAI = ['ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE'];
const CATEGORIE_COULEURS = ['#1a3f6f','#8B1A1A','#E85D04','#27500A','#BA7517','#888'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:8, padding:'8px 12px', fontSize:11, boxShadow:'0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight:600, marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:6, color:p.color }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:p.color }} />
          {p.name}: <strong>{p.value?.toLocaleString('fr')} F</strong>
        </div>
      ))}
    </div>
  );
};

export default function FinancePage() {
  const { filiale } = useAuthStore();
  const qc = useQueryClient();
  const [periode, setPeriode] = useState('mois');
  const [filialeFilter, setFilialeFilter] = useState(filiale === 'GROUPE' ? '' : filiale);
  const [showEnc, setShowEnc] = useState(false);
  const [showDec, setShowDec] = useState(false);
  const [formEnc, setFormEnc] = useState({ montant:'', typePaiement:'ESPECES', motif:'', categorie:'', filiale: filiale === 'GROUPE' ? 'YAKRO_GRILL' : filiale });
  const [formDec, setFormDec] = useState({ montant:'', typePaiement:'ESPECES', motif:'', categorie:'', beneficiaire:'', filiale: filiale === 'GROUPE' ? 'YAKRO_GRILL' : filiale });

  const { data: stats } = useQuery({
    queryKey: ['finance-stats', periode, filialeFilter],
    queryFn: () => financeAPI.stats({ periode, filiale: filialeFilter || undefined }),
    staleTime: 30000,
  });

  const { data: enc } = useQuery({
    queryKey: ['encaissements', periode, filialeFilter],
    queryFn: () => financeAPI.encaissements({ periode, filiale: filialeFilter || undefined, limit: 50 }),
  });

  const { data: dec } = useQuery({
    queryKey: ['decaissements', periode, filialeFilter],
    queryFn: () => financeAPI.decaissements({ periode, filiale: filialeFilter || undefined, limit: 50 }),
  });

  const { data: caisses } = useQuery({
    queryKey: ['caisses'],
    queryFn: financeAPI.caisses,
  });

  const createEnc = useMutation({
    mutationFn: financeAPI.createEncaissement,
    onSuccess: () => { qc.invalidateQueries(['finance-stats','encaissements','caisses']); setShowEnc(false); setFormEnc(f=>({...f,montant:'',motif:'',categorie:''})); }
  });
  const createDec = useMutation({
    mutationFn: financeAPI.createDecaissement,
    onSuccess: () => { qc.invalidateQueries(['finance-stats','decaissements','caisses']); setShowDec(false); setFormDec(f=>({...f,montant:'',motif:'',categorie:'',beneficiaire:''})); }
  });

  const totalEnc = stats?.totalEncaissements || 0;
  const totalDec = stats?.totalDecaissements || 0;
  const solde = totalEnc - totalDec;
  const tresorerie = (caisses || []).reduce((s, c) => s + c.solde, 0);
  const courbe = stats?.courbe || [];
  const parCateg = stats?.parCategorie || [];

  const exportData = () => {
    const rows = (enc || []).map(e => [
      new Date(e.createdAt).toLocaleDateString('fr'), e.filiale, e.montant, e.typePaiement, e.motif, e.categorie || ''
    ]);
    exportExcel('finance_encaissements', 'Encaissements', ['Date','Filiale','Montant','Paiement','Motif','Catégorie'], rows);
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20 }}>💰 Finance Groupe</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Trésorerie & mouvements — toutes filiales</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <ExportBar onExcelClick={exportData} />
          <button className="btn btn-primary btn-sm" onClick={() => setShowEnc(true)}>
            <ArrowUpRight size={13} /> Encaissement
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color:'#A32D2D', borderColor:'#F7C1C1' }} onClick={() => setShowDec(true)}>
            <ArrowDownLeft size={13} /> Décaissement
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <FilterBar selected={periode} onChange={setPeriode} />
        {filiale === 'GROUPE' && (
          <select className="input" style={{ width:150 }} value={filialeFilter} onChange={e => setFilialeFilter(e.target.value)}>
            <option value="">Toutes filiales</option>
            {[['YAKRO_GRILL','Yakro Grill'],['TOPTELSIG','TOPTELSIG'],['LIYA','LiYA'],['GROUPE','Groupe']].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
      </div>

      {/* KPI */}
      <div className="grid-kpi" style={{ marginBottom:20 }}>
        <div className="kpi">
          <div className="kpi-label">Encaissements</div>
          <div className="kpi-value" style={{ fontSize:18, color:'#27500A' }}>{fmtF(totalEnc)}</div>
          <div style={{ fontSize:11, color:'#888', marginTop:3 }}>{enc?.length || 0} opération(s)</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Décaissements</div>
          <div className="kpi-value" style={{ fontSize:18, color:'#A32D2D' }}>{fmtF(totalDec)}</div>
          <div style={{ fontSize:11, color:'#888', marginTop:3 }}>{dec?.length || 0} opération(s)</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Solde net</div>
          <div className="kpi-value" style={{ fontSize:18, color: solde >= 0 ? '#27500A' : '#A32D2D' }}>
            {solde >= 0 ? '+' : ''}{fmtF(solde)}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:3, fontSize:11, color: solde >= 0 ? '#27500A' : '#A32D2D' }}>
            {solde >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} Bénéfice net
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Trésorerie caisses</div>
          <div className="kpi-value" style={{ fontSize:18, color:'#1a3f6f' }}>{fmtF(tresorerie)}</div>
          <div style={{ fontSize:11, color:'#888', marginTop:3 }}>{(caisses || []).length} caisse(s)</div>
        </div>
      </div>

      {/* Caisses */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:10, marginBottom:20 }}>
        {(caisses || []).map(c => (
          <div key={c.id} className="card" style={{ padding:'12px 16px' }}>
            <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>{c.nom}</div>
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:18, color: c.solde > 0 ? '#1a3f6f' : '#A32D2D' }}>
              {fmtF(c.solde)}
            </div>
            <span className={`badge ${c.filiale==='YAKRO_GRILL'?'badge-yakro':c.filiale==='LIYA'?'badge-liya':'badge-toptelsig'}`} style={{ fontSize:10, marginTop:6 }}>
              {c.filiale.replace('_',' ')}
            </span>
          </div>
        ))}
      </div>

      {/* Graphiques */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>📈 Évolution enc/déc</div>
          {courbe.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={courbe}>
                <defs>
                  <linearGradient id="gEnc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#27500A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#27500A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A32D2D" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#A32D2D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9" />
                <XAxis dataKey="jour" tick={{ fontSize:10 }} />
                <YAxis tick={{ fontSize:10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${Math.round(v/1000)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
                <Area type="monotone" dataKey="encaissements" name="Encaissements" stroke="#27500A" fill="url(#gEnc)" strokeWidth={2} />
                <Area type="monotone" dataKey="decaissements" name="Décaissements" stroke="#A32D2D" fill="url(#gDec)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>
              En attente de données
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>📊 Décaissements par catégorie</div>
          {parCateg.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={parCateg} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize:10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${Math.round(v/1000)}k`} />
                <YAxis dataKey="categorie" type="category" tick={{ fontSize:10 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="montant" name="Montant" radius={[0,4,4,0]}>
                  {parCateg.map((_, i) => <Cell key={i} fill={CATEGORIE_COULEURS[i % CATEGORIE_COULEURS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>En attente de données</div>
          )}
        </div>
      </div>

      {/* Tableaux */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* Encaissements */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #e8e7e1', fontFamily:'Syne', fontWeight:700, fontSize:13 }}>
            ↑ Derniers encaissements
          </div>
          <div className="table-container">
            <table className="table-erp">
              <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Motif</th></tr></thead>
              <tbody>
                {(enc || []).slice(0,10).map(e => (
                  <tr key={e.id}>
                    <td style={{ fontSize:11 }}>{new Date(e.createdAt).toLocaleDateString('fr', { day:'2-digit', month:'short' })}</td>
                    <td style={{ fontWeight:600, color:'#27500A' }}>{e.montant?.toLocaleString('fr')} F</td>
                    <td><span className="badge badge-green" style={{ fontSize:9 }}>{e.typePaiement}</span></td>
                    <td style={{ fontSize:11, color:'#888' }}>{e.motif}</td>
                  </tr>
                ))}
                {(!enc || enc.length === 0) && <tr><td colSpan={4}><div className="empty-state"><p>Aucun encaissement</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Décaissements */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #e8e7e1', fontFamily:'Syne', fontWeight:700, fontSize:13 }}>
            ↓ Derniers décaissements
          </div>
          <div className="table-container">
            <table className="table-erp">
              <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Motif</th></tr></thead>
              <tbody>
                {(dec || []).slice(0,10).map(d => (
                  <tr key={d.id}>
                    <td style={{ fontSize:11 }}>{new Date(d.createdAt).toLocaleDateString('fr', { day:'2-digit', month:'short' })}</td>
                    <td style={{ fontWeight:600, color:'#A32D2D' }}>{d.montant?.toLocaleString('fr')} F</td>
                    <td><span className="badge badge-red" style={{ fontSize:9 }}>{d.typePaiement}</span></td>
                    <td style={{ fontSize:11, color:'#888' }}>{d.motif}</td>
                  </tr>
                ))}
                {(!dec || dec.length === 0) && <tr><td colSpan={4}><div className="empty-state"><p>Aucun décaissement</p></div></td></tr>}
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
              <button onClick={() => setShowEnc(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div className="full"><label className="label">Montant (FCFA) *</label><input className="input" type="number" value={formEnc.montant} onChange={e => setFormEnc(f=>({...f,montant:e.target.value}))} placeholder="0" /></div>
              <div><label className="label">Mode de paiement</label>
                <select className="input" value={formEnc.typePaiement} onChange={e => setFormEnc(f=>({...f,typePaiement:e.target.value}))}>
                  {TYPES_PAI.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Filiale</label>
                <select className="input" value={formEnc.filiale} onChange={e => setFormEnc(f=>({...f,filiale:e.target.value}))}>
                  {[['YAKRO_GRILL','Yakro Grill'],['TOPTELSIG','TOPTELSIG'],['LIYA','LiYA'],['GROUPE','Groupe']].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="full"><label className="label">Motif *</label><input className="input" value={formEnc.motif} onChange={e => setFormEnc(f=>({...f,motif:e.target.value}))} placeholder="Vente, commande, recette..." /></div>
              <div className="full"><label className="label">Catégorie</label><input className="input" value={formEnc.categorie} onChange={e => setFormEnc(f=>({...f,categorie:e.target.value}))} placeholder="Recette restaurant, paiement foncier..." /></div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
              <button className="btn btn-ghost" onClick={() => setShowEnc(false)}>Annuler</button>
              <button className="btn btn-success" disabled={!formEnc.montant || !formEnc.motif || createEnc.isPending}
                onClick={() => createEnc.mutate({ ...formEnc, montant: Number(formEnc.montant) })} style={{ background:'#27500A', color:'white', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>
                {createEnc.isPending ? 'Enregistrement...' : 'Encaisser'}
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
              <button onClick={() => setShowDec(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div className="full"><label className="label">Montant (FCFA) *</label><input className="input" type="number" value={formDec.montant} onChange={e => setFormDec(f=>({...f,montant:e.target.value}))} /></div>
              <div><label className="label">Mode de paiement</label>
                <select className="input" value={formDec.typePaiement} onChange={e => setFormDec(f=>({...f,typePaiement:e.target.value}))}>
                  {TYPES_PAI.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Filiale</label>
                <select className="input" value={formDec.filiale} onChange={e => setFormDec(f=>({...f,filiale:e.target.value}))}>
                  {[['YAKRO_GRILL','Yakro Grill'],['TOPTELSIG','TOPTELSIG'],['LIYA','LiYA'],['GROUPE','Groupe']].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="full"><label className="label">Motif *</label><input className="input" value={formDec.motif} onChange={e => setFormDec(f=>({...f,motif:e.target.value}))} /></div>
              <div className="full"><label className="label">Bénéficiaire</label><input className="input" value={formDec.beneficiaire} onChange={e => setFormDec(f=>({...f,beneficiaire:e.target.value}))} /></div>
              <div className="full"><label className="label">Catégorie</label><input className="input" value={formDec.categorie} onChange={e => setFormDec(f=>({...f,categorie:e.target.value}))} /></div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
              <button className="btn btn-ghost" onClick={() => setShowDec(false)}>Annuler</button>
              <button className="btn btn-danger" disabled={!formDec.montant || !formDec.motif || createDec.isPending}
                onClick={() => createDec.mutate({ ...formDec, montant: Number(formDec.montant) })}>
                {createDec.isPending ? 'Enregistrement...' : 'Décaisser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
