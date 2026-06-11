import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import { Plus, X, Check } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const MODES = ['ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE'];
const COULEURS = ['#8B1A1A','#E87722','#27500A','#1a3f6f','#BA7517','#5F5E5A','#888','#639922'];
const STATUT_CONFIG = {
  BROUILLON: { color:'#888', label:'Brouillon' },
  EN_ATTENTE: { color:'#BA7517', label:'En attente' },
  VALIDEE: { color:'#1a3f6f', label:'Validée' },
  PAYEE: { color:'#27500A', label:'Payée' },
  CLOTUREE: { color:'#5F5E5A', label:'Clôturée' },
};
const fmtF = n => n>=1000000?`${(n/1000000).toFixed(2)}M F`:n>=1000?`${Math.round(n/1000)}k F`:`${Math.round(n||0)} F`;

export default function DepensesYakroPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [statutFilter, setStatutFilter] = useState('');
  const [form, setForm] = useState({ categorie:'', description:'', montant:'', typePaiement:'ESPECES', beneficiaire:'', notes:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const { data } = useQuery({ queryKey:['depenses-yakro', statutFilter], queryFn:()=>yakroAPI.depensesYakro({ statut:statutFilter||undefined }), staleTime:15000 });
  const { data: stats } = useQuery({ queryKey:['stats-depenses-yakro'], queryFn:yakroAPI.statsDepensesYakro, staleTime:60000 });
  const { data: categories = [] } = useQuery({ queryKey:['cats-dep-yakro'], queryFn:yakroAPI.categoriesDepensesYakro, staleTime:3600000 });

  const createMut = useMutation({ mutationFn:yakroAPI.createDepenseYakro, onSuccess:()=>{ qc.invalidateQueries(['depenses-yakro','stats-depenses-yakro']); setShowCreate(false); setForm({ categorie:'', description:'', montant:'', typePaiement:'ESPECES', beneficiaire:'', notes:'' }); } });
  const validerMut = useMutation({ mutationFn:(id)=>yakroAPI.validerDepenseYakro(id), onSuccess:()=>qc.invalidateQueries(['depenses-yakro']) });
  const payerMut = useMutation({ mutationFn:(id)=>yakroAPI.payerDepenseYakro(id), onSuccess:()=>qc.invalidateQueries(['depenses-yakro']) });

  const depenses = data?.data || [];
  const total = data?.total || 0;
  const pieData = (stats?.parCategorie || []).slice(0,6).map((c,i)=>({ name:c.categorie, value:c.montant, color:COULEURS[i] }));

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#8B1A1A' }}>💸 Dépenses Restaurant</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>{depenses.length} dépense(s) · Total: <strong>{fmtF(total)}</strong></p>
        </div>
        <button className="btn btn-primary btn-sm" style={{ background:'#8B1A1A', border:'none' }} onClick={()=>setShowCreate(true)}>
          <Plus size={13}/> Nouvelle dépense
        </button>
      </div>

      {/* KPI + Graphique */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:10, marginBottom:16 }}>
        {[
          { label:"Aujourd'hui", value:fmtF(stats?.jour||0), color:'#8B1A1A' },
          { label:'Ce mois', value:fmtF(stats?.mois||0), color:'#E87722' },
          { label:'Achats marc.', value:fmtF((stats?.parCategorie||[]).find(c=>c.categorie?.includes('Achats'))?.montant||0), color:'#1a3f6f' },
          { label:'En attente valid.', value:depenses.filter(d=>d.statut==='BROUILLON').length, color:'#BA7517' },
          { label:'À payer', value:depenses.filter(d=>d.statut==='VALIDEE').length, color:'#27500A' },
        ].map((k,i)=>(
          <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize:18, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        {[['','Toutes'],['BROUILLON','Brouillon'],['VALIDEE','Validées'],['PAYEE','Payées']].map(([k,v])=>(
          <button key={k} onClick={()=>setStatutFilter(k)} className={`filter-btn ${statutFilter===k?'active':''}`}
            style={{ background:statutFilter===k?'#8B1A1A':undefined, color:statutFilter===k?'white':undefined }}>
            {v}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {depenses.map(d=>{
          const st = STATUT_CONFIG[d.statut] || STATUT_CONFIG.BROUILLON;
          return (
            <div key={d.id} style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:10, padding:'10px 14px', display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                  <span style={{ fontSize:10, background:st.color+'18', color:st.color, borderRadius:10, padding:'1px 7px', fontWeight:500 }}>{st.label}</span>
                  <span style={{ fontSize:11, color:'#888' }}>{d.categorie}</span>
                </div>
                <div style={{ fontWeight:500, fontSize:13 }}>{d.description}</div>
                {d.beneficiaire && <div style={{ fontSize:11, color:'#888' }}>Bénéficiaire: {d.beneficiaire}</div>}
                {d.notes && <div style={{ fontSize:11, color:'#aaa', fontStyle:'italic' }}>{d.notes}</div>}
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:15, color:'#8B1A1A' }}>{fmtF(d.montant)}</div>
                <div style={{ fontSize:10, color:'#888' }}>{new Date(d.date||d.createdAt).toLocaleDateString('fr')}</div>
              </div>
              <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                {d.statut==='BROUILLON' && (
                  <button className="btn btn-sm" style={{ background:'#1a3f6f', color:'white', border:'none', fontSize:11 }}
                    onClick={()=>validerMut.mutate(d.id)}><Check size={11}/> Valider</button>
                )}
                {d.statut==='VALIDEE' && (
                  <button className="btn btn-sm" style={{ background:'#27500A', color:'white', border:'none', fontSize:11 }}
                    onClick={()=>payerMut.mutate(d.id)}><Check size={11}/> Payer</button>
                )}
              </div>
            </div>
          );
        })}
        {depenses.length===0 && <div className="empty-state"><p>Aucune dépense</p></div>}
      </div>

      {/* Modal création */}
      {showCreate && (
        <div className="modal-overlay" onClick={()=>setShowCreate(false)}>
          <div className="modal" style={{ maxWidth:500 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16, color:'#8B1A1A' }}>💸 Nouvelle dépense</h3>
              <button onClick={()=>setShowCreate(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div className="form-grid">
              <div>
                <label className="label">Catégorie *</label>
                <select className="input" value={form.categorie} onChange={e=>set('categorie',e.target.value)}>
                  <option value="">— Choisir</option>
                  {Array.isArray(categories)?categories.map(c=><option key={c} value={c}>{c}</option>):[]}
                </select>
              </div>
              <div>
                <label className="label">Mode paiement</label>
                <select className="input" value={form.typePaiement} onChange={e=>set('typePaiement',e.target.value)}>
                  {MODES.map(m=><option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div className="full"><label className="label">Description *</label><input className="input" value={form.description} onChange={e=>set('description',e.target.value)}/></div>
              <div><label className="label">Montant (FCFA) *</label><input className="input" type="number" value={form.montant} onChange={e=>set('montant',e.target.value)}/></div>
              <div><label className="label">Bénéficiaire</label><input className="input" value={form.beneficiaire} onChange={e=>set('beneficiaire',e.target.value)}/></div>
              <div className="full"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} style={{ resize:'vertical' }}/></div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button className="btn btn-ghost" onClick={()=>setShowCreate(false)}>Annuler</button>
              <button className="btn btn-primary" disabled={!form.categorie||!form.description||!form.montant||createMut.isPending}
                style={{ background:'#8B1A1A', border:'none' }}
                onClick={()=>createMut.mutate({ ...form, montant:Number(form.montant) })}>
                {createMut.isPending?'...':'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
