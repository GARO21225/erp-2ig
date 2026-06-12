/**
 * YAKRO GRILL — Plan de Salle (POS)
 * Assignation serveur obligatoire, panneau table complet, transfert, clôture
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exportTicketYakro } from '../../lib/export';
import { yakroAPI, employesAPI } from '../../lib/api';
import DocumentViewer from '../../components/ui/DocumentViewer';
import { Plus, X, Minus, ShoppingBag, Banknote, Smartphone, CreditCard, CheckCircle, Users, RefreshCw, ArrowRight } from 'lucide-react';

const STATUT_TABLE = {
  LIBRE:    { label:'Libre',     color:'#639922', bg:'#F4FAE8', border:'#C0DD97' },
  OCCUPEE:  { label:'Occupée',   color:'#A32D2D', bg:'#FEF6F6', border:'#F7C1C1' },
  RESERVEE: { label:'Réservée',  color:'#BA7517', bg:'#FEFAF0', border:'#FAC775' },
  NETTOYAGE:{ label:'Nettoyage', color:'#1a3f6f', bg:'#EEF3FB', border:'#B5D4F4' },
};
const ZONES = ['Salle','Terrasse','VIP','Bar'];
const MOYENS_PMT = [
  { key:'ESPECES',      label:'Espèces',      icon:Banknote,   color:'#27500A' },
  { key:'ORANGE_MONEY', label:'Orange Money', icon:Smartphone, color:'#E87722' },
  { key:'MTN_MONEY',    label:'MTN Money',    icon:Smartphone, color:'#FFCC00', textColor:'#1a1a1a' },
  { key:'MOOV_MONEY',   label:'Moov Money',   icon:Smartphone, color:'#0066CC' },
  { key:'WAVE',         label:'Wave',         icon:Smartphone, color:'#1A73E8' },
  { key:'BANQUE',       label:'Banque/TPE',   icon:CreditCard, color:'#5F5E5A' },
];

// ─── Panel commande ────────────────────────────────────────────────────────────
function PanelCommande({ table, menu, onClose, onSave, loading, listeServeurs }) {
  const [lignes, setLignes] = useState([]);
  const [notes, setNotes] = useState('');
  const [nbCouverts, setNbCouverts] = useState(table?.capacite || 2);
  const [cat, setCat] = useState(Object.keys(menu?.grouped || {})[0] || '');
  const [serveurId, setServeurId] = useState(table?.serveurId || '');

  const addArticle = (item) => setLignes(prev => {
    const ex = prev.find(l => l.menuId === item.id);
    if (ex) return prev.map(l => l.menuId===item.id ? {...l,quantite:l.quantite+1} : l);
    return [...prev, { menuId:item.id, nom:item.nom, prixUnitaire:item.prix, quantite:1 }];
  });
  const removeArticle = (menuId) => setLignes(prev =>
    prev.map(l => l.menuId===menuId ? {...l,quantite:Math.max(0,l.quantite-1)} : l).filter(l=>l.quantite>0)
  );
  const total = lignes.reduce((s,l)=>s+l.prixUnitaire*l.quantite,0);
  const grouped = menu?.grouped || {};
  const cats = Object.keys(grouped);
  const serveurChoisi = listeServeurs.find(s=>s.id===serveurId);

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex' }}>
      {/* Carte menu */}
      <div style={{ width:'55%',background:'#F7F7F5',display:'flex',flexDirection:'column',overflow:'hidden' }}>
        <div style={{ background:'#8B1A1A',padding:'14px 20px',color:'white',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <div>
            <div style={{ fontFamily:'Syne',fontWeight:700,fontSize:15 }}>Table {table?.numero} — {table?.commandeExistante ? 'Ajouter des articles' : 'Nouvelle commande'}</div>
            <div style={{ fontSize:11,opacity:0.8 }}>{table?.zone} · {table?.capacite} places</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.2)',border:'none',color:'white',borderRadius:8,padding:'6px 12px',cursor:'pointer' }}><X size={16}/></button>
        </div>

        {/* Assignation serveur OBLIGATOIRE */}
        {!table?.commandeExistante && (
          <div style={{ padding:'10px 16px',background:'#FEF6F6',borderBottom:'1px solid #F7C1C1' }}>
            <label style={{ fontSize:11,fontWeight:600,display:'block',marginBottom:5,color:'#8B1A1A' }}>
              👤 Serveur assigné *
            </label>
            <select className="input" style={{ fontSize:12 }} value={serveurId} onChange={e=>setServeurId(e.target.value)}>
              <option value="">— Sélectionner un serveur (obligatoire)</option>
              {listeServeurs.map(s=>(
                <option key={s.id} value={s.id}>{s.prenom} {s.nom} — {s.poste}</option>
              ))}
            </select>
            {!serveurId && <div style={{ fontSize:10,color:'#A32D2D',marginTop:3 }}>⚠ Un serveur doit être assigné avant de commander</div>}
          </div>
        )}

        {/* Couverts */}
        <div style={{ padding:'8px 16px',borderBottom:'1px solid #e8e7e1',display:'flex',alignItems:'center',gap:12 }}>
          <span style={{ fontSize:12,color:'#888' }}>Couverts :</span>
          <button onClick={()=>setNbCouverts(v=>Math.max(1,v-1))} style={{ width:24,height:24,borderRadius:6,border:'1px solid #ddd',background:'white',cursor:'pointer',fontSize:14 }}>−</button>
          <span style={{ fontFamily:'Syne',fontWeight:700,fontSize:16,minWidth:24,textAlign:'center' }}>{nbCouverts}</span>
          <button onClick={()=>setNbCouverts(v=>v+1)} style={{ width:24,height:24,borderRadius:6,border:'1px solid #ddd',background:'white',cursor:'pointer',fontSize:14 }}>+</button>
        </div>

        {/* Catégories */}
        <div style={{ display:'flex',gap:4,padding:'8px 12px',overflowX:'auto',borderBottom:'1px solid #e8e7e1',flexShrink:0 }}>
          {cats.map(c=>(
            <button key={c} onClick={()=>setCat(c)}
              style={{ padding:'4px 12px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:500,whiteSpace:'nowrap',background:cat===c?'#8B1A1A':'#F1EFE8',color:cat===c?'white':'#666' }}>
              {c}
            </button>
          ))}
        </div>

        {/* Articles */}
        <div style={{ flex:1,overflowY:'auto',padding:'10px 12px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8,alignContent:'start' }}>
          {(grouped[cat]||[]).filter(item=>item.disponible).map(item=>{
            const inLignes = lignes.find(l=>l.menuId===item.id);
            return (
              <div key={item.id} onClick={()=>addArticle(item)}
                style={{ background:'white',border:`1.5px solid ${inLignes?'#8B1A1A':'#e8e7e1'}`,borderRadius:10,padding:'10px 8px',cursor:'pointer',transition:'border-color 0.15s',textAlign:'center' }}>
                <div style={{ fontSize:12,fontWeight:inLignes?700:500,marginBottom:4,color:inLignes?'#8B1A1A':'#1a1a1a',lineHeight:1.3 }}>{item.nom}</div>
                <div style={{ fontFamily:'Syne',fontWeight:700,fontSize:13,color:'#8B1A1A' }}>{item.prix.toLocaleString('fr')} F</div>
                {inLignes && <div style={{ fontSize:10,background:'#8B1A1A',color:'white',borderRadius:10,padding:'1px 6px',marginTop:4,display:'inline-block' }}>×{inLignes.quantite}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Récapitulatif */}
      <div style={{ flex:1,background:'white',display:'flex',flexDirection:'column',borderLeft:'1px solid #e8e7e1' }}>
        <div style={{ padding:'14px 16px',borderBottom:'1px solid #e8e7e1',fontFamily:'Syne',fontWeight:700,fontSize:15 }}>Récapitulatif</div>
        <div style={{ flex:1,overflowY:'auto',padding:'10px 16px' }}>
          {lignes.length === 0 ? (
            <div style={{ textAlign:'center',color:'#ccc',padding:20,fontSize:12 }}>
              <ShoppingBag size={32} style={{ display:'block',margin:'0 auto 8px' }}/>
              Aucun article sélectionné
            </div>
          ) : lignes.map(l=>(
            <div key={l.menuId} style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'0.5px solid #f0efe9' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13,fontWeight:500 }}>{l.nom}</div>
                <div style={{ fontSize:11,color:'#888' }}>{l.prixUnitaire.toLocaleString('fr')} F</div>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                <button onClick={()=>removeArticle(l.menuId)} style={{ width:22,height:22,borderRadius:5,border:'1px solid #ddd',background:'white',cursor:'pointer',fontSize:12 }}>−</button>
                <span style={{ fontWeight:700,minWidth:16,textAlign:'center' }}>{l.quantite}</span>
                <button onClick={()=>addArticle({id:l.menuId,nom:l.nom,prix:l.prixUnitaire})} style={{ width:22,height:22,borderRadius:5,border:'1px solid #ddd',background:'white',cursor:'pointer',fontSize:12 }}>+</button>
              </div>
              <div style={{ fontFamily:'Syne',fontWeight:700,fontSize:13,color:'#8B1A1A',minWidth:60,textAlign:'right' }}>
                {(l.prixUnitaire*l.quantite).toLocaleString('fr')} F
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:'12px 16px',borderTop:'1px solid #e8e7e1' }}>
          <input className="input" style={{ marginBottom:10,fontSize:12 }} placeholder="Notes de commande..."
            value={notes} onChange={e=>setNotes(e.target.value)}/>
          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:10 }}>
            <span style={{ fontSize:13,color:'#888' }}>Total</span>
            <span style={{ fontFamily:'Syne',fontWeight:800,fontSize:22,color:'#8B1A1A' }}>{total.toLocaleString('fr')} F</span>
          </div>
          <button disabled={lignes.length===0||(!serveurId&&!table?.commandeExistante)||loading}
            onClick={()=>{
              const servNom = serveurChoisi ? `${serveurChoisi.prenom} ${serveurChoisi.nom}` : null;
              onSave({ tableId:table.id, lignes, notes, nbCouverts, serveurId:serveurId||null, serveurNom:servNom });
            }}
            style={{ width:'100%',padding:12,background:lignes.length===0||(!serveurId&&!table?.commandeExistante)?'#ddd':'#8B1A1A',color:'white',border:'none',borderRadius:10,fontFamily:'Syne',fontWeight:700,fontSize:15,cursor:lignes.length===0||(!serveurId&&!table?.commandeExistante)?'not-allowed':'pointer' }}>
            {loading?'Envoi...':'🍳 Envoyer en cuisine'}
          </button>
          {!serveurId && !table?.commandeExistante && (
            <div style={{ fontSize:11,color:'#A32D2D',textAlign:'center',marginTop:4 }}>Sélectionner un serveur pour continuer</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal paiement ─────────────────────────────────────────────────────────
function ModalPaiement({ commande, loading, onClose, onPay }) {
  const [lignesPmt, setLignesPmt] = useState([{ typePaiement:'ESPECES', montant:commande.total, reference:'' }]);
  const [especesRecues, setEspecesRecues] = useState('');
  const total = commande.total || 0;
  const totalSaisi = lignesPmt.reduce((s,l)=>s+Number(l.montant||0),0);
  const resteASaisir = total - totalSaisi;
  const monnaieRendue = lignesPmt.some(l=>l.typePaiement==='ESPECES') && Number(especesRecues) > 0 ? Math.max(0,Number(especesRecues)-total) : 0;
  const canPay = Math.abs(resteASaisir) < 2;

  const addLigne = () => {
    if (resteASaisir<=0) return;
    setLignesPmt(prev=>[...prev,{typePaiement:'ORANGE_MONEY',montant:resteASaisir.toFixed(0),reference:''}]);
  };
  const removeLigne = (i) => setLignesPmt(prev=>prev.filter((_,idx)=>idx!==i));
  const updateLigne = (i,field,value) => setLignesPmt(prev=>prev.map((l,idx)=>idx===i?{...l,[field]:value}:l));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:440 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <h3 style={{ margin:0,fontFamily:'Syne',fontSize:16 }}>Paiement — {commande.numero}</h3>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div style={{ background:'#FDF2F2',borderRadius:10,padding:14,textAlign:'center',marginBottom:16 }}>
          <div style={{ fontSize:11,color:'#888' }}>Total à encaisser</div>
          <div style={{ fontFamily:'Syne',fontWeight:800,fontSize:30,color:'#8B1A1A' }}>{total.toLocaleString('fr')} F</div>
        </div>
        {lignesPmt.map((ligne,i)=>{
          const moyen = MOYENS_PMT.find(m=>m.key===ligne.typePaiement);
          const needRef = ligne.typePaiement !== 'ESPECES';
          return (
            <div key={i} style={{ background:'#F7F7F5',borderRadius:10,padding:12,marginBottom:8 }}>
              <div style={{ display:'flex',gap:8,marginBottom:needRef?8:0 }}>
                <select className="input" style={{ flex:2,fontSize:12 }} value={ligne.typePaiement} onChange={e=>updateLigne(i,'typePaiement',e.target.value)}>
                  {MOYENS_PMT.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                <input className="input" style={{ flex:1,fontSize:13,fontWeight:600 }} type="number"
                  value={ligne.montant} onChange={e=>updateLigne(i,'montant',e.target.value)} placeholder="Montant"/>
                {lignesPmt.length>1 && <button onClick={()=>removeLigne(i)} style={{ background:'#FCEBEB',border:'none',borderRadius:6,padding:'0 8px',cursor:'pointer',color:'#A32D2D' }}><X size={12}/></button>}
              </div>
              {needRef && <input className="input" style={{ fontSize:12 }} placeholder={`Réf. ${moyen?.label} *`} value={ligne.reference} onChange={e=>updateLigne(i,'reference',e.target.value)}/>}
              {ligne.typePaiement==='ESPECES' && (
                <div style={{ marginTop:8,display:'flex',gap:8,alignItems:'center' }}>
                  <input className="input" style={{ fontSize:12 }} type="number" placeholder="Espèces remises" value={especesRecues} onChange={e=>setEspecesRecues(e.target.value)}/>
                  {especesRecues && Number(especesRecues)>=Number(ligne.montant) && (
                    <div style={{ fontSize:13,fontWeight:700,color:'#27500A',whiteSpace:'nowrap' }}>
                      Rendu: {monnaieRendue.toLocaleString('fr')} F
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {resteASaisir>1 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12,color:'#A32D2D',marginBottom:6,fontWeight:500 }}>Reste : {resteASaisir.toLocaleString('fr')} F</div>
            <button onClick={addLigne} style={{ fontSize:12,border:'1px dashed #d3d1c7',background:'white',borderRadius:8,padding:'6px 14px',cursor:'pointer',color:'#666',width:'100%' }}>+ Autre moyen de paiement</button>
          </div>
        )}
        {canPay && <div style={{ background:'#EAF3DE',borderRadius:8,padding:'8px 12px',marginBottom:12,display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#27500A' }}><CheckCircle size={14}/> Prêt à encaisser</div>}
        <button disabled={!canPay||loading} onClick={()=>onPay({ paiements:lignesPmt.map(p=>({...p,montant:Number(p.montant)})), especesRecues:Number(especesRecues)||0, monnaieRendue })}
          style={{ width:'100%',padding:13,background:canPay?'#8B1A1A':'#ddd',color:'white',border:'none',borderRadius:10,fontFamily:'Syne',fontWeight:700,fontSize:15,cursor:canPay?'pointer':'not-allowed' }}>
          {loading?'Traitement...':`Encaisser ${total.toLocaleString('fr')} F`}
        </button>
      </div>
    </div>
  );
}

// ─── Modal panneau table (détail) ───────────────────────────────────────────
function PanneauTable({ table, listeServeurs, allTables, onClose, onCommander, onEncaisser, onChanger, qc }) {
  const [showChangerServeur, setShowChangerServeur] = useState(false);
  const [showTransferer, setShowTransferer] = useState(false);
  const [nouveauServeurId, setNouveauServeurId] = useState('');
  const [tableCibleId, setTableCibleId] = useState('');
  const commande = table.commandes?.[0];
  const s = STATUT_TABLE[table.statut] || STATUT_TABLE.LIBRE;

  // Calcul temps occupation
  const heureOuv = table.heureOuverture ? new Date(table.heureOuverture) : (commande?.createdAt ? new Date(commande.createdAt) : null);
  const maintenant = new Date();
  const dureeMin = heureOuv ? Math.round((maintenant - heureOuv) / 60000) : null;

  const assignerMut = useMutation({ mutationFn: (data) => yakroAPI.assignerServeur(table.id, data), onSuccess:()=>{ qc.invalidateQueries(['tables']); setShowChangerServeur(false); } });
  const cloturerMut = useMutation({ mutationFn: ()=>yakroAPI.cloturerTable(table.id), onSuccess:()=>{ qc.invalidateQueries(['tables']); onClose(); } });
  const transfererMut = useMutation({ mutationFn: (data)=>yakroAPI.transfererTable(data), onSuccess:()=>{ qc.invalidateQueries(['tables']); setShowTransferer(false); onClose(); } });

  const tablesDisponibles = allTables.filter(t=>t.id!==table.id && t.statut==='LIBRE');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <div>
            <h3 style={{ margin:0,fontFamily:'Syne',fontSize:18,color:s.color }}>Table {table.numero}</h3>
            <div style={{ fontSize:12,color:'#888' }}>{table.zone} · {table.capacite} places</div>
          </div>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            <span style={{ fontSize:11,background:s.bg,color:s.color,borderRadius:10,padding:'4px 10px',fontWeight:600 }}>{s.label}</span>
            <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer' }}><X size={18}/></button>
          </div>
        </div>

        {/* Infos table occupée */}
        {commande && (
          <div style={{ background:'#F7F7F5',borderRadius:10,padding:'12px 14px',marginBottom:14 }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8 }}>
              {[
                { label:'Serveur', value:table.serveurNom || commande.serveurNom || '—' },
                { label:'Nb couverts', value:`${commande.nbCouverts || '—'} pers.` },
                { label:'Montant en cours', value:`${(commande.total||0).toLocaleString('fr')} F` },
                { label:'Heure ouverture', value:heureOuv?heureOuv.toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'}):'—' },
                { label:'Durée occupation', value:dureeMin!==null?`${dureeMin} min`:'—' },
                { label:'Articles', value:`${commande.lignes?.length||0} article(s)` },
              ].map((k,i)=>(
                <div key={i} style={{ background:'white',borderRadius:7,padding:'6px 10px' }}>
                  <div style={{ fontSize:9,color:'#888' }}>{k.label}</div>
                  <div style={{ fontSize:13,fontWeight:600,color:'#1a1a1a' }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Changer serveur inline */}
        {showChangerServeur && (
          <div style={{ background:'#EEF3FB',borderRadius:8,padding:'10px 12px',marginBottom:12 }}>
            <div style={{ fontSize:11,fontWeight:600,color:'#1a3f6f',marginBottom:8 }}>Sélectionner le nouveau serveur</div>
            <select className="input" style={{ fontSize:12,marginBottom:8 }} value={nouveauServeurId} onChange={e=>setNouveauServeurId(e.target.value)}>
              <option value="">— Choisir —</option>
              {listeServeurs.map(s=><option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>)}
            </select>
            <div style={{ display:'flex',gap:6 }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowChangerServeur(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" disabled={!nouveauServeurId||assignerMut.isPending}
                style={{ background:'#1a3f6f',border:'none' }}
                onClick={()=>{ const s=listeServeurs.find(x=>x.id===nouveauServeurId); assignerMut.mutate({ serveurId:nouveauServeurId, serveurNom:s?`${s.prenom} ${s.nom}`:null }); }}>
                {assignerMut.isPending?'...':'Confirmer'}
              </button>
            </div>
          </div>
        )}

        {/* Transférer inline */}
        {showTransferer && commande && (
          <div style={{ background:'#F7F7F5',borderRadius:8,padding:'10px 12px',marginBottom:12 }}>
            <div style={{ fontSize:11,fontWeight:600,marginBottom:8 }}>Transférer vers :</div>
            <select className="input" style={{ fontSize:12,marginBottom:8 }} value={tableCibleId} onChange={e=>setTableCibleId(e.target.value)}>
              <option value="">— Table disponible —</option>
              {tablesDisponibles.map(t=><option key={t.id} value={t.id}>Table {t.numero} — {t.zone}</option>)}
            </select>
            <div style={{ display:'flex',gap:6 }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowTransferer(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" disabled={!tableCibleId||transfererMut.isPending}
                style={{ background:'#BA7517',border:'none' }}
                onClick={()=>transfererMut.mutate({ commandeId:commande.id, tableSourceId:table.id, tableCibleId })}>
                {transfererMut.isPending?'...':'Transférer ⇒'}
              </button>
            </div>
          </div>
        )}

        {/* Boutons actions */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
          {table.statut==='LIBRE' ? (
            <button className="btn btn-primary" style={{ gridColumn:'span 2',background:'#8B1A1A',border:'none',padding:'12px' }} onClick={onCommander}>
              <Plus size={14}/> Commander
            </button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" style={{ fontSize:12 }} onClick={onCommander}>➕ Ajouter articles</button>
              <button className="btn btn-primary btn-sm" style={{ background:'#8B1A1A',border:'none',fontSize:12 }} onClick={onEncaisser}>💳 Encaisser</button>
              <button className="btn btn-ghost btn-sm" style={{ fontSize:12 }} onClick={()=>{ setShowChangerServeur(!showChangerServeur); setShowTransferer(false); }}>
                <Users size={12}/> Changer serveur
              </button>
              <button className="btn btn-ghost btn-sm" style={{ fontSize:12 }} onClick={()=>{ setShowTransferer(!showTransferer); setShowChangerServeur(false); }}>
                <ArrowRight size={12}/> Transférer
              </button>
              <button className="btn btn-ghost btn-sm" style={{ gridColumn:'span 2',fontSize:12,color:'#888' }} disabled={cloturerMut.isPending} onClick={()=>{ if(window.confirm('Clôturer et libérer la table ?')) cloturerMut.mutate(); }}>
                🧹 {cloturerMut.isPending?'...':'Clôturer & Nettoyer'}
              </button>
              {commande && (
                <button className="btn btn-ghost btn-sm" style={{ gridColumn:'span 2',fontSize:12,color:'#BA7517' }}
                  onClick={() => { onRetour(commande); }}>
                  ↩ Retour article
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Modal Retour Article ──────────────────────────────────────────────────────
function ModalRetourArticle({ commande, onClose, onSave }) {
  const [ligneId, setLigneId] = useState('');
  const [quantite, setQuantite] = useState(1);
  const [motif, setMotif] = useState('');
  const [retourStock, setRetourStock] = useState(false);
  const [saving, setSaving] = useState(false);

  const ligneChoisie = commande.lignes?.find(l => l.id === ligneId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:420 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15, color:'#BA7517' }}>↩ Retour article — {commande.numero}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label className="label">Article à retourner *</label>
            <select className="input" value={ligneId} onChange={e=>{setLigneId(e.target.value);setQuantite(1);}}>
              <option value="">— Sélectionner un article</option>
              {(commande.lignes||[]).map(l=>(
                <option key={l.id} value={l.id}>
                  {l.menu?.nom||l.menuNom||'?'} × {l.quantite} — {(l.prixUnitaire||0).toLocaleString('fr')} F/u
                </option>
              ))}
            </select>
          </div>

          {ligneChoisie && (
            <div>
              <label className="label">Quantité retournée (max: {ligneChoisie.quantite})</label>
              <input className="input" type="number" min={1} max={ligneChoisie.quantite}
                value={quantite} onChange={e=>setQuantite(Math.min(Number(e.target.value), ligneChoisie.quantite))}/>
              <div style={{ fontSize:11, color:'#8B1A1A', marginTop:4, fontWeight:600 }}>
                Montant déduit : -{(quantite * ligneChoisie.prixUnitaire).toLocaleString('fr')} F
              </div>
            </div>
          )}

          <div>
            <label className="label">Motif *</label>
            <select className="input" value={motif} onChange={e=>setMotif(e.target.value)}>
              <option value="">— Sélectionner</option>
              <option value="Erreur commande">Erreur commande</option>
              <option value="Insatisfaction client">Insatisfaction client</option>
              <option value="Article non conforme">Article non conforme</option>
              <option value="Changement d'avis">Changement d'avis</option>
              <option value="Doublon">Doublon</option>
              <option value="Autre">Autre</option>
            </select>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input type="checkbox" id="retourStock" checked={retourStock} onChange={e=>setRetourStock(e.target.checked)} style={{ width:14,height:14 }}/>
            <label htmlFor="retourStock" style={{ fontSize:12, cursor:'pointer' }}>
              Retourner en stock (article non consommé)
            </label>
          </div>

          {ligneChoisie && (
            <div style={{ background:'#FAEEDA', borderRadius:8, padding:'8px 12px', fontSize:11, color:'#412402' }}>
              ⚠ Un responsable devra valider ce retour. Le montant sera déduit immédiatement.
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" style={{ background:'#BA7517', border:'none' }}
            disabled={!ligneId||!motif||saving||!ligneChoisie}
            onClick={async ()=>{
              setSaving(true);
              await onSave({
                ligneId, menuNom: ligneChoisie.menu?.nom||'?',
                menuId: ligneChoisie.menuId,
                quantite, prixUnitaire: ligneChoisie.prixUnitaire,
                motif, retourStock,
              });
              setSaving(false);
            }}>
            {saving?'...':'↩ Enregistrer le retour'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── POS Principal ──────────────────────────────────────────────────────────
export default function POS() {
  const qc = useQueryClient();
  const [zone, setZone] = useState('Salle');
  const [panneauTable, setPanneauTable] = useState(null);
  const [commandeTable, setCommandeTable] = useState(null);
  const [paiementCommande, setPaiementCommande] = useState(null);
  const [factureDoc, setFactureDoc] = useState(null); // {numero, titre, html} après paiement
  const [retourFor, setRetourFor] = useState(null); // commande pour retour article

  const { data: tables = [] } = useQuery({ queryKey:['tables'], queryFn:yakroAPI.tables, refetchInterval:15000 });
  const { data: menu } = useQuery({ queryKey:['menu'], queryFn:()=>yakroAPI.menu({ disponible:'true' }) });
  const { data: serveursRaw } = useQuery({ queryKey:['serveurs-yakro'], queryFn:()=>employesAPI.list({ filiale:'YAKRO_GRILL', statut:'ACTIF', limit:50 }), staleTime:60000 });
  const listeServeurs = Array.isArray(serveursRaw) ? serveursRaw : (serveursRaw?.data || []);

  const [toast, setToast] = useState(null);
  const showToast = (msg,type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const createCmd = useMutation({ mutationFn:yakroAPI.createCommande, onSuccess:()=>{ qc.invalidateQueries(['tables']); setCommandeTable(null); setPanneauTable(null); showToast('Commande créée ✓'); }, onError:e=>showToast(e?.error||'Erreur','error') });
  const updateStatut = useMutation({ mutationFn:({id,statut})=>yakroAPI.updateStatut(id,statut), onSuccess:()=>{ qc.invalidateQueries(['tables']); showToast('Statut mis à jour'); } });
  const payerCmd = useMutation({
    mutationFn: ({ id, data }) => yakroAPI.payer(id, data),
    onSuccess: async (res, vars) => {
      qc.invalidateQueries(['tables']);
      setPaiementCommande(null);
      setPanneauTable(null);
      showToast('✅ Paiement OK');
      // Générer la facture automatiquement
      try {
        const facture = await yakroAPI.genererFacture(vars.id);
        if (facture?.contenuHtml) {
          setFactureDoc({ numero: facture.numero, titre: `Facture ${facture.numero}`, html: facture.contenuHtml });
        }
      } catch (e) { console.error('Facture non générée:', e.message); }
    },
    onError: e => showToast(e?.error || 'Erreur paiement', 'error'),
  });

  const tablesFiltrees = tables.filter(t=>t.zone===zone);
  const occupees = tables.filter(t=>t.statut==='OCCUPEE').length;

  const handleClickTable = (table) => setPanneauTable(table);

  const handleCommander = (table) => {
    setPanneauTable(null);
    setCommandeTable(table);
  };

  const handleEncaisser = (table) => {
    const commande = table.commandes?.[0];
    if (commande) { setPanneauTable(null); setPaiementCommande(commande); }
  };

  const handleSaveCommande = (table, data) => {
    if (table.commandeExistante) {
      const cmd = table.commandeExistante;
      const token = JSON.parse(localStorage.getItem('2ig-auth')||'{}')?.state?.token;
      fetch(`${import.meta.env.VITE_API_URL||'http://localhost:4000/api'}/yakro/commandes/${cmd.id}/ajouter-lignes`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({ lignes:data.lignes, notes:data.notes })
      }).then(r=>r.json()).then(()=>{ qc.invalidateQueries(['tables']); setCommandeTable(null); showToast('Articles ajoutés ✓'); })
        .catch(e=>showToast(e.message,'error'));
    } else {
      createCmd.mutate(data);
    }
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
        <div>
          <h1 style={{ margin:0,fontSize:20,fontFamily:'Syne',fontWeight:800 }}>🍽️ Plan de Salle</h1>
          <div style={{ fontSize:12,color:'#888',marginTop:3 }}>
            <span style={{ color:'#A32D2D',fontWeight:500 }}>{occupees}</span> table(s) occupée(s) · {tables.length-occupees} libre(s)
          </div>
        </div>
        <div style={{ display:'flex',gap:10,fontSize:11,color:'#888' }}>
          {Object.entries(STATUT_TABLE).map(([k,v])=>(
            <div key={k} style={{ display:'flex',alignItems:'center',gap:4 }}>
              <div style={{ width:10,height:10,borderRadius:2,background:v.bg,border:`1.5px solid ${v.border}` }}/>
              {v.label}
            </div>
          ))}
        </div>
      </div>

      {/* Filtres zones */}
      <div style={{ display:'flex',gap:6,marginBottom:14 }}>
        {ZONES.map(z=>(
          <button key={z} onClick={()=>setZone(z)}
            style={{ padding:'5px 16px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,fontWeight:500,background:zone===z?'#8B1A1A':'#F1EFE8',color:zone===z?'white':'#666' }}>
            {z}
          </button>
        ))}
      </div>

      {/* Grille tables */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))',gap:10 }}>
        {tablesFiltrees.map(t=>{
          const s = STATUT_TABLE[t.statut] || STATUT_TABLE.LIBRE;
          const commande = t.commandes?.[0];
          const resa = t.reservations?.[0];
          const heureOuv = t.heureOuverture ? new Date(t.heureOuverture) : null;
          const dureeMin = heureOuv ? Math.round((new Date()-heureOuv)/60000) : null;

          return (
            <div key={t.id} onClick={()=>handleClickTable(t)}
              style={{ border:`1.5px solid ${s.border}`,background:s.bg,borderRadius:12,padding:14,cursor:'pointer',minHeight:130,transition:'box-shadow 0.2s' }}
              onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'}
              onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                <div style={{ fontFamily:'Syne',fontWeight:800,fontSize:18,color:s.color }}>T{t.numero}</div>
                <span style={{ fontSize:9,fontWeight:500,color:s.color,background:s.border+'40',padding:'2px 5px',borderRadius:6 }}>{s.label}</span>
              </div>
              <div style={{ fontSize:10,color:'#888',marginBottom:6 }}>{t.zone} · {t.capacite} pl.</div>

              {commande ? (
                <div>
                  {t.serveurNom && <div style={{ fontSize:10,color:'#1a3f6f',fontWeight:500,marginBottom:2 }}>👤 {t.serveurNom}</div>}
                  <div style={{ fontSize:12,fontWeight:700,color:'#8B1A1A' }}>{(commande.total||0).toLocaleString('fr')} F</div>
                  {dureeMin !== null && <div style={{ fontSize:9,color:'#888' }}>⏱ {dureeMin} min</div>}
                  <div style={{ display:'flex',gap:3,flexWrap:'wrap',marginTop:4 }}>
                    {(commande.statut==='EN_COURS'||commande.statut==='CUISINE') && (
                      <button onClick={e=>{e.stopPropagation();setCommandeTable({...t,commandeExistante:commande});}}
                        style={{ flex:1,minWidth:40,padding:'3px 2px',fontSize:9,fontWeight:600,border:'none',borderRadius:5,background:'#EEF3FB',color:'#1a3f6f',cursor:'pointer' }}>➕</button>
                    )}
                    {commande.statut==='EN_COURS' && (
                      <button onClick={e=>{e.stopPropagation();updateStatut.mutate({id:commande.id,statut:'CUISINE'});}}
                        style={{ flex:1,minWidth:40,padding:'3px 2px',fontSize:9,fontWeight:600,border:'none',borderRadius:5,background:'#FAEEDA',color:'#412402',cursor:'pointer' }}>🍳</button>
                    )}
                    <button onClick={e=>{e.stopPropagation();setPaiementCommande(commande);}}
                      style={{ flex:1,minWidth:40,padding:'3px 2px',fontSize:9,fontWeight:700,border:'none',borderRadius:5,background:'#8B1A1A',color:'white',cursor:'pointer' }}>💳</button>
                  </div>
                </div>
              ) : resa ? (
                <div style={{ fontSize:11,color:'#BA7517' }}>
                  📅 {resa.nomClient}
                  <div style={{ fontSize:10,color:'#888' }}>{new Date(resa.dateHeure).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              ) : (
                <div style={{ fontSize:11,color:'#888',display:'flex',alignItems:'center',gap:4,marginTop:4 }}>
                  <Plus size={11}/> Nouvelle commande
                </div>
              )}
            </div>
          );
        })}
        {tablesFiltrees.length===0 && (
          <div style={{ gridColumn:'1/-1',textAlign:'center',padding:60,color:'#ccc',fontSize:13 }}>Aucune table dans cette zone</div>
        )}
      </div>

      {/* Panneau table */}
      {panneauTable && (
        <PanneauTable
          table={panneauTable}
          listeServeurs={listeServeurs}
          allTables={tables}
          qc={qc}
          onClose={()=>setPanneauTable(null)}
          onCommander={()=>handleCommander(panneauTable)}
          onEncaisser={()=>handleEncaisser(panneauTable)}
          onChanger={()=>{}}
          onRetour={(cmd)=>{ setPanneauTable(null); setRetourFor(cmd); }}
        />
      )}

      {/* Panel commande */}
      {commandeTable && menu && (
        <PanelCommande
          table={commandeTable} menu={menu} listeServeurs={listeServeurs}
          loading={createCmd.isPending}
          onClose={()=>setCommandeTable(null)}
          onSave={data=>handleSaveCommande(commandeTable, data)}
        />
      )}

      {/* Paiement */}
      {paiementCommande && (
        <ModalPaiement
          commande={paiementCommande}
          loading={payerCmd.isPending}
          onClose={()=>setPaiementCommande(null)}
          onPay={data=>payerCmd.mutate({ id:paiementCommande.id, data })}
        />
      )}

      {toast && (
        <div style={{ position:'fixed',bottom:20,right:16,background:toast.type==='error'?'#A32D2D':'#27500A',color:'white',padding:'10px 18px',borderRadius:10,fontSize:13,zIndex:9999 }}>
          {toast.msg}
        </div>
      )}

      {/* Visionneuse facture après encaissement */}
      {factureDoc && (
        <DocumentViewer
          document={factureDoc}
          onClose={() => setFactureDoc(null)}
        />
      )}

      {/* Modal retour article */}
      {retourFor && (
        <ModalRetourArticle
          commande={retourFor}
          onClose={() => setRetourFor(null)}
          onSave={async (data) => {
            try {
              await yakroAPI.creerRetour({ commandeId: retourFor.id, ...data });
              qc.invalidateQueries(['tables']);
              setRetourFor(null);
              showToast(`Retour enregistré — -${(data.quantite * data.prixUnitaire).toLocaleString('fr')} F`);
            } catch (e) { showToast(e?.response?.data?.error || 'Erreur retour', 'error'); }
          }}
        />
      )}
    </div>
  );
}
