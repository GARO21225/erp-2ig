/**
 * YAKRO GRILL — Plan de Salle (POS)
 * Assignation serveur obligatoire, panneau table complet, transfert, clôture
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exportTicketYakro } from '../../lib/export';
import { yakroAPI, employesAPI } from '../../lib/api';
import DocumentViewer from '../../components/ui/DocumentViewer';
import { useYakro } from '../../lib/useYakro';
import { Plus, X, Minus, ShoppingBag, Banknote, Smartphone, CreditCard, CheckCircle, Users, RefreshCw, ArrowRight, Search } from 'lucide-react';

const STATUT_TABLE = {
  LIBRE:    { label:'Libre',     color:'#639922', bg:'#F4FAE8', border:'#C0DD97' },
  OCCUPEE:  { label:'Occupée',   color:'#A32D2D', bg:'#FEF6F6', border:'#F7C1C1' },
  RESERVEE: { label:'Réservée',  color:'#BA7517', bg:'#FEFAF0', border:'#FAC775' },
  NETTOYAGE:{ label:'Nettoyage', color:'#1a3f6f', bg:'#EEF3FB', border:'#B5D4F4' },
};
const MOYENS_PMT = [
  { key:'ESPECES',      label:'Espèces',      icon:Banknote,   color:'#27500A' },
  { key:'ORANGE_MONEY', label:'Orange Money', icon:Smartphone, color:'#E87722' },
  { key:'MTN_MONEY',    label:'MTN Money',    icon:Smartphone, color:'#FFCC00', textColor:'#1a1a1a' },
  { key:'MOOV_MONEY',   label:'Moov Money',   icon:Smartphone, color:'#0066CC' },
  { key:'WAVE',         label:'Wave',         icon:Smartphone, color:'#1A73E8' },
  { key:'BANQUE',       label:'Banque/TPE',   icon:CreditCard, color:'#5F5E5A' },
];

const MODE_PARAM = { ESPECES:'paiement_especes', ORANGE_MONEY:'paiement_om', MTN_MONEY:'paiement_mtn', MOOV_MONEY:'paiement_moov', WAVE:'paiement_wave', BANQUE:'paiement_banque' };

// ─── Panel commande ────────────────────────────────────────────────────────────
function PanelCommande({ table, menu, onClose, onSave, loading, listeServeurs }) {
  const [lignes, setLignes] = useState([]);
  const [notes, setNotes] = useState('');
  const [nbCouverts, setNbCouverts] = useState(table?.capacite || 2);
  const [cat, setCat] = useState(Object.keys(menu?.grouped || {})[0] || '');
  const [searchMenu, setSearchMenu] = useState('');
  const [serveurId, setServeurId] = useState(table?.serveurId || '');
  const [recapOuvert, setRecapOuvert] = useState(false); // phone : feuille du panier

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { recapOuvert ? setRecapOuvert(false) : onClose(); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [recapOuvert, onClose]);

  const addArticle = (item) => setLignes(prev => {
    const ex = prev.find(l => l.menuId === item.id);
    if (ex) return prev.map(l => l.menuId===item.id ? {...l,quantite:l.quantite+1} : l);
    return [...prev, { menuId:item.id, nom:item.nom, prixUnitaire:item.prix, quantite:1 }];
  });
  const removeArticle = (menuId) => setLignes(prev =>
    prev.map(l => l.menuId===menuId ? {...l,quantite:Math.max(0,l.quantite-1)} : l).filter(l=>l.quantite>0)
  );
  const total = lignes.reduce((s,l)=>s+l.prixUnitaire*l.quantite,0);
  const nbArticles = lignes.reduce((s,l)=>s+l.quantite,0);
  const grouped = menu?.grouped || {};
  const cats = Object.keys(grouped);
  const serveurChoisi = listeServeurs.find(s=>s.id===serveurId);
  const serveurManquant = !serveurId && !table?.commandeExistante;
  const bloque = lignes.length===0 || serveurManquant || loading;
  const articles = (searchMenu
    ? Object.values(grouped).flat().filter(item=>item.disponible && item.nom.toLowerCase().includes(searchMenu.toLowerCase()))
    : (grouped[cat]||[]).filter(item=>item.disponible));

  return (
    <div className="yk-order" role="dialog" aria-modal="true" aria-label={`Commande table ${table?.numero}`}>
      <div className="yk-order-menu">
        <div className="yk-order-bar">
          <button className="yk-iconbtn" onClick={onClose} aria-label="Fermer la commande"><X size={20}/></button>
          <div style={{ minWidth:0 }}>
            <h2>Table {table?.numero}</h2>
            <p>{table?.commandeExistante ? 'Ajouter des articles' : 'Nouvelle commande'} · {table?.zone} · {table?.capacite} places</p>
          </div>
        </div>

        <div className="yk-order-opts">
          {!table?.commandeExistante && (
            <select value={serveurId} onChange={e=>setServeurId(e.target.value)} data-missing={!serveurId || undefined} aria-label="Serveur assigné">
              <option value="">Serveur assigné (obligatoire)</option>
              {listeServeurs.map(s=>(<option key={s.id} value={s.id}>{s.prenom} {s.nom} — {s.poste}</option>))}
            </select>
          )}
          <div className="yk-stepper" role="group" aria-label="Couverts">
            <button onClick={()=>setNbCouverts(v=>Math.max(1,v-1))} aria-label="Moins de couverts"><Minus size={16}/></button>
            <output aria-live="polite">{nbCouverts}</output>
            <button onClick={()=>setNbCouverts(v=>v+1)} aria-label="Plus de couverts"><Plus size={16}/></button>
            <span style={{ fontSize:12, color:'var(--yk-ink-2)', marginLeft:2 }}>couverts</span>
          </div>
        </div>

        <div className="yk-order-cats">
          <div className="yk-toolbar" style={{ marginBottom:0 }}>
            <label className="yk-search">
              <Search size={16}/>
              <input type="search" value={searchMenu} onChange={e=>setSearchMenu(e.target.value)} placeholder="Chercher un article" aria-label="Chercher un article"/>
            </label>
            {!searchMenu && (
              <div className="yk-chips" role="tablist" aria-label="Catégories">
                {cats.map(c=>(
                  <button key={c} className="yk-chip" aria-pressed={cat===c} onClick={()=>setCat(c)} style={{ textTransform:'capitalize' }}>{c.replace(/_/g,' ').toLowerCase()}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="yk-items">
          {articles.map(item=>{
            const inLignes = lignes.find(l=>l.menuId===item.id);
            return (
              <button key={item.id} type="button" className="yk-item" data-in={inLignes || undefined} onClick={()=>addArticle(item)}>
                <span className="yk-item-name">{item.nom}</span>
                <span className="yk-item-foot">
                  <span className="yk-price">{item.prix.toLocaleString('fr')} F</span>
                  {inLignes && <span className="yk-item-qty">×{inLignes.quantite}</span>}
                </span>
              </button>
            );
          })}
          {articles.length===0 && <div className="yk-recap-empty" style={{ gridColumn:'1/-1' }}>Aucun article disponible</div>}
        </div>
      </div>

      {recapOuvert && <div className="yk-sheet-scrim" onClick={()=>setRecapOuvert(false)}/>}
      <button className="yk-cartbar" data-vide={nbArticles===0 || undefined} onClick={()=>setRecapOuvert(true)} aria-label="Ouvrir le récapitulatif">
        <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}><ShoppingBag size={20}/> {nbArticles} article{nbArticles>1?'s':''}</span>
        <b>{total.toLocaleString('fr')} F</b>
      </button>

      <aside className="yk-recap" data-open={recapOuvert} aria-label="Récapitulatif">
        <div className="yk-recap-head">
          <h3>Récapitulatif</h3>
          <button className="yk-iconbtn" data-light onClick={()=>setRecapOuvert(false)} aria-label="Fermer le récapitulatif" style={{ width:40, height:40 }}><X size={18}/></button>
        </div>
        <div className="yk-recap-lines">
          {lignes.length === 0 ? (
            <div className="yk-recap-empty"><ShoppingBag size={32}/>Touchez un article pour l'ajouter</div>
          ) : lignes.map(l=>(
            <div key={l.menuId} className="yk-line">
              <div>
                <div className="yk-line-name">{l.nom}</div>
                <div className="yk-line-unit">{l.prixUnitaire.toLocaleString('fr')} F</div>
              </div>
              <div className="yk-line-total">{(l.prixUnitaire*l.quantite).toLocaleString('fr')} F</div>
              <div className="yk-stepper" data-sm style={{ gridColumn:'1/-1' }}>
                <button onClick={()=>removeArticle(l.menuId)} aria-label={`Retirer ${l.nom}`}><Minus size={14}/></button>
                <output>{l.quantite}</output>
                <button onClick={()=>addArticle({id:l.menuId,nom:l.nom,prix:l.prixUnitaire})} aria-label={`Ajouter ${l.nom}`}><Plus size={14}/></button>
              </div>
            </div>
          ))}
        </div>
        <div className="yk-recap-foot">
          <input placeholder="Notes de commande…" value={notes} onChange={e=>setNotes(e.target.value)} aria-label="Notes de commande"/>
          <div className="yk-total"><span>Total</span><b>{total.toLocaleString('fr')} F</b></div>
          <button className="yk-cta" disabled={bloque}
            onClick={()=>{
              const servNom = serveurChoisi ? `${serveurChoisi.prenom} ${serveurChoisi.nom}` : null;
              onSave({ tableId:table.id, lignes, notes, nbCouverts, serveurId:serveurId||null, serveurNom:servNom });
            }}>
            {loading ? 'Envoi…' : '🍳 Envoyer en cuisine'}
          </button>
          {serveurManquant && <p className="yk-hint" role="alert">Choisissez un serveur pour continuer</p>}
        </div>
      </aside>
    </div>
  );
}

// ─── Modal paiement ─────────────────────────────────────────────────────────
const QR_PARAM = { ORANGE_MONEY:'qr_om', WAVE:'qr_wave', MTN_MONEY:'qr_mtn', MOOV_MONEY:'qr_moov' };
const NUM_PARAM = { ORANGE_MONEY:'numero_om', WAVE:'numero_wave', MTN_MONEY:'numero_mtn' };

function ModalPaiement({ commande, loading, onClose, onPay, modes, params = {} }) {
  // Seuls les modes acceptés par le restaurant sont proposés
  const moyens = modes?.length ? MOYENS_PMT.filter(m=>modes.includes(m.key)) : MOYENS_PMT;
  const total = commande.total || 0;
  const [lignesPmt, setLignesPmt] = useState([{ typePaiement:moyens[0].key, montant:total, reference:'', recu:'' }]);
  const totalSaisi = lignesPmt.reduce((s,l)=>s+Number(l.montant||0),0);
  const resteASaisir = total - totalSaisi;
  // Paiement mixte : la monnaie ne concerne que la part payée en espèces
  const partEspeces = lignesPmt.filter(l=>l.typePaiement==='ESPECES').reduce((s,l)=>s+Number(l.montant||0),0);
  const recu = Number(lignesPmt.find(l=>l.typePaiement==='ESPECES')?.recu) || 0;
  const monnaieRendue = partEspeces>0 && recu>partEspeces ? recu-partEspeces : 0;
  const recuInsuffisant = partEspeces>0 && recu>0 && recu<partEspeces;
  const canPay = Math.abs(resteASaisir) < 2 && !recuInsuffisant && lignesPmt.every(l=>Number(l.montant)>0);

  const addLigne = () => {
    const libre = moyens.find(m=>!lignesPmt.some(l=>l.typePaiement===m.key)) || moyens[0];
    setLignesPmt(prev=>[...prev,{typePaiement:libre.key,montant:Math.max(0,resteASaisir).toFixed(0),reference:'',recu:''}]);
  };
  const removeLigne = (i) => setLignesPmt(prev=>prev.filter((_,idx)=>idx!==i));
  const updateLigne = (i,field,value) => setLignesPmt(prev=>prev.map((l,idx)=>idx===i?{...l,[field]:value}:l));
  const completer = (i) => setLignesPmt(prev=>{
    const autres = prev.reduce((s,l,idx)=>idx===i?s:s+Number(l.montant||0),0);
    return prev.map((l,idx)=>idx===i?{...l,montant:String(Math.max(0,total-autres))}:l);
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:460 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <h3 style={{ margin:0,fontFamily:'Syne',fontSize:16 }}>Paiement — {commande.numero}</h3>
          <button onClick={onClose} aria-label="Fermer" style={{ background:'none',border:'none',cursor:'pointer',padding:8 }}><X size={18}/></button>
        </div>
        <div style={{ background:'#FDF2F2',borderRadius:10,padding:14,textAlign:'center',marginBottom:16 }}>
          <div style={{ fontSize:11,color:'#888' }}>Total à encaisser</div>
          <div style={{ fontFamily:'Syne',fontWeight:800,fontSize:30,color:'#8B1A1A' }}>{total.toLocaleString('fr')} F</div>
        </div>
        {lignesPmt.map((ligne,i)=>{
          const moyen = MOYENS_PMT.find(m=>m.key===ligne.typePaiement);
          const needRef = ligne.typePaiement !== 'ESPECES';
          const qr = params[QR_PARAM[ligne.typePaiement]];
          const numero = params[NUM_PARAM[ligne.typePaiement]];
          return (
            <div key={i} style={{ background:'#F7F7F5',borderRadius:10,padding:12,marginBottom:8 }}>
              <div style={{ display:'flex',gap:8,marginBottom:8 }}>
                <select className="input" style={{ flex:2,fontSize:14 }} value={ligne.typePaiement} aria-label="Mode de paiement" onChange={e=>updateLigne(i,'typePaiement',e.target.value)}>
                  {moyens.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                <input className="input" style={{ flex:1,fontSize:14,fontWeight:600,minWidth:0 }} type="number" inputMode="numeric"
                  value={ligne.montant} onChange={e=>updateLigne(i,'montant',e.target.value)} placeholder="Montant" aria-label="Montant"/>
                {lignesPmt.length>1 && <button onClick={()=>removeLigne(i)} aria-label="Retirer ce paiement" style={{ background:'#FCEBEB',border:'none',borderRadius:6,padding:'0 12px',cursor:'pointer',color:'#A32D2D' }}><X size={14}/></button>}
              </div>
              {lignesPmt.length>1 && resteASaisir!==0 && (
                <button type="button" onClick={()=>completer(i)} style={{ fontSize:11,background:'none',border:'none',color:'#8B1A1A',cursor:'pointer',padding:'0 0 8px',textDecoration:'underline' }}>Mettre le solde ici</button>
              )}
              {needRef && qr && (
                <div style={{ textAlign:'center',background:'white',borderRadius:10,padding:10,marginBottom:8 }}>
                  <img src={qr} alt={`QR code ${moyen?.label}`} style={{ width:'100%',maxWidth:220,aspectRatio:'1',objectFit:'contain' }}/>
                  <div style={{ fontSize:12,fontWeight:600,marginTop:4 }}>Le client scanne et paie {Number(ligne.montant||0).toLocaleString('fr')} F</div>
                  {numero && <div style={{ fontSize:11,color:'#888' }}>ou envoie au {numero}</div>}
                </div>
              )}
              {needRef && !qr && numero && <div style={{ fontSize:12,marginBottom:8,color:'#555' }}>Numéro {moyen?.label} : <b>{numero}</b></div>}
              {needRef && <div style={{ fontSize:11,color:'#888',marginBottom:6 }}>Vérifiez la notification de paiement reçue sur le téléphone du restaurant, puis encaissez. La référence est facultative.</div>}
              {needRef && <input className="input" style={{ fontSize:14 }} placeholder={`Réf. ${moyen?.label} (facultatif)`} value={ligne.reference} onChange={e=>updateLigne(i,'reference',e.target.value)}/>}
              {ligne.typePaiement==='ESPECES' && (
                <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                  <input className="input" style={{ fontSize:14 }} type="number" inputMode="numeric" placeholder="Espèces remises par le client" value={ligne.recu} onChange={e=>updateLigne(i,'recu',e.target.value)}/>
                  {recu>partEspeces && <div style={{ fontSize:13,fontWeight:700,color:'#27500A',whiteSpace:'nowrap' }}>Rendre {monnaieRendue.toLocaleString('fr')} F</div>}
                </div>
              )}
            </div>
          );
        })}
        {recuInsuffisant && <div role="alert" style={{ fontSize:12,color:'#A32D2D',marginBottom:8 }}>Les espèces remises sont inférieures à la part en espèces ({partEspeces.toLocaleString('fr')} F)</div>}
        {Math.abs(resteASaisir)>=2 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12,color:'#A32D2D',marginBottom:6,fontWeight:500 }}>{resteASaisir>0?`Reste : ${resteASaisir.toLocaleString('fr')} F`:`Trop-perçu : ${(-resteASaisir).toLocaleString('fr')} F — ajustez les montants`}</div>
            {resteASaisir>0 && moyens.length>1 && <button onClick={addLigne} style={{ fontSize:13,border:'1px dashed #d3d1c7',background:'white',borderRadius:8,padding:'10px 14px',cursor:'pointer',color:'#666',width:'100%' }}>+ Paiement mixte : autre moyen pour le reste</button>}
          </div>
        )}
        {canPay && <div style={{ background:'#EAF3DE',borderRadius:8,padding:'8px 12px',marginBottom:12,display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#27500A' }}><CheckCircle size={14}/> Prêt à encaisser{monnaieRendue>0?` · rendre ${monnaieRendue.toLocaleString('fr')} F`:''}</div>}
        <button disabled={!canPay||loading} onClick={()=>onPay({ paiements:lignesPmt.map(({recu,...p})=>({...p,montant:Number(p.montant)})), especesRecues:recu })}
          style={{ width:'100%',padding:14,background:canPay?'#8B1A1A':'#ddd',color:'white',border:'none',borderRadius:10,fontFamily:'Syne',fontWeight:700,fontSize:15,cursor:canPay?'pointer':'not-allowed' }}>
          {loading?'Traitement...':`Encaisser ${total.toLocaleString('fr')} F`}
        </button>
      </div>
    </div>
  );
}

// ─── Modal panneau table (détail) ───────────────────────────────────────────
function PanneauTable({ table, listeServeurs, allTables, onClose, onCommander, onEncaisser, onChanger, onRetour, qc }) {
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
  const { courant } = useYakro();
  const { data: paramsResto } = useQuery({ queryKey:['yakro-params', courant?.id], queryFn:()=>yakroAPI.parametres(courant.id), enabled:!!courant, staleTime:60000 });
  const modesAcceptes = paramsResto ? MOYENS_PMT.filter(m=>paramsResto[MODE_PARAM[m.key]]==='1').map(m=>m.key) : null;
  const [zone, setZone] = useState('TOUTES');
  const [filtreServeur, setFiltreServeur] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [panneauTable, setPanneauTable] = useState(null);
  const [commandeTable, setCommandeTable] = useState(null);
  const [paiementCommande, setPaiementCommande] = useState(null);
  const [factureDoc, setFactureDoc] = useState(null); // {numero, titre, html} après paiement
  const [retourFor, setRetourFor] = useState(null); // commande pour retour article

  const { data: tables = [] } = useQuery({ queryKey:['tables'], queryFn:yakroAPI.tables, refetchInterval:15000 });
  const { data: menu } = useQuery({ queryKey:['menu', courant?.id], queryFn:()=>yakroAPI.menu({ disponible:'true' }) });
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

  // Afficher toutes les tables groupées par zone, avec filtre optionnel
  const zonesDisponibles = [...new Set(tables.map(t=>t.zone).filter(Boolean))].sort();
  const [searchTable, setSearchTable] = useState('');
  const tablesFiltrees = tables.filter(t => {
    const matchZone = zone === 'TOUTES' ? true : t.zone === zone;
    const matchSearch = !searchTable || String(t.numero).includes(searchTable);
    const commande = t.commandes?.[0];
    const matchServeur = !filtreServeur || commande?.serveurNom === filtreServeur;
    const matchStatut = !filtreStatut ? true :
      filtreStatut === 'LIBRE' ? !commande || commande.statut === 'PAYEE' :
      filtreStatut === 'OCCUPEE' ? commande && commande.statut !== 'PAYEE' :
      commande?.statut === filtreStatut;
    return matchZone && matchSearch && matchServeur && matchStatut;
  });
  const tablesParZone = zonesDisponibles.reduce((acc, z) => {
    acc[z] = tablesFiltrees.filter(t => t.zone === z);
    return acc;
  }, {});
  const occupees = tables.filter(t=>t.statut==='OCCUPEE').length;

  const handleClickTable = (table) => setPanneauTable(table);

  const handleCommander = (table) => {
    setPanneauTable(null);
    // Si la table a déjà une commande ouverte → mode ajout (pas de serveur requis)
    const commandeOuverte = table.commandes?.find(
      cmd => cmd.statut === 'EN_COURS' || cmd.statut === 'CUISINE' || cmd.statut === 'PRETE'
    );
    if (commandeOuverte) {
      setCommandeTable({ ...table, commandeExistante: commandeOuverte });
    } else {
      setCommandeTable(table);
    }
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
      {/* En-tête */}
      <div className="yk-head">
        <div>
          <h1 className="yk-title">Plan de salle</h1>
          <div className="yk-sub">{courant?.nom ? `${courant.nom} · ` : ''}mis à jour en direct</div>
        </div>
        <div className="yk-stats" aria-label="Résumé des tables">
          <div className="yk-stat" style={{ '--c':'var(--yk-ember)' }}><b>{occupees}</b><span>occupée{occupees>1?'s':''}</span></div>
          <div className="yk-stat" style={{ '--c':'var(--yk-leaf)' }}><b>{tables.length-occupees}</b><span>libre{tables.length-occupees>1?'s':''}</span></div>
        </div>
      </div>

      {/* Filtres */}
      <div className="yk-toolbar">
        <label className="yk-search">
          <Search size={16}/>
          <input type="search" inputMode="numeric" value={searchTable} onChange={e=>setSearchTable(e.target.value)} placeholder="N° de table" aria-label="Rechercher une table"/>
        </label>
        <div className="yk-chips" aria-label="Filtres">
          <button className="yk-chip" aria-pressed={zone==='TOUTES' && !filtreStatut} onClick={()=>{setZone('TOUTES');setFiltreStatut('');}}>Toutes<small>{tables.length}</small></button>
          {zonesDisponibles.map(z=>(
            <button key={z} className="yk-chip" aria-pressed={zone===z} onClick={()=>setZone(zone===z?'TOUTES':z)}>{z}<small>{tables.filter(t=>t.zone===z).length}</small></button>
          ))}
          {[['LIBRE','Libres'],['OCCUPEE','Occupées']].map(([v,l])=>(
            <button key={v} className="yk-chip" aria-pressed={filtreStatut===v} onClick={()=>setFiltreStatut(v===filtreStatut?'':v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Grille tables */}
      <div className="yk-tables">
        {tablesFiltrees.map(t=>{
          const s = STATUT_TABLE[t.statut] || STATUT_TABLE.LIBRE;
          const commande = t.commandes?.[0];
          const resa = t.reservations?.[0];
          const heureOuv = t.heureOuverture ? new Date(t.heureOuverture) : null;
          const dureeMin = heureOuv ? Math.round((new Date()-heureOuv)/60000) : null;
          const enCours = commande && (commande.statut==='EN_COURS'||commande.statut==='CUISINE');

          return (
            <div key={t.id} className="yk-table" data-s={t.statut} role="button" tabIndex={0}
              aria-label={`Table ${t.numero}, ${s.label}`}
              onClick={()=>handleClickTable(t)}
              onKeyDown={e=>{ if(e.target===e.currentTarget && (e.key==='Enter'||e.key===' ')){ e.preventDefault(); handleClickTable(t); } }}>
              <div className="yk-table-top">
                <span className="yk-table-num">{t.numero}</span>
                <span className="yk-pill">{s.label}</span>
              </div>
              <div className="yk-table-meta">{t.zone} · {t.capacite} places</div>

              {commande ? (
                <>
                  <div>
                    <div className="yk-table-total">{(commande.total||0).toLocaleString('fr')} F</div>
                    <div className="yk-table-meta">{[t.serveurNom, dureeMin!==null && `${dureeMin} min`].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="yk-table-actions">
                    {enCours && <button className="yk-mini" aria-label="Ajouter des articles" onClick={e=>{e.stopPropagation();setCommandeTable({...t,commandeExistante:commande});}}><Plus size={16}/></button>}
                    {enCours && <button className="yk-mini" data-ok aria-label="Marquer prête" onClick={e=>{e.stopPropagation();updateStatut.mutate({id:commande.id,statut:'PRETE'});}}><CheckCircle size={16}/></button>}
                    <button className="yk-mini" data-primary aria-label="Encaisser" onClick={e=>{e.stopPropagation();setPaiementCommande(commande);}}><Banknote size={16}/></button>
                  </div>
                </>
              ) : resa ? (
                <div className="yk-table-meta" style={{ color:'var(--yk-gold)', fontWeight:600 }}>
                  {resa.nomClient} · {new Date(resa.dateHeure).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})}
                </div>
              ) : (
                <div className="yk-table-free"><Plus size={14}/> Nouvelle commande</div>
              )}
            </div>
          );
        })}
        {tablesFiltrees.length===0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:60, color:'var(--yk-ink-3)', fontSize:13 }}>Aucune table ne correspond</div>
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
          modes={modesAcceptes}
          params={paramsResto || {}}
          loading={payerCmd.isPending}
          onClose={()=>setPaiementCommande(null)}
          onPay={data=>payerCmd.mutate({ id:paiementCommande.id, data })}
        />
      )}

      {toast && (
        <div className="yk-toast" data-error={toast.type==='error' || undefined} role="status" aria-live="polite">{toast.msg}</div>
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
              const tableId = retourFor.tableId;
              await yakroAPI.creerRetour({ commandeId: retourFor.id, ...data });
              // Forcer le rechargement complet des tables
              await qc.refetchQueries({ queryKey: ['tables'] });
              setRetourFor(null);
              // Ré-ouvrir le panneau de la table avec les données fraîches
              const tablesUpdated = qc.getQueryData(['tables']);
              if (tableId && Array.isArray(tablesUpdated)) {
                const tableActuelle = tablesUpdated.find(t => t.id === tableId);
                if (tableActuelle) setPanneauTable(tableActuelle);
              }
              showToast(`Retour enregistré — -${(data.quantite * data.prixUnitaire).toLocaleString('fr')} F`);
            } catch (e) { showToast(e?.response?.data?.error || 'Erreur retour', 'error'); }
          }}
        />
      )}
    </div>
  );
}
