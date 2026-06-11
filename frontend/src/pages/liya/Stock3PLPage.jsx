/**
 * LiYA — Stock Clients 3PL avec Partenaires
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { liyaAPI, partenairesLiyaAPI } from '../../lib/api';
import { Package, Plus, X, Search, Building2, RefreshCw } from 'lucide-react';
import { exportExcel } from '../../lib/export';

const STATUTS_CONFIG = {
  EN_STOCK:   { label:'En stock',   color:'#27500A', bg:'#EAF3DE', badge:'badge-green' },
  EN_TRANSIT: { label:'En transit', color:'#BA7517', bg:'#FAEEDA', badge:'badge-amber' },
  SORTI:      { label:'Sorti',      color:'#888',    bg:'#F7F7F5', badge:'badge-gray'  },
  LITIGE:     { label:'Litige',     color:'#A32D2D', bg:'#FCEBEB', badge:'badge-red'   },
};

const fmtD = d => d ? new Date(d).toLocaleDateString('fr', { day:'2-digit', month:'short', year:'numeric' }) : '—';

export default function Stock3PLPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showCreatePartenaire, setShowCreatePartenaire] = useState(false);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('EN_STOCK');
  const [partenaireFilter, setPartenaireFilter] = useState('');
  const [toast, setToast] = useState(null);
  const showToast = (msg, t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3000); };

  const [form, setForm] = useState({
    partenaireId: '', clientNom:'', clientTel:'', article:'',
    quantite:'', unite:'unité', poids:'', volume:'', notes:'', valeurDeclaree:''
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const [formP, setFormP] = useState({ nom:'', raisonSociale:'', telephone:'', email:'', adresse:'', typeActivite:'', notes:'' });
  const setP = (k,v) => setFormP(f=>({...f,[k]:v}));

  // Données
  const { data: stocks = [], isLoading, refetch } = useQuery({
    queryKey: ['stock3pl', statutFilter, partenaireFilter, search],
    queryFn: () => liyaAPI.stock3pl({
      statut: statutFilter||undefined,
      partenaireId: partenaireFilter||undefined,
      search: search||undefined,
    }),
    staleTime: 15000,
  });

  const { data: partenaires = [] } = useQuery({
    queryKey: ['partenaires-liya'],
    queryFn: () => partenairesLiyaAPI.list({ actif: 'true' }),
    staleTime: 60000,
  });

  const listePartenaires = Array.isArray(partenaires) ? partenaires : [];
  const listeStocks = Array.isArray(stocks) ? stocks : (stocks?.data || []);

  // Stats
  const stats = {
    enStock:   listeStocks.filter(s=>s.statut==='EN_STOCK').length,
    enTransit: listeStocks.filter(s=>s.statut==='EN_TRANSIT').length,
    sorti:     listeStocks.filter(s=>s.statut==='SORTI').length,
    litige:    listeStocks.filter(s=>s.statut==='LITIGE').length,
  };

  const createMut = useMutation({
    mutationFn: liyaAPI.createStock3pl,
    onSuccess: () => {
      qc.invalidateQueries(['stock3pl']);
      setShowCreate(false);
      setForm({ partenaireId:'', clientNom:'', clientTel:'', article:'', quantite:'', unite:'unité', poids:'', volume:'', notes:'', valeurDeclaree:'' });
      showToast('Article créé ✓');
    },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const createPartenaireMut = useMutation({
    mutationFn: partenairesLiyaAPI.create,
    onSuccess: (p) => {
      qc.invalidateQueries(['partenaires-liya']);
      setShowCreatePartenaire(false);
      setFormP({ nom:'', raisonSociale:'', telephone:'', email:'', adresse:'', typeActivite:'', notes:'' });
      set('partenaireId', p.id); // Sélectionner automatiquement le nouveau partenaire
      showToast(`Partenaire "${p.nom}" créé ✓`);
    },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const sortirMut = useMutation({
    mutationFn: id => liyaAPI.sortirStock3pl(id),
    onSuccess: () => { qc.invalidateQueries(['stock3pl']); showToast('Article sorti ✓'); },
  });

  const handleSave = () => {
    const partenaire = listePartenaires.find(p=>p.id===form.partenaireId);
    createMut.mutate({
      ...form,
      clientNom: form.clientNom || partenaire?.nom || '',
      clientTel: form.clientTel || partenaire?.telephone || '',
      quantite: Number(form.quantite),
      poids: form.poids ? Number(form.poids) : undefined,
      volume: form.volume ? Number(form.volume) : undefined,
      valeurDeclaree: form.valeurDeclaree ? Number(form.valeurDeclaree) : undefined,
    });
  };

  const exportData = () => {
    exportExcel('stock_3pl_liya', 'Stock 3PL',
      ['Partenaire','Client','Article','Qté','Unité','Statut','Entré le','Notes'],
      listeStocks.map(s=>[s.partenaire?.nom||'—', s.clientNom, s.article, s.quantite, s.unite, s.statut, fmtD(s.createdAt), s.notes||''])
    );
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#E85D04' }}>
            📦 Stock Clients 3PL
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            {listeStocks.filter(s=>s.statut==='EN_STOCK').length} articles en stock
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>refetch()}><RefreshCw size={13}/></button>
          <button className="btn btn-ghost btn-sm" onClick={exportData}>📥 Export</button>
          <button className="btn btn-ghost btn-sm" style={{ color:'#E85D04', borderColor:'#E85D0430' }}
            onClick={()=>setShowCreatePartenaire(true)}>
            <Building2 size={13}/> Nouveau partenaire
          </button>
          <button className="btn btn-primary btn-sm" style={{ background:'#E85D04', border:'none' }}
            onClick={()=>setShowCreate(true)}>
            <Plus size={13}/> Entrée stock
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'En stock', value:stats.enStock, color:'#27500A' },
          { label:'En transit', value:stats.enTransit, color:'#BA7517' },
          { label:'Sortis', value:stats.sorti, color:'#888' },
          { label:'Litiges', value:stats.litige, color:'#A32D2D' },
        ].map((k,i)=>(
          <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
            <div className="kpi-label">{k.label}</div>
            <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:22, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Partenaires rapides */}
      {listePartenaires.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#888', marginBottom:8 }}>PARTENAIRES</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <button onClick={()=>setPartenaireFilter('')}
              className={`filter-btn ${partenaireFilter===''?'active':''}`}>
              Tous
            </button>
            {listePartenaires.map(p=>(
              <button key={p.id} onClick={()=>setPartenaireFilter(p.id)}
                className={`filter-btn ${partenaireFilter===p.id?'active':''}`}
                style={{ display:'flex', alignItems:'center', gap:5 }}>
                <Building2 size={10}/>
                {p.nom}
                <span style={{ background:'#e8e7e1', borderRadius:8, padding:'0px 5px', fontSize:9 }}>
                  {p._count?.stocks3pl||0}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtres statut + recherche */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        {Object.entries(STATUTS_CONFIG).map(([k,v])=>(
          <button key={k} onClick={()=>setStatutFilter(statutFilter===k?'':k)}
            className={`filter-btn ${statutFilter===k?'active':''}`}>
            {v.label}
            <span style={{ marginLeft:4, opacity:0.7, fontSize:10 }}>
              ({listeStocks.filter(s=>s.statut===k).length})
            </span>
          </button>
        ))}
        <div style={{ display:'flex', gap:6, background:'white', border:'0.5px solid #e8e7e1', borderRadius:8, padding:'5px 12px', flex:1, minWidth:160 }}>
          <Search size={13} color="#888"/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Client, article, référence..."
            style={{ border:'none', outline:'none', fontSize:12, flex:1 }}/>
        </div>
      </div>

      {/* Tableau */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {isLoading ? (
          <div style={{ padding:40, textAlign:'center', color:'#888' }}>Chargement...</div>
        ) : (
          <table className="table-erp">
            <thead>
              <tr>
                <th>Partenaire</th>
                <th>Client</th>
                <th>Article</th>
                <th style={{ textAlign:'right' }}>Quantité</th>
                <th>Entré le</th>
                <th>Statut</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {listeStocks.map(s => {
                const sc = STATUTS_CONFIG[s.statut] || STATUTS_CONFIG.EN_STOCK;
                return (
                  <tr key={s.id}>
                    <td>
                      {s.partenaire ? (
                        <div>
                          <div style={{ fontWeight:600, fontSize:12 }}>{s.partenaire.nom}</div>
                          <div style={{ fontSize:10, color:'#888' }}>{s.partenaire.typeActivite||''}</div>
                        </div>
                      ) : <span style={{ color:'#ccc', fontSize:11 }}>—</span>}
                    </td>
                    <td>
                      <div style={{ fontWeight:500, fontSize:13 }}>{s.clientNom}</div>
                      <div style={{ fontSize:11, color:'#888' }}>{s.clientTel}</div>
                    </td>
                    <td style={{ fontWeight:500 }}>{s.article}</td>
                    <td style={{ textAlign:'right', fontFamily:'Syne', fontWeight:700 }}>
                      {s.quantite} <span style={{ fontSize:10, fontWeight:400, color:'#888' }}>{s.unite}</span>
                    </td>
                    <td style={{ fontSize:11, color:'#888' }}>{fmtD(s.createdAt)}</td>
                    <td>
                      <span className={sc.badge} style={{ fontSize:10 }}>{sc.label}</span>
                    </td>
                    <td style={{ fontSize:11, color:'#888', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.notes||'—'}
                    </td>
                    <td>
                      {s.statut === 'EN_STOCK' && (
                        <button className="btn btn-sm btn-ghost" style={{ fontSize:11, color:'#A32D2D' }}
                          onClick={()=>{ if(confirm('Confirmer la sortie de cet article ?')) sortirMut.mutate(s.id); }}>
                          Sortir
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {listeStocks.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    <Package size={28} color="#ddd"/>
                    <p>Aucun article en stock{partenaireFilter ? ' pour ce partenaire' : ''}</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal entrée stock */}
      {showCreate && (
        <div className="modal-overlay" onClick={()=>setShowCreate(false)}>
          <div className="modal" style={{ maxWidth:520 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16, color:'#E85D04' }}>📦 Nouvelle entrée stock</h3>
              <button onClick={()=>setShowCreate(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>

            {/* Sélection partenaire */}
            <div style={{ background:'#FFF5F0', borderRadius:8, padding:'12px 14px', marginBottom:14 }}>
              <label className="label">Partenaire (client régulier)</label>
              <div style={{ display:'flex', gap:6 }}>
                <select className="input" style={{ flex:1 }} value={form.partenaireId}
                  onChange={e=>{
                    set('partenaireId', e.target.value);
                    const p = listePartenaires.find(x=>x.id===e.target.value);
                    if (p) { set('clientNom', p.nom); set('clientTel', p.telephone||''); }
                    else { set('clientNom',''); set('clientTel',''); }
                  }}>
                  <option value="">— Client occasionnel (saisie manuelle)</option>
                  {listePartenaires.map(p=>(
                    <option key={p.id} value={p.id}>{p.nom} — {p.telephone}</option>
                  ))}
                </select>
                <button className="btn btn-ghost btn-sm" style={{ whiteSpace:'nowrap', color:'#E85D04' }}
                  onClick={()=>setShowCreatePartenaire(true)}>
                  + Nouveau
                </button>
              </div>
              <div style={{ fontSize:10, color:'#888', marginTop:4 }}>
                Sélectionner un partenaire pré-enregistré ou saisir un client ponctuel
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label className="label">Nom client {!form.partenaireId?'*':''}</label>
                <input className="input" value={form.clientNom} onChange={e=>set('clientNom',e.target.value)}
                  placeholder="Nom ou raison sociale"/>
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={form.clientTel} onChange={e=>set('clientTel',e.target.value)}
                  placeholder="07XXXXXXXX"/>
              </div>
              <div className="full">
                <label className="label">Article / Description *</label>
                <input className="input" value={form.article} onChange={e=>set('article',e.target.value)}
                  placeholder="Ex: Cartons téléphones, Électroménager..."/>
              </div>
              <div>
                <label className="label">Quantité *</label>
                <input className="input" type="number" min={1} value={form.quantite} onChange={e=>set('quantite',e.target.value)}/>
              </div>
              <div>
                <label className="label">Unité</label>
                <select className="input" value={form.unite} onChange={e=>set('unite',e.target.value)}>
                  {['unité','carton','sac','palette','kg','tonne','m²','litre'].map(u=><option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Poids (kg)</label>
                <input className="input" type="number" min={0} value={form.poids} onChange={e=>set('poids',e.target.value)} placeholder="Optionnel"/>
              </div>
              <div>
                <label className="label">Valeur déclarée (FCFA)</label>
                <input className="input" type="number" min={0} value={form.valeurDeclaree} onChange={e=>set('valeurDeclaree',e.target.value)} placeholder="Optionnel"/>
              </div>
              <div className="full">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)}
                  placeholder="Instructions de stockage, fragilité..." style={{ resize:'vertical' }}/>
              </div>
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowCreate(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ background:'#E85D04', border:'none' }}
                disabled={(!form.clientNom&&!form.partenaireId)||!form.article||!form.quantite||createMut.isPending}
                onClick={handleSave}>
                {createMut.isPending?'...':'📦 Enregistrer l\'entrée'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal créer partenaire */}
      {showCreatePartenaire && (
        <div className="modal-overlay" onClick={()=>setShowCreatePartenaire(false)}>
          <div className="modal" style={{ maxWidth:480 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16, color:'#E85D04' }}>
                <Building2 size={16} style={{ verticalAlign:'middle', marginRight:6 }}/>
                Nouveau partenaire 3PL
              </h3>
              <button onClick={()=>setShowCreatePartenaire(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div style={{ background:'#FFF5F0', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:11, color:'#E85D04' }}>
              Les partenaires sont des clients réguliers qui stockent fréquemment chez LiYA.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label className="label">Nom / Entreprise *</label>
                <input className="input" value={formP.nom} onChange={e=>setP('nom',e.target.value)} placeholder="Ex: CFAO Motors CI"/>
              </div>
              <div>
                <label className="label">Raison sociale</label>
                <input className="input" value={formP.raisonSociale} onChange={e=>setP('raisonSociale',e.target.value)}/>
              </div>
              <div>
                <label className="label">Téléphone *</label>
                <input className="input" value={formP.telephone} onChange={e=>setP('telephone',e.target.value)} placeholder="07XXXXXXXX"/>
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={formP.email} onChange={e=>setP('email',e.target.value)}/>
              </div>
              <div>
                <label className="label">Type d'activité</label>
                <select className="input" value={formP.typeActivite} onChange={e=>setP('typeActivite',e.target.value)}>
                  <option value="">— Choisir —</option>
                  {['Commerce','Industrie','Import/Export','Distribution','E-commerce','Autre'].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Adresse</label>
                <input className="input" value={formP.adresse} onChange={e=>setP('adresse',e.target.value)} placeholder="Abidjan, Cocody..."/>
              </div>
              <div className="full">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={formP.notes} onChange={e=>setP('notes',e.target.value)}
                  style={{ resize:'vertical' }} placeholder="Instructions spéciales, conditions..."/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowCreatePartenaire(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ background:'#E85D04', border:'none' }}
                disabled={!formP.nom||!formP.telephone||createPartenaireMut.isPending}
                onClick={()=>createPartenaireMut.mutate(formP)}>
                {createPartenaireMut.isPending?'...':'Créer le partenaire'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:20, right:16, background:toast.t==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
