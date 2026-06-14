import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI } from '../../lib/api';
import { Plus, X, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { exportExcel } from '../../lib/export';

const STATUT_VENTE = {
  EN_COURS: { badge: 'badge-blue', label: 'En cours' },
  SOLDE:    { badge: 'badge-green', label: 'Soldé' },
  LITIGE:   { badge: 'badge-red', label: 'Litige' },
};
const STATUT_ECH = {
  EN_ATTENTE: { color: '#888', label: 'En attente' },
  PARTIEL:    { color: '#BA7517', label: 'Partiel' },
  RETARD:     { color: '#A32D2D', label: 'Retard' },
  PAYE:       { color: '#27500A', label: 'Payé' },
};
const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(2)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${Math.round(n||0)} F`;
const fmtD = d => d ? new Date(d).toLocaleDateString('fr',{day:'2-digit',month:'short',year:'numeric'}) : '—';

// ── Modal encaissement échéance ───────────────────────────────────────────────
function ModalEncaisserEcheance({ vente, echeance, onClose, onSave }) {
  const [form, setForm] = useState({
    montant: echeance.montant - (echeance.montantPaye||0),
    typePaiement: 'ESPECES', reference: '',
  });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
          <h3 style={{margin:0,fontFamily:'Syne',fontSize:15}}>💳 Payer échéance #{echeance.numero}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer'}}><X size={18}/></button>
        </div>
        <div style={{background:'#EEF3FB',borderRadius:8,padding:'8px 12px',marginBottom:14,fontSize:12}}>
          Lot {vente.lot?.numero} · Dû : {fmtF(echeance.montant)} · Payé : {fmtF(echeance.montantPaye||0)}
          · <strong>Reste : {fmtF(echeance.montant-(echeance.montantPaye||0))}</strong>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div><label className="label">Montant</label>
            <input className="input" type="number" value={form.montant} onChange={e=>setForm(f=>({...f,montant:e.target.value}))}/></div>
          <div><label className="label">Mode</label>
            <select className="input" value={form.typePaiement} onChange={e=>setForm(f=>({...f,typePaiement:e.target.value}))}>
              {['ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE'].map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select></div>
          <div><label className="label">Référence</label>
            <input className="input" value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))}/></div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{background:'#1a3f6f',color:'white',border:'none'}}
            onClick={()=>onSave({venteId:vente.id,echeancierId:echeance.id,...form,montant:Number(form.montant)})}>
            <CheckCircle size={13}/> Encaisser
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal planifier échéancier ────────────────────────────────────────────────
function ModalPlanifierEcheancier({ vente, onClose, onSave, loading }) {
  const totalPaye = (vente.paiements||[]).reduce((s,p)=>s+p.montant,0);
  const restant = Math.max(0, (vente.prixVente||0) - totalPaye);
  const [form, setForm] = useState({
    nombreEcheances: '12',
    montantTotal: String(Math.round(restant)),
    dateDebut: new Date().toISOString().split('T')[0],
    periodeJours: '30',
  });
  const s = (k,v) => setForm(f=>({...f,[k]:v}));
  const montantEch = form.nombreEcheances > 0 ? Math.round(Number(form.montantTotal)/Number(form.nombreEcheances)) : 0;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:18}}>
          <h3 style={{margin:0,fontFamily:'Syne',fontSize:16}}>📅 Planifier l'échéancier</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer'}}>✕</button>
        </div>
        <div style={{background:'#EEF3FB',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12}}>
          <strong>Lot {vente.lot?.numero} — {vente.lot?.projet?.nom}</strong><br/>
          <span style={{color:'#888'}}>Prix : {fmtF(vente.prixVente)} · Déjà payé : {fmtF(totalPaye)} · Restant : </span>
          <strong style={{color:'#A32D2D'}}>{fmtF(restant)}</strong>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><label className="label">Montant à échelonner *</label>
            <input className="input" type="number" value={form.montantTotal} onChange={e=>s('montantTotal',e.target.value)}/></div>
          <div><label className="label">Nombre d'échéances *</label>
            <input className="input" type="number" min={1} max={120} value={form.nombreEcheances} onChange={e=>s('nombreEcheances',e.target.value)}/></div>
          <div><label className="label">Date de début</label>
            <input className="input" type="date" value={form.dateDebut} onChange={e=>s('dateDebut',e.target.value)}/></div>
          <div><label className="label">Fréquence</label>
            <select className="input" value={form.periodeJours} onChange={e=>s('periodeJours',e.target.value)}>
              <option value="30">Mensuelle (30j)</option>
              <option value="15">Bi-mensuelle (15j)</option>
              <option value="90">Trimestrielle (90j)</option>
              <option value="180">Semestrielle (180j)</option>
              <option value="365">Annuelle</option>
            </select></div>
        </div>
        {form.montantTotal && form.nombreEcheances && (
          <div style={{background:'#EAF3DE',borderRadius:8,padding:'10px',marginTop:12,fontSize:12}}>
            {form.nombreEcheances} échéance(s) de <strong>{fmtF(montantEch)}</strong>
            {vente.echeanciers?.length>0&&<div style={{color:'#A32D2D',marginTop:4,fontSize:11}}>⚠ Les échéances non payées seront remplacées</div>}
          </div>
        )}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:18}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!form.montantTotal||!form.nombreEcheances||loading}
            style={{background:'#27500A',border:'none'}}
            onClick={()=>onSave({nombreEcheances:Number(form.nombreEcheances),montantTotal:Number(form.montantTotal),dateDebut:form.dateDebut,periodeJours:Number(form.periodeJours)})}>
            {loading?'...':'📅 Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panneau détail vente ──────────────────────────────────────────────────────
function PanelVente({ vente, onClose, onEncaisser, onPlanifier }) {
  const totalPaye = (vente.paiements||[]).reduce((s,p)=>s+p.montant,0);
  const pct = vente.prixVente>0 ? Math.round(totalPaye/vente.prixVente*100) : 0;
  const echPayees = (vente.echeanciers||[]).filter(e=>e.statut==='PAYE').length;
  const tel = (vente.souscripteur?.telephone||'').replace(/[\s\-+]/g,'').replace(/^0/,'225');

  return (
    <div style={{position:'fixed',right:0,top:56,bottom:0,width:460,background:'white',borderLeft:'1px solid #e8e7e1',overflowY:'auto',zIndex:100,boxShadow:'-4px 0 20px rgba(0,0,0,0.08)'}}>
      <div style={{padding:'16px 20px',borderBottom:'1px solid #e8e7e1',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div style={{fontFamily:'Syne',fontWeight:800,fontSize:17}}>{vente.souscripteur?.prenom} {vente.souscripteur?.nom}</div>
          <div style={{fontSize:12,color:'#888',marginTop:2}}>Lot {vente.lot?.numero} · {vente.lot?.projet?.nom}</div>
          <div style={{fontFamily:'Syne',fontWeight:700,fontSize:20,color:'#1a3f6f',marginTop:4}}>{fmtF(vente.prixVente)}</div>
        </div>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',padding:4}}><X size={20}/></button>
      </div>

      <div style={{padding:'14px 20px'}}>
        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
          {[
            {label:'Encaissé',value:fmtF(totalPaye),color:'#27500A'},
            {label:'Restant',value:fmtF(Math.max(0,vente.prixVente-totalPaye)),color:'#A32D2D'},
          ].map((k,i)=>(
            <div key={i} style={{background:'#F7F7F5',borderRadius:8,padding:'10px 12px',borderTop:`2px solid ${k.color}`}}>
              <div style={{fontSize:10,color:'#888'}}>{k.label}</div>
              <div style={{fontFamily:'Syne',fontWeight:700,fontSize:16,color:k.color}}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Barre */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#888',marginBottom:3}}>
            <span>Encaissements {echPayees}/{vente.echeanciers?.length||0} échéances</span>
            <span style={{fontWeight:600}}>{pct}%</span>
          </div>
          <div style={{height:6,background:'#EEF3FB',borderRadius:3}}>
            <div style={{height:'100%',width:`${Math.min(pct,100)}%`,background:pct>=100?'#27500A':'#1a3f6f',borderRadius:3}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginTop:3}}>
            <span style={{color:'#27500A'}}>Perçu : {fmtF(totalPaye)}</span>
            <span style={{color:'#A32D2D'}}>Restant : {fmtF(Math.max(0,vente.prixVente-totalPaye))}</span>
          </div>
        </div>

        {/* Boutons actions */}
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <button onClick={()=>onPlanifier(vente)}
            style={{flex:1,padding:'7px 12px',borderRadius:8,background:vente.echeanciers?.length>0?'#F7F7F5':'#27500A',color:vente.echeanciers?.length>0?'#888':'white',border:vente.echeanciers?.length>0?'1px solid #e8e7e1':'none',fontSize:12,cursor:'pointer',fontWeight:600}}>
            📅 {vente.echeanciers?.length>0?'Modifier le plan':'Planifier échéancier'}
          </button>
        </div>

        {/* Échéancier */}
        <div style={{fontWeight:600,fontSize:13,marginBottom:8,color:'#1a3f6f'}}>ÉCHÉANCIER DÉTAILLÉ</div>
        {!vente.echeanciers?.length ? (
          <div style={{background:'#FAEEDA',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#BA7517'}}>
            ⚠ Aucun échéancier — Cliquez "Planifier échéancier" pour définir le calendrier.
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'#F7F7F5'}}>
                <th style={{padding:'5px 8px',textAlign:'left'}}>#</th>
                <th style={{padding:'5px 8px',textAlign:'right'}}>Montant</th>
                <th style={{padding:'5px 8px',textAlign:'right'}}>Payé</th>
                <th style={{padding:'5px 8px'}}>Date</th>
                <th style={{padding:'5px 8px'}}>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(vente.echeanciers||[]).sort((a,b)=>a.numero-b.numero).map(ech=>{
                const sc = STATUT_ECH[ech.statut]||STATUT_ECH.EN_ATTENTE;
                return (
                  <tr key={ech.id} style={{borderBottom:'0.5px solid #f0efe9',background:ech.statut==='RETARD'?'#FDF2F2':undefined}}>
                    <td style={{padding:'5px 8px',fontWeight:600}}>#{ech.numero}</td>
                    <td style={{padding:'5px 8px',textAlign:'right'}}>{fmtF(ech.montant)}</td>
                    <td style={{padding:'5px 8px',textAlign:'right',color:ech.montantPaye>0?'#27500A':'#ccc'}}>{fmtF(ech.montantPaye||0)}</td>
                    <td style={{padding:'5px 8px',color:ech.statut==='RETARD'?'#A32D2D':'#888',fontSize:11}}>{fmtD(ech.dateEcheance)}</td>
                    <td style={{padding:'5px 8px'}}>
                      <span style={{fontSize:10,fontWeight:600,color:sc.color}}>{sc.label}</span>
                    </td>
                    <td style={{padding:'3px 4px'}}>
                      {ech.statut!=='PAYE' && (
                        <button onClick={()=>onEncaisser(vente,ech)}
                          style={{fontSize:10,padding:'2px 7px',borderRadius:5,background:'#EEF3FB',color:'#1a3f6f',border:'none',cursor:'pointer'}}>
                          Payer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Paiements libres */}
        {(vente.paiements||[]).length > 0 && (
          <div style={{marginTop:14}}>
            <div style={{fontWeight:600,fontSize:12,marginBottom:6,color:'#888'}}>HISTORIQUE PAIEMENTS</div>
            {(vente.paiements||[]).map(p=>(
              <div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'0.5px solid #f0efe9',fontSize:12}}>
                <span style={{color:'#888'}}>{fmtD(p.createdAt)} · {p.typePaiement?.replace(/_/g,' ')}</span>
                <span style={{fontWeight:600,color:'#27500A'}}>{fmtF(p.montant)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Contact */}
        <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid #e8e7e1'}}>
          <div style={{fontSize:11,color:'#888',marginBottom:6}}>Contact souscripteur</div>
          <div style={{display:'flex',gap:8}}>
            <a href={`tel:${vente.souscripteur?.telephone}`}
              style={{padding:'6px 14px',background:'#EAF3DE',borderRadius:8,color:'#27500A',textDecoration:'none',fontSize:12,fontWeight:600}}>
              📞 {vente.souscripteur?.telephone}
            </a>
            <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer"
              style={{padding:'6px 14px',background:'#E8F9EF',borderRadius:8,color:'#25D366',textDecoration:'none',fontSize:12,fontWeight:600}}>
              💬 WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function VentesPage() {
  const qc = useQueryClient();
  const [selectedVente, setSelectedVente] = useState(null);
  const [planifierFor, setPlanifierFor] = useState(null);
  const [encaisserTarget, setEncaisserTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg,t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3000); };

  const { data: ventesRaw, isLoading, refetch } = useQuery({
    queryKey: ['ventes'],
    queryFn: () => toptelsigAPI.ventesListe(),
    staleTime: 30000,
  });

  const planifierMut = useMutation({
    mutationFn: ({ venteId, data }) => toptelsigAPI.planifierEcheancier(venteId, data),
    onSuccess: () => {
      qc.refetchQueries({queryKey:['ventes']});
      setPlanifierFor(null);
      showToast('Échéancier planifié ✓');
    },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const encaisserMut = useMutation({
    mutationFn: (data) => toptelsigAPI.addPaiement(encaisserTarget?.vente?.souscripteur?.id||encaisserTarget?.vente?.souscripteurId, data),
    onSuccess: () => {
      qc.refetchQueries({queryKey:['ventes']});
      setEncaisserTarget(null);
      showToast('Paiement enregistré ✓');
    },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  });

  const ventes = Array.isArray(ventesRaw) ? ventesRaw : (ventesRaw?.data || []);
  const totalCA = ventes.reduce((s,v)=>s+(v.prixVente||0),0);
  const totalPercu = ventes.reduce((s,v)=>s+((v.paiements||[]).reduce((ss,p)=>ss+p.montant,0)),0);

  const exportData = () => {
    exportExcel('ventes_toptelsig','Ventes & Échéanciers',
      ['Souscripteur','Téléphone','Lot','Projet','Prix vente','Payé','Restant','%','Statut'],
      ventes.map(v=>{
        const paye=(v.paiements||[]).reduce((s,p)=>s+p.montant,0);
        return [`${v.souscripteur?.prenom} ${v.souscripteur?.nom}`,v.souscripteur?.telephone,
          v.lot?.numero,v.lot?.projet?.nom,v.prixVente||0,paye,Math.max(0,(v.prixVente||0)-paye),
          v.prixVente>0?Math.round(paye/v.prixVente*100):0,v.statut];
      })
    );
  };

  return (
    <div className="page-enter" style={{paddingRight:selectedVente?466:0,transition:'padding-right 0.2s'}}>
      <div className="page-header">
        <div>
          <h1 style={{margin:0,fontFamily:'Syne',fontWeight:800,fontSize:22}}>📊 Ventes & Échéanciers</h1>
          <p style={{margin:'4px 0 0',fontSize:12,color:'#888'}}>
            {ventes.length} lignes
            {' · '}CA total : <strong style={{color:'#1a3f6f'}}>{fmtF(totalCA)}</strong>
            {' · '}Perçu : <strong style={{color:'#27500A'}}>{fmtF(totalPercu)}</strong>
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportData}>📥 Excel</button>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
        {[
          {label:'Ventes actives',value:ventes.filter(v=>v.statut==='EN_COURS').length,color:'#1a3f6f'},
          {label:'Soldées',value:ventes.filter(v=>v.statut==='SOLDE').length,color:'#27500A'},
          {label:'Retards paiement',value:ventes.reduce((s,v)=>s+(v.echeanciers||[]).filter(e=>e.statut==='RETARD').length,0),color:'#A32D2D'},
          {label:'Taux encaissement',value:totalCA>0?`${Math.round(totalPercu/totalCA*100)}%`:'0%',color:'#1a3f6f'},
        ].map((k,i)=>(
          <div key={i} className="kpi" style={{borderTop:`3px solid ${k.color}`}}>
            <div className="kpi-label">{k.label}</div>
            <div style={{fontFamily:'Syne',fontWeight:800,fontSize:22,color:k.color}}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        {isLoading ? <div style={{padding:40,textAlign:'center',color:'#888'}}>Chargement...</div> : (
          <table className="table-erp">
            <thead>
              <tr>
                <th>Souscripteur</th><th>Lot · Projet</th><th>Prix vente</th>
                <th>Statut</th><th>Progression</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ventes.map(v => {
                const paye = (v.paiements||[]).reduce((s,p)=>s+p.montant,0);
                const pct = v.prixVente>0 ? Math.round(paye/v.prixVente*100) : 0;
                const enRetard = (v.echeanciers||[]).some(e=>e.statut==='RETARD');
                const isSelected = selectedVente?.id===v.id;
                const sv = STATUT_VENTE[v.statut]||STATUT_VENTE.EN_COURS;
                return (
                  <tr key={v.id} onClick={()=>setSelectedVente(isSelected?null:v)}
                    style={{cursor:'pointer',background:isSelected?'#F0F6FF':enRetard?'#FDF2F2':undefined}}>
                    <td>
                      <div style={{fontWeight:600}}>{v.souscripteur?.prenom} {v.souscripteur?.nom}</div>
                      <div style={{fontSize:11,color:'#888'}}>{v.souscripteur?.telephone}</div>
                    </td>
                    <td style={{fontSize:13}}>
                      Lot {v.lot?.numero} · <span style={{color:'#888'}}>{v.lot?.projet?.nom}</span>
                    </td>
                    <td style={{fontWeight:600}}>{fmtF(v.prixVente)}</td>
                    <td><span className={`badge ${sv.badge}`}>{sv.label}</span></td>
                    <td style={{minWidth:120}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{flex:1,height:6,background:'#EEF3FB',borderRadius:3}}>
                          <div style={{height:'100%',width:`${Math.min(pct,100)}%`,background:pct>=100?'#27500A':'#1a3f6f',borderRadius:3}}/>
                        </div>
                        <span style={{fontSize:11,color:'#888',whiteSpace:'nowrap'}}>{pct}%</span>
                      </div>
                      {enRetard && <div style={{fontSize:10,color:'#A32D2D',fontWeight:600,marginTop:2}}>⚠ Retard</div>}
                    </td>
                    <td onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setPlanifierFor(v)}
                        style={{fontSize:11,padding:'3px 8px',borderRadius:6,background:'#EAF3DE',color:'#27500A',border:'none',cursor:'pointer'}}>
                        📅 {v.echeanciers?.length>0?'Écheancier':'Planifier'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {ventes.length===0 && !isLoading && (
                <tr><td colSpan={6}><div className="empty-state"><p>Aucune vente</p></div></td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Panneau détail */}
      {selectedVente && (
        <PanelVente
          vente={selectedVente}
          onClose={()=>setSelectedVente(null)}
          onEncaisser={(vente,ech)=>setEncaisserTarget({vente,echeance:ech})}
          onPlanifier={(vente)=>setPlanifierFor(vente)}
        />
      )}

      {/* Modals */}
      {planifierFor && (
        <ModalPlanifierEcheancier
          vente={planifierFor}
          onClose={()=>setPlanifierFor(null)}
          onSave={data=>planifierMut.mutate({venteId:planifierFor.id,data})}
          loading={planifierMut.isPending}
        />
      )}
      {encaisserTarget && (
        <ModalEncaisserEcheance
          vente={encaisserTarget.vente}
          echeance={encaisserTarget.echeance}
          onClose={()=>setEncaisserTarget(null)}
          onSave={data=>encaisserMut.mutate(data)}
        />
      )}
      {toast && (
        <div style={{position:'fixed',bottom:20,right:16,background:toast.t==='error'?'#A32D2D':'#27500A',color:'white',padding:'10px 18px',borderRadius:10,fontSize:13,zIndex:9999}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
