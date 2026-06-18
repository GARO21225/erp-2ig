import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { liyaAPI, partenairesLiyaAPI } from '../../lib/api';
import { Package, Plus, X, Search, Building2, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { exportExcel } from '../../lib/export';

const STATUTS = {
  EN_STOCK:   { label:'En stock',   color:'#27500A', bg:'#EAF3DE' },
  EN_TRANSIT: { label:'En transit', color:'#BA7517', bg:'#FAEEDA' },
  SORTI:      { label:'Sorti',      color:'#888',    bg:'#F7F7F5' },
  LITIGE:     { label:'Litige',     color:'#A32D2D', bg:'#FCEBEB' },
};
const UNITES = ['unité','carton','sac','palette','kg','tonne','m²','litre'];
const TYPES_ACT = ['Commerce','Industrie','Import/Export','Distribution','E-commerce','Autre'];
const fmtD = d => d ? new Date(d).toLocaleDateString('fr',{day:'2-digit',month:'short',year:'numeric'}) : '—';

/* ── Modal Partenaire ──────────────────────────────────────────────────────── */
function ModalPartenaire({ partenaire, onClose, onSave, loading }) {
  const [f, setF] = useState({
    nom: partenaire?.nom||'', raisonSociale: partenaire?.raisonSociale||'',
    telephone: partenaire?.telephone||'', email: partenaire?.email||'',
    typeActivite: partenaire?.typeActivite||'', adresse: partenaire?.adresse||'',
    notes: partenaire?.notes||'',
  });
  const s = (k,v) => setF(x=>({...x,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:18}}>
          <h3 style={{margin:0,fontFamily:'Syne',fontSize:16,color:'#E85D04'}}>
            <Building2 size={16} style={{verticalAlign:'middle',marginRight:6}}/>
            {partenaire ? 'Modifier le partenaire' : 'Nouveau partenaire 3PL'}
          </h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer'}}><X size={18}/></button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><label className="label">Nom *</label><input className="input" value={f.nom} onChange={e=>s('nom',e.target.value)}/></div>
          <div><label className="label">Raison sociale</label><input className="input" value={f.raisonSociale} onChange={e=>s('raisonSociale',e.target.value)}/></div>
          <div><label className="label">Téléphone *</label><input className="input" value={f.telephone} onChange={e=>s('telephone',e.target.value)}/></div>
          <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={e=>s('email',e.target.value)}/></div>
          <div>
            <label className="label">Type d'activité</label>
            <select className="input" value={f.typeActivite} onChange={e=>s('typeActivite',e.target.value)}>
              <option value="">—</option>
              {TYPES_ACT.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="label">Adresse</label><input className="input" value={f.adresse} onChange={e=>s('adresse',e.target.value)}/></div>
          <div style={{gridColumn:'1/-1'}}><label className="label">Notes</label>
            <textarea className="input" rows={2} value={f.notes} onChange={e=>s('notes',e.target.value)} style={{resize:'vertical'}}/>
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:18}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" style={{background:'#E85D04',border:'none'}}
            disabled={!f.nom||!f.telephone||loading}
            onClick={()=>onSave(f)}>
            {loading?'...':partenaire?'Enregistrer':'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal Article (création + édition) ───────────────────────────────────── */
function ModalArticle({ article, listePartenaires, onClose, onSave, loading }) {
  const isEdit = !!article;
  const [f, setF] = useState({
    partenaireId: article?.partenaireId||'',
    clientNom: article?.clientNom||'',
    clientTel: article?.clientTel||'',
    article: article?.article||'',
    quantite: article?.quantite||'',
    unite: article?.unite||'unité',
    statut: article?.statut||'EN_STOCK',
    notes: article?.notes||'',
  });
  const s = (k,v) => setF(x=>({...x,[k]:v}));
  const partenaire = listePartenaires.find(p=>p.id===f.partenaireId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:18}}>
          <h3 style={{margin:0,fontFamily:'Syne',fontSize:16,color:'#E85D04'}}>
            {isEdit ? '✏️ Modifier l\'article' : '📦 Nouvelle entrée stock'}
          </h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer'}}><X size={18}/></button>
        </div>

        {/* Partenaire */}
        <div style={{background:'#FFF5F0',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
          <label className="label">Partenaire (client régulier)</label>
          <select className="input" value={f.partenaireId}
            onChange={e=>{
              s('partenaireId',e.target.value);
              const p=listePartenaires.find(x=>x.id===e.target.value);
              if(p){s('clientNom',p.nom);s('clientTel',p.telephone||'');}
              else if(!isEdit){s('clientNom','');s('clientTel','');}
            }}>
            <option value="">— Client occasionnel</option>
            {listePartenaires.map(p=><option key={p.id} value={p.id}>{p.nom} — {p.telephone}</option>)}
          </select>
        </div>

        {!f.partenaireId && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div><label className="label">Nom client {!isEdit?'*':''}</label>
              <input className="input" value={f.clientNom} onChange={e=>s('clientNom',e.target.value)}/></div>
            <div><label className="label">Téléphone</label>
              <input className="input" value={f.clientTel} onChange={e=>s('clientTel',e.target.value)}/></div>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{gridColumn:'1/-1'}}>
            <label className="label">Article / Description *</label>
            <input className="input" value={f.article} onChange={e=>s('article',e.target.value)} placeholder="Ex: Cartons téléphones..."/>
          </div>
          <div><label className="label">Quantité *</label>
            <input className="input" type="number" min={1} value={f.quantite} onChange={e=>s('quantite',e.target.value)}/></div>
          <div>
            <label className="label">Unité</label>
            <select className="input" value={f.unite} onChange={e=>s('unite',e.target.value)}>
              {UNITES.map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {isEdit && (
            <div>
              <label className="label">Statut</label>
              <select className="input" value={f.statut} onChange={e=>s('statut',e.target.value)}>
                {Object.entries(STATUTS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          )}
          <div style={{gridColumn:'1/-1'}}>
            <label className="label">Notes</label>
            <input className="input" value={f.notes} onChange={e=>s('notes',e.target.value)} placeholder="Instructions..."/>
          </div>
        </div>

        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:18}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" style={{background:'#E85D04',border:'none'}}
            disabled={(!f.clientNom&&!f.partenaireId)||!f.article||!f.quantite||loading}
            onClick={()=>onSave({
              ...f,
              clientNom: f.clientNom||partenaire?.nom||'',
              clientTel: f.clientTel||partenaire?.telephone||'',
              quantite: Number(f.quantite),
            })}>
            {loading?'...':isEdit?'Enregistrer':'📦 Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page principale ──────────────────────────────────────────────────────── */
export default function Stock3PLPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editArticle, setEditArticle] = useState(null);
  const [showCreatePartenaire, setShowCreatePartenaire] = useState(false);
  const [editPartenaire, setEditPartenaire] = useState(null);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('EN_STOCK');
  const [partenaireFilter, setPartenaireFilter] = useState('');
  const [toast, setToast] = useState(null);
  const showToast = (msg,t='success')=>{setToast({msg,t});setTimeout(()=>setToast(null),3000);};

  const {data:stocksRaw,isLoading,refetch} = useQuery({
    queryKey:['stock3pl',statutFilter,partenaireFilter,search],
    queryFn:()=>liyaAPI.stock3pl({
      statut:statutFilter||undefined,
      partenaireId:partenaireFilter||undefined,
      search:search||undefined,
    }),
    staleTime:15000,
  });

  const {data:partRaw=[]} = useQuery({
    queryKey:['partenaires-liya'],
    queryFn:()=>partenairesLiyaAPI.list(),
    staleTime:60000,
  });

  const listePartenaires = Array.isArray(partRaw)?partRaw:[];
  const listeStocks = Array.isArray(stocksRaw)?stocksRaw:(stocksRaw?.data||[]);

  const stats = {
    enStock:   listeStocks.filter(s=>s.statut==='EN_STOCK').length,
    enTransit: listeStocks.filter(s=>s.statut==='EN_TRANSIT').length,
    sorti:     listeStocks.filter(s=>s.statut==='SORTI').length,
    litige:    listeStocks.filter(s=>s.statut==='LITIGE').length,
  };

  const createMut = useMutation({
    mutationFn: liyaAPI.createStock3pl,
    onSuccess:()=>{qc.invalidateQueries(['stock3pl']);setShowCreate(false);showToast('Article créé ✓');},
    onError:e=>showToast(e?.response?.data?.error||'Erreur','error'),
  });
  const updateMut = useMutation({
    mutationFn:({id,data})=>liyaAPI.updateStock3pl(id,data),
    onSuccess:()=>{qc.invalidateQueries(['stock3pl']);setEditArticle(null);showToast('Article mis à jour ✓');},
    onError:e=>showToast(e?.response?.data?.error||'Erreur','error'),
  });
  const deleteMut = useMutation({
    mutationFn: liyaAPI.deleteStock3pl,
    onSuccess:()=>{qc.invalidateQueries(['stock3pl']);showToast('Article supprimé');},
    onError:e=>showToast(e?.response?.data?.error||'Erreur','error'),
  });
  const createPartMut = useMutation({
    mutationFn: partenairesLiyaAPI.create,
    onSuccess:(p)=>{qc.invalidateQueries(['partenaires-liya']);setShowCreatePartenaire(false);showToast(`"${p.nom}" créé ✓`);},
    onError:e=>showToast(e?.response?.data?.error||'Erreur','error'),
  });
  const updatePartMut = useMutation({
    mutationFn:({id,data})=>partenairesLiyaAPI.update(id,data),
    onSuccess:()=>{qc.invalidateQueries(['partenaires-liya']);setEditPartenaire(null);showToast('Partenaire mis à jour ✓');},
    onError:e=>showToast(e?.response?.data?.error||'Erreur','error'),
  });
  const deletePartMut = useMutation({
    mutationFn: partenairesLiyaAPI.delete,
    onSuccess:()=>{qc.invalidateQueries(['partenaires-liya']);showToast('Partenaire désactivé');},
    onError:e=>showToast(e?.response?.data?.error||'Erreur','error'),
  });
  const sortirMut = useMutation({
    mutationFn: id=>liyaAPI.sortirStock3pl(id),
    onSuccess:()=>{qc.invalidateQueries(['stock3pl']);showToast('Article sorti ✓');},
    onError:e=>showToast(e?.response?.data?.error||'Erreur sortie de stock','error'),
  });

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{margin:0,fontFamily:'Syne',fontWeight:800,fontSize:20,color:'#E85D04'}}>📦 Stock Clients 3PL</h1>
          <p style={{margin:'4px 0 0',fontSize:12,color:'#888'}}>{stats.enStock} articles en stock</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>refetch()}><RefreshCw size={13}/></button>
          <button className="btn btn-ghost btn-sm" onClick={()=>{
            const rows=listeStocks.map(s=>[s.partenaire?.nom||s.clientNom,s.article,s.quantite,s.unite,s.statut,fmtD(s.createdAt),s.notes||'']);
            exportExcel('stock_3pl','Stock 3PL',['Partenaire/Client','Article','Qté','Unité','Statut','Entré le','Notes'],rows);
          }}>📥 Export</button>
          <button className="btn btn-ghost btn-sm" style={{color:'#E85D04'}} onClick={()=>setShowCreatePartenaire(true)}>
            <Building2 size={13}/> Nouveau partenaire
          </button>
          <button className="btn btn-primary btn-sm" style={{background:'#E85D04',border:'none'}} onClick={()=>setShowCreate(true)}>
            <Plus size={13}/> Entrée stock
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:16}}>
        {[
          {label:'En stock',value:stats.enStock,color:'#27500A'},
          {label:'En transit',value:stats.enTransit,color:'#BA7517'},
          {label:'Sortis',value:stats.sorti,color:'#888'},
          {label:'Litiges',value:stats.litige,color:'#A32D2D'},
        ].map((k,i)=>(
          <div key={i} className="kpi" style={{borderTop:`3px solid ${k.color}`}}>
            <div className="kpi-label">{k.label}</div>
            <div style={{fontFamily:'Syne',fontWeight:800,fontSize:22,color:k.color}}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Partenaires avec modifier/supprimer */}
      {listePartenaires.length > 0 && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:600,color:'#888',marginBottom:8}}>PARTENAIRES</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button onClick={()=>setPartenaireFilter('')}
              className={`filter-btn ${partenaireFilter===''?'active':''}`}>Tous</button>
            {listePartenaires.map(p=>(
              <div key={p.id} style={{display:'flex',alignItems:'center',
                border:`1.5px solid ${partenaireFilter===p.id?'#E85D04':'#e8e7e1'}`,
                borderRadius:20,overflow:'hidden',
                background:partenaireFilter===p.id?'#FFF5F0':'white'}}>
                <button onClick={()=>setPartenaireFilter(partenaireFilter===p.id?'':p.id)}
                  style={{padding:'5px 10px',border:'none',background:'transparent',cursor:'pointer',fontSize:11,
                    color:partenaireFilter===p.id?'#E85D04':'#555',fontWeight:partenaireFilter===p.id?600:400}}>
                  <Building2 size={10} style={{marginRight:4,verticalAlign:'middle'}}/>
                  {p.nom}
                  <span style={{marginLeft:5,background:'#e8e7e1',borderRadius:8,padding:'0 5px',fontSize:9}}>
                    {p._count?.stocks3pl||0}
                  </span>
                </button>
                <button onClick={()=>setEditPartenaire(p)}
                  style={{padding:'5px 7px',border:'none',borderLeft:'1px solid #e8e7e1',background:'transparent',cursor:'pointer',color:'#1a3f6f'}}
                  title="Modifier le partenaire"><Edit2 size={10}/></button>
                <button onClick={()=>{if(window.confirm(`Désactiver "${p.nom}" ?`))deletePartMut.mutate(p.id);}}
                  style={{padding:'5px 7px',border:'none',borderLeft:'1px solid #e8e7e1',background:'transparent',cursor:'pointer',color:'#A32D2D'}}
                  title="Désactiver le partenaire"><Trash2 size={10}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        {Object.entries(STATUTS).map(([k,v])=>(
          <button key={k} onClick={()=>setStatutFilter(statutFilter===k?'':k)}
            className={`filter-btn ${statutFilter===k?'active':''}`}>
            {v.label} ({listeStocks.filter(s=>s.statut===k).length})
          </button>
        ))}
        <div style={{display:'flex',gap:6,background:'white',border:'0.5px solid #e8e7e1',borderRadius:8,padding:'5px 12px',flex:1}}>
          <Search size={13} color="#888"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Client, article..."
            style={{border:'none',outline:'none',fontSize:12,flex:1}}/>
        </div>
      </div>

      {/* Tableau */}
      <div className="card" style={{padding:0,overflowX:'auto'}}>
        {isLoading ? <div style={{padding:40,textAlign:'center',color:'#888'}}>Chargement...</div> : (
          <table className="table-erp">
            <thead>
              <tr>
                <th>Partenaire</th><th>Client</th><th>Article</th>
                <th style={{textAlign:'right'}}>Quantité</th>
                <th>Entré le</th><th>Statut</th><th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listeStocks.map(s=>{
                const sc=STATUTS[s.statut]||STATUTS.EN_STOCK;
                // Nom partenaire : d'abord s.partenaire (lié), sinon chercher par clientNom
                const nomPartenaire = s.partenaire?.nom || null;
                return (
                  <tr key={s.id}>
                    <td>
                      {nomPartenaire ? (
                        <div>
                          <div style={{fontWeight:600,fontSize:12}}>{nomPartenaire}</div>
                          <div style={{fontSize:10,color:'#888'}}>{s.partenaire.typeActivite||''}</div>
                        </div>
                      ) : <span style={{color:'#ccc',fontSize:11}}>—</span>}
                    </td>
                    <td>
                      <div style={{fontWeight:500,fontSize:13}}>{s.clientNom}</div>
                      {s.clientTel && <div style={{fontSize:11,color:'#888'}}>{s.clientTel}</div>}
                    </td>
                    <td style={{fontWeight:500}}>{s.article}</td>
                    <td style={{textAlign:'right',fontFamily:'Syne',fontWeight:700}}>
                      {s.quantite} <span style={{fontSize:10,fontWeight:400,color:'#888'}}>{s.unite}</span>
                    </td>
                    <td style={{fontSize:11,color:'#888'}}>{fmtD(s.createdAt)}</td>
                    <td>
                      <span style={{fontSize:10,background:sc.bg,color:sc.color,borderRadius:8,padding:'2px 8px',fontWeight:500}}>
                        {sc.label}
                      </span>
                    </td>
                    <td style={{fontSize:11,color:'#888',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {s.notes||'—'}
                    </td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        {/* Modifier l'article */}
                        <button className="btn btn-xs" style={{background:'#EEF3FB',color:'#1a3f6f',border:'none',padding:'4px 8px'}}
                          onClick={()=>setEditArticle(s)} title="Modifier">
                          <Edit2 size={11}/>
                        </button>
                        {/* Sortir */}
                        {s.statut==='EN_STOCK' && (
                          <button className="btn btn-xs btn-ghost" style={{fontSize:10,color:'#BA7517'}}
                            onClick={()=>{if(window.confirm('Confirmer la sortie ?'))sortirMut.mutate(s.id);}}>
                            Sortir
                          </button>
                        )}
                        {/* Supprimer */}
                        <button className="btn btn-xs" style={{background:'#FCEBEB',color:'#A32D2D',border:'none',padding:'4px 8px'}}
                          onClick={()=>{if(window.confirm('Supprimer cet article ?'))deleteMut.mutate(s.id);}}
                          title="Supprimer">
                          <Trash2 size={11}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {listeStocks.length===0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state"><Package size={28} color="#ddd"/>
                    <p>Aucun article{partenaireFilter?' pour ce partenaire':''}</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals articles */}
      {showCreate && (
        <ModalArticle listePartenaires={listePartenaires} onClose={()=>setShowCreate(false)}
          onSave={createMut.mutate} loading={createMut.isPending}/>
      )}
      {editArticle && (
        <ModalArticle article={editArticle} listePartenaires={listePartenaires}
          onClose={()=>setEditArticle(null)}
          onSave={data=>updateMut.mutate({id:editArticle.id,data})}
          loading={updateMut.isPending}/>
      )}

      {/* Modals partenaires */}
      {showCreatePartenaire && (
        <ModalPartenaire onClose={()=>setShowCreatePartenaire(false)}
          onSave={createPartMut.mutate} loading={createPartMut.isPending}/>
      )}
      {editPartenaire && (
        <ModalPartenaire partenaire={editPartenaire} onClose={()=>setEditPartenaire(null)}
          onSave={data=>updatePartMut.mutate({id:editPartenaire.id,data})}
          loading={updatePartMut.isPending}/>
      )}

      {toast && (
        <div style={{position:'fixed',bottom:20,right:16,background:toast.t==='error'?'#A32D2D':'#27500A',color:'white',padding:'10px 18px',borderRadius:10,fontSize:13,zIndex:9999}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
