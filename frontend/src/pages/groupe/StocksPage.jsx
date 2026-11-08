/**
 * Stocks & Approvisionnements
 * Dashboard · Seuils visuels 🟢🟠🔴⚫ · Import/Export · Seed Yakro
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stocksAPI, imgSrc } from '../../lib/api';
import { exportExcel, parseExcel } from '../../lib/export';
import { useAuthStore } from '../../store';
import { Plus, AlertTriangle, X, Upload, Download, RefreshCw, BarChart2, Package, Pencil, ExternalLink, ImagePlus, Check } from 'lucide-react';

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

// Segmentation du stock : boissons / ingrédients
const CATS_BOISSON = {
  BOISSONS:'🥤 Softs & eaux', BIERES:'🍺 Bières', VINS:'🍷 Vins', SPIRITUEUX:'🥃 Spiritueux', ALCOOLS_BAR:'🍾 Bar & Alcools',
};
const CATS_LABELS = {
  ...CATS_BOISSON,
  VIANDES_PROTEINES:'🥩 Viandes & Protéines', FECULENTS:'🌾 Féculents',
  LEGUMES_CONDIMENTS:'🥬 Légumes', LAITIERS_SAUCES:'🧈 Laitiers & Sauces',
  PIZZA_CHAWARMA:'🍕 Pizza & Chawarma', EPICERIE:'🧂 Épicerie',
  GAZ_ENERGIE:'🔥 Gaz & Énergie', AUTRE:'📦 Autre',
};

/** Réduit une image choisie (400 px max, JPEG) en data URI pour l'enregistrer avec l'article. */
function lireImage(file, cb, erreur) {
  if (!file?.type?.startsWith('image/')) return erreur('Choisissez une image');
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    cb(c.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = () => erreur('Image illisible');
  img.src = URL.createObjectURL(file);
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function StocksPage() {
  const { filiale, user } = useAuthStore();
  const qc = useQueryClient();
  const [filialeFilter, setFilialeFilter] = useState(filiale === 'GROUPE' ? 'YAKRO_GRILL' : filiale);
  const [view, setView] = useState('liste'); // liste | dashboard
  const [typeTab, setTypeTab] = useState('BOISSON'); // BOISSON | INGREDIENT
  const [vue, setVue] = useState(null); // article affiché en grand
  const [edition, setEdition] = useState(null); // produit en cours de modification
  // Les boissons du menu Yakro doivent toutes figurer au stock : synchronisation automatique (sans effet si déjà fait)
  useEffect(() => {
    if (filiale === 'TOPTELSIG' || filiale === 'LIYA') return;
    stocksAPI.syncMenu().then(r => { if (r?.crees || r?.images) qc.invalidateQueries(['produits']); }).catch(() => {});
  }, []);
  const [catFilter, setCatFilter] = useState('');
  const [niveauFilter, setNiveauFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showMvt, setShowMvt] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState(null);
  const importRef = useRef(null);
  const showToast = (msg, t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3500); };

  const FORM_VIDE = (type) => ({
    nom:'', categorie: type==='BOISSON' ? 'BOISSONS' : 'VIANDES_PROTEINES', unite: type==='BOISSON' ? 'casier' : 'kg', type,
    prixAchat:'', prixVente:'', stockAlert:10, stockMinimum:5, stockMaximum:'', imageUrl:'', lien:'',
    filiale: filialeFilter || 'YAKRO_GRILL',
  });
  const [form, setForm] = useState(FORM_VIDE('BOISSON'));
  const [mvtForm, setMvtForm] = useState({ type:'ENTREE', quantite:'', motif:'', typeMotif:'' });

  const { data: produits = [], isLoading } = useQuery({
    queryKey: ['produits', filialeFilter],
    queryFn: () => stocksAPI.produits({ filiale: filialeFilter || undefined }),
    staleTime: 15000,
  });

  const tous = Array.isArray(produits) ? produits : [];
  const nbParType = { BOISSON: tous.filter(p=>p.type==='BOISSON').length, INGREDIENT: tous.filter(p=>p.type!=='BOISSON').length };
  const list = tous.filter(p => (typeTab==='BOISSON') === (p.type==='BOISSON'));
  const catsDuType = Object.entries(CATS_LABELS).filter(([k]) => (typeTab==='BOISSON') === (k in CATS_BOISSON));

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

  const { data: posStatut } = useQuery({ queryKey:['pos-statut', filialeFilter], queryFn: stocksAPI.posStatut, enabled: typeTab==='BOISSON' && (filialeFilter==='YAKRO_GRILL' || filiale==='YAKRO_GRILL'), staleTime:10000, retry:false });
  const [syncPos, setSyncPos] = useState(false);
  const synchroniserPos = async () => {
    setSyncPos(true);
    try { const r = await stocksAPI.syncMenu(); qc.invalidateQueries(['pos-statut']); qc.invalidateQueries(['produits']); qc.invalidateQueries(['menu']); showToast(`✓ POS synchronisé : ${r.liees ?? 0} liée(s), ${r.ajoutesAuMenu ?? 0} ajoutée(s) au menu`); }
    catch (e) { showToast(e?.error || e?.message || 'Erreur', 'error'); }
    finally { setSyncPos(false); }
  };
  const createMut = useMutation({
    mutationFn: (d) => edition ? stocksAPI.majProduit(edition.id, d) : stocksAPI.createProduit(d),
    onSuccess: () => { qc.invalidateQueries(['produits']); setShowCreate(false); setEdition(null); showToast(edition ? 'Produit modifié ✓' : 'Produit créé ✓'); },
    onError: e => showToast(e?.response?.data?.error || e?.error || 'Erreur', 'error'),
  });
  const ouvrirCreation = () => { setEdition(null); setForm(FORM_VIDE(typeTab)); setShowCreate(true); };
  const ouvrirEdition = (p) => { setEdition(p); setForm({ ...FORM_VIDE(p.type), ...p, imageUrl:p.imageUrl||'', lien:p.lien||'' }); setShowCreate(true); };

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

  // ── Export / import Excel : le même fichier sert à exporter, corriger hors ligne puis réimporter ──
  const ENTETES = ['Référence','Nom','Catégorie','Unité','Stock actuel','Entrée à ajouter','Prix achat','Prix vente','Seuil alerte','Seuil critique','Lien'];
  const handleExport = () => {
    exportExcel(`stock_${typeTab==='BOISSON'?'boissons':'ingredients'}`, 'Stock', ENTETES,
      filtered.map(p => [p.reference||'', p.nom, p.categorie, p.unite||'', p.stockTotal||0, '', p.prixAchat||0, p.prixVente||0, p.stockAlert||0, p.stockMinimum||0, p.lien||'']));
  };
  const CLES = { 'reference':'reference','nom':'nom','categorie':'categorie','unite':'unite','stock actuel':'stock','stock':'stock','entree a ajouter':'entree','entree':'entree','prix achat':'prixAchat','prix vente':'prixVente','seuil alerte':'stockAlert','seuil critique':'stockMinimum','lien':'lien' };
  const sansAccent = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const majMasse = useMutation({
    mutationFn: (lignes) => stocksAPI.majMasse({ filiale: filialeFilter || 'YAKRO_GRILL', type: typeTab, lignes }),
    onSuccess: (r) => {
      qc.invalidateQueries(['produits']); qc.invalidateQueries(['pos-statut']); qc.invalidateQueries(['menu']); setModifs({}); setModeEdition(false);
      showToast(`✓ ${r.crees} créé(s), ${r.majs} modifié(s), ${r.mouvements} mouvement(s) de stock`);
      if (r.erreurs?.length) alert(`${r.erreurs.length} ligne(s) ignorée(s) :\n` + r.erreurs.slice(0,10).map(e => `Ligne ${e.ligne} : ${e.message}`).join('\n'));
    },
    onError: e => showToast(e?.error || e?.response?.data?.error || 'Erreur', 'error'),
  });
  const handleImport = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      const { entetes, lignes } = await parseExcel(file);
      const cles = entetes.map(h => CLES[sansAccent(h)]);
      if (!cles.includes('nom') && !cles.includes('reference')) return showToast('Colonne « Nom » ou « Référence » introuvable : utilisez le fichier exporté', 'error');
      majMasse.mutate(lignes.map(r => Object.fromEntries(cles.map((k,i) => [k, r[i]]).filter(([k]) => k))));
    } catch (err) { showToast('Erreur import : ' + err.message, 'error'); }
  };

  // ── Édition directe dans le tableau ──
  const [modeEdition, setModeEdition] = useState(false);
  const [modifs, setModifs] = useState({});
  const nbModifs = Object.keys(modifs).length;
  const champ = (p, k, def) => (
    <input type="number" min="0" step="any" value={modifs[p.id]?.[k] ?? def ?? 0} aria-label={`${k} ${p.nom}`}
      onChange={e => setModifs(m => ({ ...m, [p.id]: { ...m[p.id], [k]: e.target.value } }))}
      style={{ width:76, padding:'5px 6px', textAlign:'right', border:'1px solid #cdd6e6', borderRadius:6, fontSize:12 }}/>
  );
  const enregistrerTableau = () => majMasse.mutate(Object.entries(modifs).map(([id, v]) => ({ id, ...v })));
  const mvtMut = useMutation({
    mutationFn: (d) => stocksAPI.addMouvement(d),
    onSuccess: () => { qc.invalidateQueries(['produits']); setShowMvt(null); setMvtForm({ type:'ENTREE', quantite:'', motif:'', typeMotif:'' }); showToast('Mouvement enregistré ✓'); },
    onError: e => showToast(e?.error || e?.response?.data?.error || 'Erreur', 'error'),
  });

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
          {typeTab==='BOISSON' && <button className="btn btn-ghost btn-sm" disabled={syncPos} onClick={synchroniserPos} style={{ color:'#27500A', borderColor:'#27500A30' }}><RefreshCw size={13}/> {syncPos ? '…' : 'Synchroniser avec le POS'}</button>}
          <button className="btn btn-ghost btn-sm" onClick={handleExport}><Download size={13}/> Exporter Excel</button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={handleImport}/>
          <button className="btn btn-ghost btn-sm" disabled={majMasse.isPending} onClick={()=>importRef.current?.click()}><Upload size={13}/> Importer Excel</button>
          {modeEdition
            ? <>
                <button className="btn btn-primary btn-sm" disabled={!nbModifs||majMasse.isPending} style={{ background:'#27500A', border:'none' }} onClick={enregistrerTableau}><Check size={13}/> Enregistrer ({nbModifs})</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>{setModeEdition(false);setModifs({});}}>Annuler</button>
              </>
            : <button className="btn btn-ghost btn-sm" style={{ color:'#1a3f6f', borderColor:'#1a3f6f30' }} onClick={()=>setModeEdition(true)}><Pencil size={13}/> Modifier le tableau</button>}
          <button className="btn btn-ghost btn-sm" style={{ color:'#8B1A1A', borderColor:'#8B1A1A20', background:'#FDF2F2' }}
            disabled={seeding} onClick={seedYakro}>
            {seeding ? '⏳' : '🔥'} Init. Yakro
          </button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
            onClick={ouvrirCreation}><Plus size={13}/> {typeTab==='BOISSON' ? 'Boisson' : 'Ingrédient'}</button>
        </div>
      </div>

      {/* Segmentation boissons / ingrédients */}
      <div role="tablist" style={{ display:'flex', gap:8, marginBottom:14 }}>
        {[['BOISSON','🥤 Boissons'],['INGREDIENT','🥬 Ingrédients']].map(([k,l])=>(
          <button key={k} role="tab" aria-selected={typeTab===k} onClick={()=>{setTypeTab(k);setCatFilter('');setNiveauFilter('');}}
            style={{ flex:'0 1 200px', minHeight:44, border:'none', borderRadius:12, cursor:'pointer', fontFamily:'Syne', fontWeight:700, fontSize:14,
              background:typeTab===k?'#8B1A1A':'white', color:typeTab===k?'white':'#555', boxShadow:typeTab===k?'none':'0 0 0 1px #e8e7e1' }}>
            {l} <span style={{ opacity:.7, fontWeight:500, fontSize:12 }}>{nbParType[k]}</span>
          </button>
        ))}
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
                    <th>Statut</th>{typeTab==='BOISSON' && <th>Image</th>}<th>Produit</th><th>Catégorie</th>
                    <th style={{ textAlign:'right' }}>Stock</th>
                    <th style={{ textAlign:'right' }}>🟠 Alerte</th>
                    <th style={{ textAlign:'right' }}>🔴 Critique</th>
                    <th style={{ textAlign:'right' }}>Prix achat</th>
                    <th style={{ textAlign:'right' }}>Prix vente</th>
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
                        {typeTab==='BOISSON' && (
                          <td>
                            <button onClick={()=>setVue(p)} aria-label={`Voir ${p.nom}`} style={{ width:48, height:48, border:'none', borderRadius:10, background:'#F7F7F5', padding:0, cursor:'pointer', overflow:'hidden' }}>
                              {p.imageUrl ? <img src={imgSrc(p.imageUrl)} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:20 }}>🥤</span>}
                            </button>
                          </td>
                        )}
                        <td>
                          <div style={{ fontWeight:600, fontSize:13 }}>{p.nom}</div>
                          <div style={{ fontSize:10, color:'#888' }}>{p.reference}</div>
                          {typeTab==='BOISSON' && posStatut && p.filiale==='YAKRO_GRILL' && (posStatut[p.id]
                            ? <div style={{ fontSize:10, color:'#B97A18', fontWeight:600 }}>⚠ Absent du POS : {posStatut[p.id]}</div>
                            : <div style={{ fontSize:10, color:'#27500A', fontWeight:600 }}>✓ Visible au POS</div>)}
                        </td>
                        <td><span style={{ fontSize:10, background:'#F7F7F5', borderRadius:6, padding:'2px 6px' }}>{CATS_LABELS[p.categorie]?.split(' ').slice(1).join(' ')||p.categorie}</span></td>
                        <td style={{ textAlign:'right', fontFamily:'Syne', fontWeight:800, fontSize:14, color:n.color }}>
                          {modeEdition ? champ(p,'stock',p.stockTotal) : <>{p.stockTotal||0} <span style={{ fontSize:10, fontWeight:400 }}>{p.unite}</span></>}
                        </td>
                        <td style={{ textAlign:'right', fontSize:11, color:'#888' }}>{modeEdition ? champ(p,'stockAlert',p.stockAlert) : (p.stockAlert||0)}</td>
                        <td style={{ textAlign:'right', fontSize:11, color:'#888' }}>{modeEdition ? champ(p,'stockMinimum',p.stockMinimum) : (p.stockMinimum||0)}</td>
                        <td style={{ textAlign:'right', fontSize:12 }}>{modeEdition ? champ(p,'prixAchat',p.prixAchat) : fmtF(p.prixAchat||0)}</td>
                        <td style={{ textAlign:'right', fontSize:12 }}>{modeEdition ? champ(p,'prixVente',p.prixVente) : fmtF(p.prixVente||0)}</td>
                        <td style={{ textAlign:'right', fontSize:12, fontWeight:600, color:'#1a3f6f' }}>
                          {fmtF((p.stockTotal||0)*(p.prixAchat||0))}
                        </td>
                        <td>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={()=>setShowMvt(p)} className="btn btn-sm btn-ghost" style={{ fontSize:11 }}>± Mouvement</button>
                            <button onClick={()=>ouvrirEdition(p)} className="btn btn-sm btn-ghost" aria-label={`Modifier ${p.nom}`}><Pencil size={13}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={11}>
                      <div className="empty-state">
                        <Package size={28} color="#ddd"/>
                        <p style={{ marginTop:8 }}>
                          {list.length === 0 && tous.length === 0
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
              <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>{edition ? '✏️ Modifier' : (form.type==='BOISSON' ? '🥤 Nouvelle boisson' : '🥬 Nouvel ingrédient')}</h3>
              <button onClick={()=>{setShowCreate(false);setEdition(null);}} aria-label="Fermer" style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ gridColumn:'1/-1' }}><label className="label">Nom *</label><input className="input" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}/></div>
              <div>
                <label className="label">Catégorie</label>
                <select className="input" value={form.categorie} onChange={e=>setForm(f=>({...f,categorie:e.target.value}))}>
                  {Object.entries(CATS_LABELS).filter(([k])=>(form.type==='BOISSON')===(k in CATS_BOISSON)).map(([k,v])=><option key={k} value={k}>{v}</option>)}
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
              {form.type==='BOISSON' && (
                <div style={{ gridColumn:'1/-1', display:'grid', gap:8 }}>
                  <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                    <div style={{ width:84, height:84, borderRadius:12, background:'#F7F7F5', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {form.imageUrl ? <img src={imgSrc(form.imageUrl)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:28 }}>🥤</span>}
                    </div>
                    <div style={{ display:'grid', gap:6, flex:1, minWidth:0 }}>
                      <label className="btn btn-sm btn-ghost" style={{ cursor:'pointer', justifySelf:'start' }}><ImagePlus size={13}/> {form.imageUrl ? 'Remplacer la photo' : 'Ajouter une photo'}
                        <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{const f=e.target.files?.[0]; e.target.value=''; lireImage(f, d=>setForm(x=>({...x,imageUrl:d})), m=>showToast(m,'error'));}}/>
                      </label>
                      <input className="input" placeholder="…ou URL de l'image (https://)" value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl} onChange={e=>setForm(f=>({...f,imageUrl:e.target.value}))}/>
                    </div>
                    {form.imageUrl && <button type="button" className="btn btn-sm btn-ghost" style={{ color:'#A32D2D' }} onClick={()=>setForm(f=>({...f,imageUrl:''}))}>Retirer</button>}
                  </div>
                  <div><label className="label">Lien de l'article (visualisation)</label><input className="input" type="url" placeholder="https://…" value={form.lien} onChange={e=>setForm(f=>({...f,lien:e.target.value}))}/></div>
                </div>
              )}
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
                {createMut.isPending?'...':(edition?'Enregistrer':'Créer')}
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

      {vue && (
        <div className="modal-overlay" onClick={()=>setVue(null)}>
          <div className="modal" style={{ maxWidth:420, textAlign:'center' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>{vue.nom}</h3>
              <button onClick={()=>setVue(null)} aria-label="Fermer" style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            {vue.imageUrl ? <img src={imgSrc(vue.imageUrl)} alt={vue.nom} style={{ width:'100%', maxHeight:380, objectFit:'contain', borderRadius:12, background:'#F7F7F5' }}/> : <div style={{ padding:40, fontSize:48, background:'#F7F7F5', borderRadius:12 }}>🥤</div>}
            <div style={{ fontSize:12, color:'#888', marginTop:10 }}>{vue.reference} · {vue.unite} · Stock {vue.stockTotal||0}</div>
            <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:12 }}>
              {vue.lien && <a className="btn btn-sm btn-ghost" href={vue.lien} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/> Ouvrir le lien</a>}
              {vue.imageUrl?.startsWith('http') && <a className="btn btn-sm btn-ghost" href={vue.imageUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/> Image</a>}
              <button className="btn btn-sm btn-ghost" onClick={()=>{ouvrirEdition(vue);setVue(null);}}><Pencil size={13}/> Modifier</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position:'fixed', bottom:20, right:16, background:toast.t==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>{toast.msg}</div>}
    </div>
  );
}
