/**
 * Stocks & Approvisionnements
 * Dashboard · Seuils visuels 🟢🟠🔴⚫ · Import/Export · Seed Yakro
 */
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stocksAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { Plus, AlertTriangle, X, Upload, Download, RefreshCw, BarChart2, Package } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(1)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${Math.round(n||0)} F`;

function getNiveau(p) {
  const stock = p.stockTotal || 0;
  if (stock <= 0) return { code:'RUPTURE', label:'Rupture', color:'#1a1a1a', bg:'#F5F5F5', icon:'⚫' };
  const min = p.stockMinimum ?? (p.stockAlert * 0.5);
  if (stock <= min) return { code:'CRITIQUE', label:'Critique', color:'#A32D2D', bg:'#FCEBEB', icon:'🔴' };
  if (stock <= p.stockAlert) return { code:'ALERTE', label:'Sous seuil', color:'#BA7517', bg:'#FAEEDA', icon:'🟠' };
  return { code:'NORMAL', label:'Normal', color:'#27500A', bg:'#EAF3DE', icon:'🟢' };
}

const CATS_LABELS = {
  VIANDES_PROTEINES:'🥩 Viandes & Protéines', FECULENTS:'🌾 Féculents',
  LEGUMES_CONDIMENTS:'🥬 Légumes', LAITIERS_SAUCES:'🧈 Laitiers & Sauces',
  PIZZA_CHAWARMA:'🍕 Pizza & Chawarma', BOISSONS:'🥤 Boissons',
  ALCOOLS_BAR:'🍾 Bar & Alcools', EPICERIE:'🧂 Épicerie',
  GAZ_ENERGIE:'🔥 Gaz & Énergie', AUTRE:'📦 Autre',
};

// ── Composant principal ────────────────────────────────────────────────────────
export default function StocksPage() {
  const { filiale, user } = useAuthStore();
  const qc = useQueryClient();
  const [filialeFilter, setFilialeFilter] = useState(filiale === 'GROUPE' ? 'YAKRO_GRILL' : filiale);
  const [view, setView] = useState('liste'); // liste | dashboard
  const [catFilter, setCatFilter] = useState('');
  const [niveauFilter, setNiveauFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showMvt, setShowMvt] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState(null);
  const importRef = useRef(null);
  const showToast = (msg, t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3500); };

  const [form, setForm] = useState({
    nom:'', categorie:'VIANDES_PROTEINES', unite:'kg',
    prixAchat:'', prixVente:'', stockAlert:10, stockMinimum:5, stockMaximum:'',
    filiale: filialeFilter || 'YAKRO_GRILL',
  });
  const [mvtForm, setMvtForm] = useState({ type:'ENTREE', quantite:'', motif:'', typeMotif:'' });

  const { data: produits = [], isLoading } = useQuery({
    queryKey: ['produits', filialeFilter],
    queryFn: () => stocksAPI.produits({ filiale: filialeFilter || undefined }),
    staleTime: 15000,
  });

  const list = Array.isArray(produits) ? produits : [];

  // Stats dashboard
  const stats = {
    total: list.length,
    normal:   list.filter(p => getNiveau(p).code === 'NORMAL').length,
    alerte:   list.filter(p => getNiveau(p).code === 'ALERTE').length,
    critique: list.filter(p => getNiveau(p).code === 'CRITIQUE').length,
    rupture:  list.filter(p => getNiveau(p).code === 'RUPTURE').length,
    valeurStock: list.reduce((s, p) => s + (p.stockTotal||0) * (p.prixAchat||0), 0),
  };

  // Filtres
  const filtered = list.filter(p => {
    if (catFilter && p.categorie !== catFilter) return false;
    if (niveauFilter && getNiveau(p).code !== niveauFilter) return false;
    if (search && !p.nom.toLowerCase().includes(search.toLowerCase()) && !p.reference?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const cats = [...new Set(list.map(p => p.categorie))].sort();

  const createMut = useMutation({
    mutationFn: stocksAPI.createProduit,
    onSuccess: () => { qc.invalidateQueries(['produits']); setShowCreate(false); showToast('Produit créé ✓'); },
    onError: e => showToast(e?.error || 'Erreur', 'error'),
  });
  const mvtMut = useMutation({
    mutationFn: (data) => {
      if (data.type === 'PERTE' && (!data.motif || !data.typeMotif)) return Promise.reject({ message: 'Motif obligatoire pour une perte' });
      return stocksAPI.addMouvement(data);
    },
    onSuccess: () => { qc.invalidateQueries(['produits']); setShowMvt(null); showToast('Mouvement enregistré ✓'); },
    onError: e => showToast(e?.message || 'Erreur', 'error'),
  });

  const seedYakro = async () => {
    if (!confirm('Initialiser le stock Yakro Grill (articles déjà existants = ignorés) ?')) return;
    setSeeding(true);
    try {
      const res = await stocksAPI.seedYakro();
      showToast(`✅ ${res.created} créé(s), ${res.skipped} déjà présent(s)`);
      qc.invalidateQueries(['produits']);
    } catch (e) { showToast('Erreur: ' + (e?.error || e.message), 'error'); }
    finally { setSeeding(false); }
  };

  const handleExport = () => {
    const rows = [['Référence','Nom','Catégorie','Unité','Stock','Seuil alerte','Seuil critique','Prix achat','Prix vente','Statut']];
    filtered.forEach(p => {
      const n = getNiveau(p);
      rows.push([p.reference||'',p.nom,CATS_LABELS[p.categorie]||p.categorie,p.unite,p.stockTotal||0,p.stockAlert||0,p.stockMinimum||0,p.prixAchat||0,p.prixVente||0,n.label]);
    });
    const csv = '\uFEFF' + rows.map(r => r.join(';')).join('\r\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`stock_${filialeFilter}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = text.split('\n').map(r => r.split(';').map(c => c.trim().replace(/^"(.*)"$/, '$1')));
      const headers = rows[0].map(h => h.toLowerCase().replace(/[éèê]/g,'e').replace(/[àâ]/g,'a'));
      const data = rows.slice(1).filter(r => r.some(c => c));
      let created = 0;
      for (const row of data) {
        const get = (k) => row[headers.indexOf(k)] || '';
        const nom = get('nom');
        if (!nom) continue;
        try {
          await stocksAPI.createProduit({
            nom, reference: get('reference') || `IMP-${Date.now().toString(36)}`,
            categorie: get('categorie') || 'AUTRE',
            unite: get('unite') || 'unité',
            prixAchat: Number(get('prix achat') || get('prixachat') || 0),
            prixVente: Number(get('prix vente') || get('prixvente') || 0),
            stockAlert: Number(get('seuil alerte') || get('stockalert') || 5),
            stockMinimum: Number(get('seuil critique') || get('stockminimum') || 3),
            filiale: filialeFilter || 'YAKRO_GRILL',
          });
          created++;
        } catch {}
      }
      qc.invalidateQueries(['produits']);
      showToast(`${created} produit(s) importé(s) ✓`);
    } catch (err) { showToast('Erreur import: ' + err.message, 'error'); }
    e.target.value = '';
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20 }}>📦 Stocks & Approvisionnements</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            {list.length} produits · Valeur : <strong>{fmtF(stats.valeurStock)}</strong>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExport}><Download size={13}/> Exporter</button>
          <input ref={importRef} type="file" accept=".csv,.xlsx" style={{ display:'none' }} onChange={handleImport}/>
          <button className="btn btn-ghost btn-sm" style={{ color:'#1a3f6f', borderColor:'#1a3f6f30' }}
            onClick={async () => {
              // Template CSV stock
              const headers = ['reference','nom','categorie','unite','prixAchat','prixVente','stockAlert','stockMinimum'];
              const examples = [
                ['YG-VIAN-001','Poulet de chair (kg)','VIANDES_PROTEINES','kg',2500,3500,10,5],
                ['YG-BOI-001','Heineken (casier 24)','BOISSONS','casier',18000,30000,5,2],
              ];
              const csv = '\uFEFF' + [headers, ...examples].map(r => r.join(';')).join('\r\n');
              const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href=url; a.download='template_stock_2ig.csv'; a.click();
              URL.revokeObjectURL(url);
            }}>📥 Template</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>importRef.current?.click()}><Upload size={13}/> Importer</button>
          <button className="btn btn-ghost btn-sm" style={{ color:'#8B1A1A', borderColor:'#8B1A1A20', background:'#FDF2F2' }}
            disabled={seeding} onClick={seedYakro}>
            {seeding ? '⏳' : '🔥'} Init. Yakro
          </button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
            onClick={()=>setShowCreate(true)}><Plus size={13}/> Produit</button>
        </div>
      </div>

      {/* Filiale + vue */}
      <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        {filiale === 'GROUPE' && (
          <div style={{ display:'flex', gap:4 }}>
            {[['YAKRO_GRILL','Yakro Grill'],['TOPTELSIG','TOPTELSIG'],['LIYA','LiYA'],['','Toutes']].map(([k,v])=>(
              <button key={k} onClick={()=>setFilialeFilter(k)} className={`filter-btn ${filialeFilter===k?'active':''}`}>{v}</button>
            ))}
          </div>
        )}
        <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
          {['liste','dashboard'].map(v=>(
            <button key={v} onClick={()=>setView(v)} className={`filter-btn ${view===v?'active':''}`}>
              {v==='liste'?'📋 Liste':'📊 Dashboard'}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard */}
      {view === 'dashboard' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10, marginBottom:20 }}>
            {[
              { label:'Valeur totale', value:fmtF(stats.valeurStock), color:'#1a3f6f', icon:'💰' },
              { label:'🟢 Normal', value:stats.normal, color:'#27500A' },
              { label:'🟠 Sous seuil', value:stats.alerte, color:'#BA7517' },
              { label:'🔴 Critique', value:stats.critique, color:'#A32D2D' },
              { label:'⚫ Rupture', value:stats.rupture, color:'#1a1a1a' },
            ].map((k,i)=>(
              <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
                <div className="kpi-label">{k.label}</div>
                <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:22, color:k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
          {/* Produits critiques */}
          {(stats.critique + stats.rupture > 0) && (
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:10, color:'#A32D2D' }}>⚠ Produits nécessitant un réapprovisionnement urgent</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:8 }}>
                {list.filter(p=>['CRITIQUE','RUPTURE'].includes(getNiveau(p).code)).map(p=>{
                  const n = getNiveau(p);
                  return (
                    <div key={p.id} style={{ background:n.bg, borderRadius:8, padding:'10px 12px', border:`1px solid ${n.color}30` }}>
                      <div style={{ fontWeight:600, fontSize:12 }}>{n.icon} {p.nom}</div>
                      <div style={{ fontSize:11, color:n.color, fontWeight:700 }}>
                        Stock : {p.stockTotal||0} {p.unite} / Seuil : {p.stockAlert} {p.unite}
                      </div>
                      <button className="btn btn-sm" style={{ marginTop:6, width:'100%', background:n.color, color:'white', border:'none', fontSize:10 }}
                        onClick={()=>setShowMvt(p)}>📥 Entrée stock</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Tableau par catégorie */}
          <div className="card">
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:10 }}>📦 Stock par catégorie</div>
            {cats.map(cat => {
              const items = list.filter(p=>p.categorie===cat);
              const valeur = items.reduce((s,p)=>(s+(p.stockTotal||0)*(p.prixAchat||0)),0);
              const alerts = items.filter(p=>getNiveau(p).code!=='NORMAL').length;
              return (
                <div key={cat} style={{ display:'flex', gap:10, alignItems:'center', padding:'7px 0', borderBottom:'0.5px solid #f0efe9', cursor:'pointer' }}
                  onClick={()=>{setCatFilter(cat);setView('liste');}}>
                  <div style={{ flex:1, fontSize:12, fontWeight:500 }}>{CATS_LABELS[cat]||cat}</div>
                  <div style={{ fontSize:11, color:'#888' }}>{items.length} produits</div>
                  <div style={{ fontSize:11, fontWeight:600, color:'#1a3f6f', minWidth:80, textAlign:'right' }}>{fmtF(valeur)}</div>
                  {alerts>0 && <span style={{ fontSize:10, background:'#FAEEDA', color:'#BA7517', borderRadius:8, padding:'1px 7px' }}>⚠ {alerts}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Liste */}
      {view === 'liste' && (
        <>
          <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
            {[['','Tous'],['NORMAL','🟢'],['ALERTE','🟠'],['CRITIQUE','🔴'],['RUPTURE','⚫']].map(([k,v])=>(
              <button key={k} onClick={()=>setNiveauFilter(k)} className={`filter-btn ${niveauFilter===k?'active':''}`}>{v}</button>
            ))}
            <select className="input" style={{ width:180 }} value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
              <option value="">Toutes catégories</option>
              {cats.map(c=><option key={c} value={c}>{CATS_LABELS[c]||c}</option>)}
            </select>
            <input className="input" style={{ flex:1, minWidth:150 }} placeholder="🔍 Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {(catFilter||niveauFilter||search) && <button className="btn btn-ghost btn-xs" onClick={()=>{setCatFilter('');setNiveauFilter('');setSearch('');}}>✕ Réinitialiser</button>}
          </div>

          <div className="card" style={{ padding:0, overflowX:'auto' }}>
            {isLoading ? <div style={{ padding:40, textAlign:'center', color:'#888' }}>Chargement...</div> : (
              <table className="table-erp">
                <thead>
                  <tr>
                    <th>Statut</th><th>Produit</th><th>Catégorie</th>
                    <th style={{ textAlign:'right' }}>Stock</th>
                    <th style={{ textAlign:'right' }}>🟠 Alerte</th>
                    <th style={{ textAlign:'right' }}>🔴 Critique</th>
                    <th style={{ textAlign:'right' }}>Prix achat</th>
                    <th style={{ textAlign:'right' }}>Valeur</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const n = getNiveau(p);
                    return (
                      <tr key={p.id} style={{ background:n.code!=='NORMAL'?n.bg+'80':undefined }}>
                        <td>
                          <span style={{ fontSize:16, title:n.label }}>{n.icon}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight:600, fontSize:13 }}>{p.nom}</div>
                          <div style={{ fontSize:10, color:'#888' }}>{p.reference}</div>
                        </td>
                        <td><span style={{ fontSize:10, background:'#F7F7F5', borderRadius:6, padding:'2px 6px' }}>{CATS_LABELS[p.categorie]?.split(' ').slice(1).join(' ')||p.categorie}</span></td>
                        <td style={{ textAlign:'right', fontFamily:'Syne', fontWeight:800, fontSize:14, color:n.color }}>
                          {p.stockTotal||0} <span style={{ fontSize:10, fontWeight:400 }}>{p.unite}</span>
                        </td>
                        <td style={{ textAlign:'right', fontSize:11, color:'#888' }}>{p.stockAlert||0}</td>
                        <td style={{ textAlign:'right', fontSize:11, color:'#888' }}>{p.stockMinimum||0}</td>
                        <td style={{ textAlign:'right', fontSize:12 }}>{fmtF(p.prixAchat||0)}</td>
                        <td style={{ textAlign:'right', fontSize:12, fontWeight:600, color:'#1a3f6f' }}>
                          {fmtF((p.stockTotal||0)*(p.prixAchat||0))}
                        </td>
                        <td>
                          <button onClick={()=>setShowMvt(p)} className="btn btn-sm btn-ghost" style={{ fontSize:11 }}>
                            ± Mouvement
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9}>
                      <div className="empty-state">
                        <Package size={28} color="#ddd"/>
                        <p style={{ marginTop:8 }}>
                          {list.length === 0
                            ? <span>Aucun article en stock. <button style={{ color:'#8B1A1A', background:'none', border:'none', cursor:'pointer', fontWeight:600 }} onClick={seedYakro}>🔥 Initialiser Yakro Grill</button></span>
                            : 'Aucun résultat pour ces filtres'}
                        </p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ fontSize:11, color:'#888', marginTop:6 }}>{filtered.length} / {list.length} produits</div>
        </>
      )}

      {/* Modal création */}
      {showCreate && (
        <div className="modal-overlay" onClick={()=>setShowCreate(false)}>
          <div className="modal" style={{ maxWidth:540 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>📦 Nouveau produit</h3>
              <button onClick={()=>setShowCreate(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ gridColumn:'1/-1' }}><label className="label">Nom *</label><input className="input" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}/></div>
              <div>
                <label className="label">Catégorie</label>
                <select className="input" value={form.categorie} onChange={e=>setForm(f=>({...f,categorie:e.target.value}))}>
                  {Object.entries(CATS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="label">Unité</label><input className="input" value={form.unite} onChange={e=>setForm(f=>({...f,unite:e.target.value}))}/></div>
              <div><label className="label">Prix achat (F)</label><input className="input" type="number" value={form.prixAchat} onChange={e=>setForm(f=>({...f,prixAchat:e.target.value}))}/></div>
              <div><label className="label">Prix vente (F)</label><input className="input" type="number" value={form.prixVente} onChange={e=>setForm(f=>({...f,prixVente:e.target.value}))}/></div>
              <div>
                <label className="label">🟠 Seuil alerte</label>
                <input className="input" type="number" value={form.stockAlert} onChange={e=>setForm(f=>({...f,stockAlert:Number(e.target.value)}))}/>
              </div>
              <div>
                <label className="label">🔴 Seuil critique</label>
                <input className="input" type="number" value={form.stockMinimum} onChange={e=>setForm(f=>({...f,stockMinimum:Number(e.target.value)}))}/>
              </div>
              {filiale === 'GROUPE' && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Filiale</label>
                  <select className="input" value={form.filiale} onChange={e=>setForm(f=>({...f,filiale:e.target.value}))}>
                    {['YAKRO_GRILL','TOPTELSIG','LIYA'].map(k=><option key={k} value={k}>{k.replace('_',' ')}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowCreate(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
                disabled={!form.nom||createMut.isPending}
                onClick={()=>createMut.mutate({ ...form, prixAchat:Number(form.prixAchat), prixVente:Number(form.prixVente) })}>
                {createMut.isPending?'...':'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal mouvement stock */}
      {showMvt && (
        <div className="modal-overlay" onClick={()=>setShowMvt(null)}>
          <div className="modal" style={{ maxWidth:400 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>± Mouvement — {showMvt.nom}</h3>
              <button onClick={()=>setShowMvt(null)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div style={{ background:getNiveau(showMvt).bg, borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:12 }}>
              Stock actuel : <strong>{showMvt.stockTotal||0} {showMvt.unite}</strong> · {getNiveau(showMvt).icon} {getNiveau(showMvt).label}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <label className="label">Type de mouvement</label>
                <div style={{ display:'flex', gap:6 }}>
                  {['ENTREE','SORTIE','PERTE','INVENTAIRE'].map(t=>(
                    <button key={t} type="button" onClick={()=>setMvtForm(f=>({...f,type:t,typeMotif:''}))}
                      style={{ flex:1, padding:'6px 4px', borderRadius:7, border:'none', fontSize:11, fontWeight:500, cursor:'pointer',
                        background:mvtForm.type===t?({'ENTREE':'#EAF3DE','SORTIE':'#EEF3FB','PERTE':'#FCEBEB','INVENTAIRE':'#F7F7F5'}[t]):'white',
                        color:({'ENTREE':'#27500A','SORTIE':'#1a3f6f','PERTE':'#A32D2D','INVENTAIRE':'#888'}[t]),
                        border:`1.5px solid ${mvtForm.type===t?({'ENTREE':'#C0DD97','SORTIE':'#B5D4F4','PERTE':'#F7C1C1','INVENTAIRE':'#e8e7e1'}[t]):'#e8e7e1'}` }}>
                      {{'ENTREE':'📥 Entrée','SORTIE':'📤 Sortie','PERTE':'⚠ Perte','INVENTAIRE':'📋 Inventaire'}[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Quantité ({showMvt.unite})</label>
                <input className="input" type="number" value={mvtForm.quantite} onChange={e=>setMvtForm(f=>({...f,quantite:e.target.value}))} placeholder="0"/>
              </div>
              {mvtForm.type === 'PERTE' && (
                <div>
                  <label className="label">Type de perte *</label>
                  <select className="input" value={mvtForm.typeMotif} onChange={e=>setMvtForm(f=>({...f,typeMotif:e.target.value}))}>
                    <option value="">— Sélectionner</option>
                    <option value="PEREMPTION">Péremption</option>
                    <option value="CASSE">Casse</option>
                    <option value="VOL">Vol</option>
                    <option value="CONSO_INTERNE">Consommation interne (staff)</option>
                    <option value="OFFERT_CLIENT">Offert au client</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">Motif{mvtForm.type==='PERTE'?' *':''}</label>
                <input className="input" value={mvtForm.motif} onChange={e=>setMvtForm(f=>({...f,motif:e.target.value}))}
                  placeholder={mvtForm.type==='ENTREE'?'Ex: Livraison fournisseur...':mvtForm.type==='SORTIE'?'Ex: Commande table 5...':'Décrire...'}/>
              </div>
            </div>
            {mvtForm.type==='PERTE' && (!mvtForm.motif||!mvtForm.typeMotif) && (
              <div style={{ marginTop:8, padding:'7px 10px', background:'#FCEBEB', borderRadius:7, fontSize:11, color:'#A32D2D' }}>
                ⚠ Type et description obligatoires pour une perte
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowMvt(null)}>Annuler</button>
              <button className="btn btn-primary btn-sm"
                disabled={!mvtForm.quantite||mvtMut.isPending||(mvtForm.type==='PERTE'&&(!mvtForm.motif||!mvtForm.typeMotif))}
                style={{ background:{'ENTREE':'#27500A','SORTIE':'#1a3f6f','PERTE':'#A32D2D','INVENTAIRE':'#888'}[mvtForm.type], border:'none' }}
                onClick={()=>mvtMut.mutate({ produitId:showMvt.id, filiale:showMvt.filiale, ...mvtForm, quantite:Number(mvtForm.quantite) })}>
                {mvtMut.isPending?'...':'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position:'fixed', bottom:20, right:16, background:toast.t==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>{toast.msg}</div>}
    </div>
  );
}
