/**
 * Fiche Prospect Complète — Vue 360°
 * Infos · Réservations · Paiements · Relances · Rapport
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI, facturationAPI } from '../../lib/api';
import { ChevronLeft, Phone, MessageSquare, Plus, X, FileText } from 'lucide-react';
import DocumentViewer from '../../components/ui/DocumentViewer';

const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(2)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${Math.round(n||0)} F`;
const fmtD = d => d ? new Date(d).toLocaleDateString('fr',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtDH = d => d ? new Date(d).toLocaleString('fr',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';

const CANAL_ICON = { appel:'📞', whatsapp:'💬', sms:'📱', email:'📧', visite:'🤝', recommandation:'⭐' };
const RESULTAT_COLOR = { interesse:'#1a3f6f', pas_interesse:'#888', rappeler:'#BA7517', converti:'#27500A', perdu:'#A32D2D' };

export default function ProspectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [onglet, setOnglet] = useState('profil');
  const [showRelance, setShowRelance] = useState(false);
  const [showConvertir, setShowConvertir] = useState(null); // réservation choisie
  const [showPaiement, setShowPaiement] = useState(null); // vente choisie
  const [docViewer, setDocViewer] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg,t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3000); };

  const { data: p, isLoading } = useQuery({
    queryKey: ['prospect', id],
    queryFn: () => toptelsigAPI.crmProspect(id),
    staleTime: 10000,
  });

  const addRelanceMut = useMutation({
    mutationFn: data => toptelsigAPI.crmAddRelance(id, data),
    onSuccess: () => { qc.invalidateQueries(['prospect',id]); setShowRelance(false); showToast('Relance enregistrée ✓'); },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const convertirMut = useMutation({
    mutationFn: toptelsigAPI.crmConvertir,
    onSuccess: () => {
      qc.invalidateQueries(['prospect',id]);
      qc.invalidateQueries(['souscripteurs']);
      setShowConvertir(null);
      showToast('🎉 Converti en souscripteur !');
    },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const paiementMut = useMutation({
    mutationFn: ({ venteId, data }) => toptelsigAPI.addPaiement(p.id, { ...data, venteId }),
    onSuccess: () => { qc.invalidateQueries(['prospect',id]); setShowPaiement(null); showToast('Paiement enregistré ✓'); },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  if (isLoading) return <div style={{padding:40,textAlign:'center',color:'#888'}}>Chargement...</div>;
  if (!p) return <div style={{padding:40,textAlign:'center',color:'#A32D2D'}}>Contact introuvable</div>;

  const tel = (p.telephone||'').replace(/[\s\-+]/g,'').replace(/^0/,'225');
  const totalPaye = p.ventes?.reduce((s,v)=>s+v.paiements.reduce((s2,pm)=>s2+pm.montant,0),0) || 0;
  const totalDu = p.ventes?.reduce((s,v)=>s+(v.prixVente||0),0) || 0;
  const reservationsActives = p.reservations?.filter(r=>r.statut==='ACTIVE') || [];
  const nbRelances = p.relances?.length || 0;

  return (
    <div className="page-enter">
      {/* Bouton retour */}
      <button onClick={()=>navigate('/toptelsig/prospects')}
        style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:'#888',fontSize:13,marginBottom:16,padding:0}}>
        <ChevronLeft size={16}/> Retour CRM
      </button>

      {/* Header prospect */}
      <div style={{background:'white',border:'0.5px solid #e8e7e1',borderRadius:12,padding:'20px 24px',marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{margin:0,fontFamily:'Syne',fontWeight:800,fontSize:24}}>{p.prenom} {p.nom}</h1>
            <div style={{display:'flex',gap:10,alignItems:'center',marginTop:6,flexWrap:'wrap'}}>
              <span style={{fontSize:12,color:'#888'}}>{p.code}</span>
              <span style={{fontSize:11,background:
                p.statut==='CLIENT'?'#EAF3DE':p.statut==='RESERVE'?'#EEF3FB':
                p.statut==='PERDU'?'#FCEBEB':'#F7F7F5',
                color:p.statut==='CLIENT'?'#27500A':p.statut==='RESERVE'?'#1a3f6f':
                p.statut==='PERDU'?'#A32D2D':'#888',
                borderRadius:10,padding:'2px 10px',fontWeight:600}}>
                {p.statut}
              </span>
              {p.profession && <span style={{fontSize:12,color:'#888'}}>{p.profession}</span>}
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <a href={`tel:${p.telephone}`}
              style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:8,background:'#EAF3DE',color:'#27500A',textDecoration:'none',fontSize:12,fontWeight:600}}>
              <Phone size={13}/> {p.telephone}
            </a>
            <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer"
              style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:8,background:'#E8F9EF',color:'#25D366',textDecoration:'none',fontSize:12,fontWeight:600}}>
              <MessageSquare size={13}/> WhatsApp
            </a>
            <button onClick={()=>setShowRelance(true)}
              style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:8,background:'#1a3f6f',color:'white',border:'none',cursor:'pointer',fontSize:12,fontWeight:600}}>
              <Plus size={13}/> Relance
            </button>
          </div>
        </div>

        {/* Stats rapides */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginTop:16}}>
          {[
            {label:'Relances',value:nbRelances,color:'#1a3f6f'},
            {label:'Réservations actives',value:reservationsActives.length,color:'#27500A'},
            {label:'Total payé',value:fmtF(totalPaye),color:'#27500A'},
            {label:'Reste à payer',value:fmtF(totalDu-totalPaye),color:totalDu-totalPaye>0?'#A32D2D':'#27500A'},
          ].map((k,i)=>(
            <div key={i} style={{background:'#F7F7F5',borderRadius:8,padding:'10px 14px',borderTop:`3px solid ${k.color}`}}>
              <div style={{fontSize:10,color:'#888',marginBottom:2}}>{k.label}</div>
              <div style={{fontFamily:'Syne',fontWeight:800,fontSize:18,color:k.color}}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Onglets */}
      <div style={{display:'flex',gap:2,borderBottom:'1px solid #e8e7e1',marginBottom:20}}>
        {[
          ['profil','👤 Profil'],
          ['reservations','🏘 Réservations & Lots'],
          ['paiements','💳 Paiements'],
          ['relances','📞 Historique relances'],
          ['rapport','📊 Rapport'],
        ].map(([k,v])=>(
          <button key={k} onClick={()=>setOnglet(k)}
            style={{padding:'8px 16px',border:'none',background:'none',cursor:'pointer',fontSize:12,
              fontWeight:onglet===k?600:400,color:onglet===k?'#1a3f6f':'#888',
              borderBottom:onglet===k?'2px solid #1a3f6f':'2px solid transparent'}}>
            {v}
          </button>
        ))}
      </div>

      {/* ── Profil ── */}
      {onglet==='profil' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div className="card">
            <div style={{fontFamily:'Syne',fontWeight:700,fontSize:14,marginBottom:12,color:'#1a3f6f'}}>Informations personnelles</div>
            {[
              ['Téléphone',p.telephone],['Email',p.email||'—'],
              ['Adresse',p.adresse||'—'],['Profession',p.profession||'—'],
              ['N° CNI',p.numeroCni||'—'],['Source',p.sourceAcquisition||'—'],
              ['Commercial',p.commercialNom||'—'],['Date création',fmtD(p.createdAt)],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid #f0efe9',fontSize:13}}>
                <span style={{color:'#888'}}>{k}</span><strong>{v}</strong>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{fontFamily:'Syne',fontWeight:700,fontSize:14,marginBottom:12,color:'#1a3f6f'}}>Engagement par projet</div>
            {p.ventes?.length === 0 && reservationsActives.length === 0 && (
              <div style={{color:'#ccc',fontSize:13,textAlign:'center',padding:20}}>Aucun engagement</div>
            )}
            {reservationsActives.map(r=>(
              <div key={r.id} style={{background:'#EEF3FB',borderRadius:8,padding:'10px 12px',marginBottom:8}}>
                <div style={{fontWeight:600,fontSize:13}}>🏘 Lot {r.lot?.numero} — {r.lot?.projet?.nom}</div>
                <div style={{fontSize:11,color:'#888',marginTop:2}}>
                  {r.lot?.projet?.ville||''} · Réservé le {fmtD(r.dateReservation||r.createdAt)}
                </div>
                <div style={{fontSize:11,color:'#888'}}>Prix : {fmtF(r.lot?.prix||0)} · Superficie : {(r.lot?.superficie||0).toLocaleString('fr')} m²</div>
                <div style={{display:'flex',gap:6,marginTop:8}}>
                  <button onClick={()=>setShowConvertir(r)}
                    style={{padding:'4px 12px',borderRadius:6,background:'#27500A',color:'white',border:'none',cursor:'pointer',fontSize:11,fontWeight:600}}>
                    🎉 Convertir → Souscripteur
                  </button>
                </div>
              </div>
            ))}
            {p.ventes?.map(v=>(
              <div key={v.id} style={{background:'#EAF3DE',borderRadius:8,padding:'10px 12px',marginBottom:8}}>
                <div style={{fontWeight:600,fontSize:13}}>✅ Lot {v.lot?.numero} — {v.lot?.projet?.nom}</div>
                <div style={{fontSize:11,color:'#888',marginTop:2}}>Prix : {fmtF(v.prixVente)}</div>
                <div style={{fontSize:11,color:'#27500A',fontWeight:600}}>
                  Payé : {fmtF(v.paiements.reduce((s,pm)=>s+pm.montant,0))} / {fmtF(v.prixVente)}
                </div>
                <button onClick={()=>setShowPaiement(v)}
                  style={{padding:'4px 12px',borderRadius:6,background:'#1a3f6f',color:'white',border:'none',cursor:'pointer',fontSize:11,fontWeight:600,marginTop:8}}>
                  + Ajouter un paiement
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Réservations & Lots ── */}
      {onglet==='reservations' && (
        <div>
          {reservationsActives.length === 0 && p.ventes?.length === 0 && (
            <div className="empty-state"><p>Aucune réservation ni vente</p>
              <p style={{fontSize:11,color:'#aaa'}}>Proposez un lot depuis le CRM avec le bouton 🏘</p>
            </div>
          )}
          {reservationsActives.map(r=>(
            <div key={r.id} className="card" style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <div style={{fontFamily:'Syne',fontWeight:700,fontSize:16}}>Lot {r.lot?.numero}</div>
                  <div style={{fontSize:12,color:'#888'}}>
                    {r.lot?.projet?.nom} · {r.lot?.projet?.ville||''}
                  </div>
                </div>
                <span style={{fontSize:11,background:'#EEF3FB',color:'#1a3f6f',borderRadius:8,padding:'3px 10px',fontWeight:600}}>Réservé</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
                {[
                  ['Prix catalogue',fmtF(r.lot?.prix||0)],
                  ['Superficie',`${(r.lot?.superficie||0).toLocaleString('fr')} m²`],
                  ['Réservé le',fmtD(r.dateReservation||r.createdAt)],
                ].map(([k,v])=>(
                  <div key={k} style={{background:'#F7F7F5',borderRadius:6,padding:'8px 10px'}}>
                    <div style={{fontSize:10,color:'#888'}}>{k}</div>
                    <div style={{fontWeight:600,fontSize:13}}>{v}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setShowConvertir(r)}
                style={{width:'100%',padding:'10px',borderRadius:8,background:'#27500A',color:'white',border:'none',cursor:'pointer',fontFamily:'Syne',fontWeight:700,fontSize:14}}>
                🎉 Convertir en Souscripteur — Commencer les paiements
              </button>
            </div>
          ))}

          {p.ventes?.map(v=>(
            <div key={v.id} className="card" style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <div style={{fontFamily:'Syne',fontWeight:700,fontSize:16}}>Lot {v.lot?.numero} — Vente confirmée</div>
                  <div style={{fontSize:12,color:'#888'}}>{v.lot?.projet?.nom}</div>
                </div>
                <span style={{fontSize:11,background:'#EAF3DE',color:'#27500A',borderRadius:8,padding:'3px 10px',fontWeight:600}}>Converti</span>
              </div>
              <div style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                  <span style={{color:'#888'}}>Progression</span>
                  <span style={{fontWeight:700}}>
                    {Math.round(v.paiements.reduce((s,pm)=>s+pm.montant,0)/v.prixVente*100)}%
                  </span>
                </div>
                <div style={{height:8,background:'#F7F7F5',borderRadius:4}}>
                  <div style={{height:'100%',background:'#1a3f6f',borderRadius:4,
                    width:`${Math.min(100,Math.round(v.paiements.reduce((s,pm)=>s+pm.montant,0)/v.prixVente*100))}%`}}/>
                </div>
              </div>
              <button onClick={()=>setShowPaiement(v)}
                style={{width:'100%',padding:'10px',borderRadius:8,background:'#1a3f6f',color:'white',border:'none',cursor:'pointer',fontFamily:'Syne',fontWeight:700,fontSize:14}}>
                💳 Enregistrer un paiement
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Paiements ── */}
      {onglet==='paiements' && (
        <div>
          {p.ventes?.flatMap(v=>v.paiements.map(pm=>({...pm,lotNumero:v.lot?.numero,projetNom:v.lot?.projet?.nom,venteId:v.id,venteTotal:v.prixVente}))).length === 0 ? (
            <div className="empty-state"><p>Aucun paiement enregistré</p></div>
          ) : (
            <div style={{ overflowX:'auto' }}>
            <table className="table-erp">
              <thead>
                <tr><th>Date</th><th>Lot · Projet</th><th>Mode</th><th>Référence</th><th style={{textAlign:'right'}}>Montant</th></tr>
              </thead>
              <tbody>
                {p.ventes?.flatMap(v=>v.paiements.map(pm=>({...pm,v}))).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(pm=>(
                  <tr key={pm.id}>
                    <td style={{fontSize:12}}>{fmtDH(pm.createdAt)}</td>
                    <td style={{fontSize:12}}>Lot {pm.v.lot?.numero} · {pm.v.lot?.projet?.nom}</td>
                    <td style={{fontSize:12}}>{pm.typePaiement?.replace(/_/g,' ')}</td>
                    <td style={{fontSize:11,color:'#888'}}>{pm.reference||'—'}</td>
                    <td style={{textAlign:'right',fontWeight:700,color:'#27500A'}}>{fmtF(pm.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* ── Relances ── */}
      {onglet==='relances' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button onClick={()=>setShowRelance(true)}
              style={{padding:'8px 16px',borderRadius:8,background:'#1a3f6f',color:'white',border:'none',cursor:'pointer',fontSize:12,fontWeight:600}}>
              + Nouvelle relance
            </button>
          </div>
          {(p.relances||[]).length === 0 && <div className="empty-state"><p>Aucune relance</p></div>}
          {(p.relances||[]).map(r=>(
            <div key={r.id} style={{display:'flex',gap:14,padding:'12px 0',borderBottom:'0.5px solid #f0efe9'}}>
              <div style={{fontSize:20,flexShrink:0}}>{CANAL_ICON[r.canal]||'📋'}</div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontWeight:600,fontSize:13,textTransform:'capitalize'}}>{r.canal}</span>
                  <span style={{fontSize:11,color:'#888'}}>{fmtDH(r.dateRelance)}</span>
                </div>
                {r.resultat && (
                  <span style={{fontSize:10,background:(RESULTAT_COLOR[r.resultat]||'#888')+'18',color:RESULTAT_COLOR[r.resultat]||'#888',borderRadius:6,padding:'1px 8px',fontWeight:500}}>
                    {r.resultat.replace(/_/g,' ')}
                  </span>
                )}
                {r.notes && <div style={{fontSize:12,color:'#555',marginTop:4}}>{r.notes}</div>}
                {r.commercialNom && <div style={{fontSize:11,color:'#888',marginTop:2}}>Par {r.commercialNom}</div>}
                {r.prochain && <div style={{fontSize:11,color:'#BA7517',marginTop:2}}>📅 Prochaine : {fmtDH(r.prochain)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Rapport ── */}
      {onglet==='rapport' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div className="card">
            <div style={{fontFamily:'Syne',fontWeight:700,fontSize:14,marginBottom:12}}>📊 Synthèse prospect</div>
            {[
              ['Statut actuel',p.statut],
              ['Nombre de relances',nbRelances],
              ['Réservations actives',reservationsActives.length],
              ['Ventes confirmées',p.ventes?.length||0],
              ['Total souscrit',fmtF(totalDu)],
              ['Total payé',fmtF(totalPaye)],
              ['Taux paiement',totalDu>0?`${Math.round(totalPaye/totalDu*100)}%`:'—'],
              ['Dernière activité',p.relances?.[0]?fmtD(p.relances[0].dateRelance):'—'],
              ['Commercial',p.commercialNom||'—'],
              ['Source acquisition',p.sourceAcquisition||'—'],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid #f0efe9',fontSize:13}}>
                <span style={{color:'#888'}}>{k}</span><strong>{v}</strong>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{fontFamily:'Syne',fontWeight:700,fontSize:14,marginBottom:12}}>📋 Timeline</div>
            <div style={{position:'relative',paddingLeft:20}}>
              <div style={{position:'absolute',left:8,top:0,bottom:0,width:2,background:'#e8e7e1'}}/>
              {[
                {date:p.createdAt,label:'Création du contact',color:'#888'},
                ...(p.reservations||[]).map(r=>({date:r.createdAt,label:`Réservation Lot ${r.lot?.numero} — ${r.lot?.projet?.nom}`,color:'#1a3f6f'})),
                ...(p.ventes||[]).map(v=>({date:v.dateVente,label:`Conversion Lot ${v.lot?.numero}`,color:'#27500A'})),
                ...(p.ventes||[]).flatMap(v=>v.paiements.map(pm=>({date:pm.createdAt,label:`Paiement ${fmtF(pm.montant)}`,color:'#27500A'}))),
                ...(p.relances||[]).map(r=>({date:r.dateRelance,label:`Relance ${r.canal} — ${r.resultat||''}`,color:RESULTAT_COLOR[r.resultat]||'#888'})),
              ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,15).map((e,i)=>(
                <div key={i} style={{display:'flex',gap:10,marginBottom:10,position:'relative'}}>
                  <div style={{width:12,height:12,borderRadius:'50%',background:e.color,flexShrink:0,marginTop:2,marginLeft:-15}}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:500}}>{e.label}</div>
                    <div style={{fontSize:11,color:'#888'}}>{fmtDH(e.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Relance */}
      {showRelance && <ModalRelanceRapide onClose={()=>setShowRelance(false)} onSave={addRelanceMut.mutate} loading={addRelanceMut.isPending}/>}

      {/* Modal Convertir */}
      {showConvertir && (
        <ModalConvertirRapide
          reservation={showConvertir}
          prospectId={p.id}
          onClose={()=>setShowConvertir(null)}
          onSave={convertirMut.mutate}
          loading={convertirMut.isPending}
        />
      )}

      {/* Modal Paiement */}
      {showPaiement && (
        <ModalPaiementRapide
          vente={showPaiement}
          prospectId={p.id}
          onClose={()=>setShowPaiement(null)}
          onSave={d=>paiementMut.mutate({venteId:showPaiement.id,data:d})}
          loading={paiementMut.isPending}
        />
      )}

      {docViewer && <DocumentViewer document={docViewer} onClose={()=>setDocViewer(null)}/>}

      {toast && (
        <div style={{position:'fixed',bottom:20,right:16,background:toast.t==='error'?'#A32D2D':'#27500A',color:'white',padding:'10px 18px',borderRadius:10,fontSize:13,zIndex:9999}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Modal Relance rapide ──────────────────────────────────────────────────────
function ModalRelanceRapide({ onClose, onSave, loading }) {
  const [f, setF] = useState({ canal:'appel', resultat:'', notes:'', prochain:'' });
  const s = (k,v) => setF(x=>({...x,[k]:v}));
  const CANAUX = ['appel','whatsapp','sms','email','visite','recommandation'];
  const ICON = { appel:'📞', whatsapp:'💬', sms:'📱', email:'📧', visite:'🤝', recommandation:'⭐' };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:460}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
          <h3 style={{margin:0,fontFamily:'Syne',fontSize:15}}>📞 Nouvelle relance</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer'}}><X size={18}/></button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label className="label">Canal *</label>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {CANAUX.map(c=>(
                <button key={c} type="button" onClick={()=>s('canal',c)}
                  style={{padding:'5px 10px',borderRadius:16,border:`1.5px solid ${f.canal===c?'#1a3f6f':'#e8e7e1'}`,background:f.canal===c?'#EEF3FB':'white',color:f.canal===c?'#1a3f6f':'#888',fontSize:11,cursor:'pointer'}}>
                  {ICON[c]} {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Résultat</label>
            <select className="input" value={f.resultat} onChange={e=>s('resultat',e.target.value)}>
              <option value="">—</option>
              {['interesse','pas_interesse','rappeler','converti','perdu'].map(r=>(
                <option key={r} value={r}>{r.replace(/_/g,' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes *</label>
            <textarea value={f.notes} onChange={e=>s('notes',e.target.value)} rows={3}
              style={{width:'100%',padding:'8px 10px',border:'0.5px solid #e8e7e1',borderRadius:8,fontSize:12,resize:'vertical',fontFamily:'inherit',boxSizing:'border-box'}}/>
          </div>
          {(f.resultat==='rappeler'||!f.resultat) && (
            <div><label className="label">Prochaine relance</label>
              <input className="input" type="datetime-local" value={f.prochain} onChange={e=>s('prochain',e.target.value)}/></div>
          )}
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!f.notes||loading} style={{background:'#1a3f6f',border:'none'}}
            onClick={()=>onSave(f)}>{loading?'...':'✅ Enregistrer'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Convertir rapide ────────────────────────────────────────────────────
function ModalConvertirRapide({ reservation, prospectId, onClose, onSave, loading }) {
  const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(2)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${n||0} F`;
  const [prixVente, setPrixVente] = useState(String(reservation.lot?.prix||''));
  const [premierPaiement, setPremierPaiement] = useState('');
  const [typePaiement, setTypePaiement] = useState('ESPECES');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:460}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
          <h3 style={{margin:0,fontFamily:'Syne',fontSize:15,color:'#27500A'}}>🎉 Convertir en Souscripteur</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer'}}><X size={18}/></button>
        </div>
        <div style={{background:'#EEF3FB',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12}}>
          <strong>Lot {reservation.lot?.numero}</strong> — {reservation.lot?.projet?.nom}<br/>
          <span style={{color:'#888'}}>Prix catalogue : {fmtF(reservation.lot?.prix||0)}</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label className="label">Prix de vente (FCFA) *</label>
            <input className="input" type="number" value={prixVente} onChange={e=>setPrixVente(e.target.value)} placeholder="Ex: 5000000"/>
          </div>
          <div style={{background:'#F7F7F5',borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#888',marginBottom:8}}>Premier paiement (optionnel)</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div><label className="label">Montant</label>
                <input className="input" type="number" value={premierPaiement} onChange={e=>setPremierPaiement(e.target.value)} placeholder="Laisser vide si pas maintenant"/></div>
              <div>
                <label className="label">Mode</label>
                <select className="input" value={typePaiement} onChange={e=>setTypePaiement(e.target.value)}>
                  {['ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE'].map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div style={{background:'#EAF3DE',borderRadius:8,padding:'8px 12px',fontSize:11,color:'#27500A'}}>
            ✓ Lot → VENDU · Réservation → CONVERTIE · Contact → SOUSCRIPTEUR
            {premierPaiement ? `\n✓ Paiement de ${fmtF(Number(premierPaiement))} enregistré` : ''}
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!prixVente||loading} style={{background:'#27500A',border:'none'}}
            onClick={()=>onSave({souscripteurId:prospectId,reservationId:reservation.id,prixVente,premierPaiement:premierPaiement||undefined,typePaiement})}>
            {loading?'...':'🎉 Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Paiement rapide ─────────────────────────────────────────────────────
function ModalPaiementRapide({ vente, onClose, onSave, loading }) {
  const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(2)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${n||0} F`;
  const [montant, setMontant] = useState('');
  const [typePaiement, setTypePaiement] = useState('ESPECES');
  const [reference, setReference] = useState('');
  const dejaPaye = vente.paiements.reduce((s,pm)=>s+pm.montant,0);
  const restant = vente.prixVente - dejaPaye;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
          <h3 style={{margin:0,fontFamily:'Syne',fontSize:15,color:'#1a3f6f'}}>💳 Enregistrer un paiement</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer'}}><X size={18}/></button>
        </div>
        <div style={{background:'#EEF3FB',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12}}>
          Lot {vente.lot?.numero} — {vente.lot?.projet?.nom}<br/>
          <span style={{color:'#888'}}>Restant à payer : <strong style={{color:'#A32D2D'}}>{fmtF(restant)}</strong></span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div><label className="label">Montant (FCFA) *</label>
            <input className="input" type="number" max={restant} value={montant} onChange={e=>setMontant(e.target.value)}/>
          </div>
          <div>
            <label className="label">Mode de paiement</label>
            <select className="input" value={typePaiement} onChange={e=>setTypePaiement(e.target.value)}>
              {['ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE'].map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div><label className="label">Référence</label>
            <input className="input" value={reference} onChange={e=>setReference(e.target.value)} placeholder="Optionnel"/></div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!montant||loading} style={{background:'#1a3f6f',border:'none'}}
            onClick={()=>onSave({montant:Number(montant),typePaiement,reference})}>
            {loading?'...':'✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
