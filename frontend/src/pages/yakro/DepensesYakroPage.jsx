import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yakroAPI, employesAPI } from '../../lib/api';
import { useYakro } from '../../lib/useYakro';
import { Plus, X, Check, Paperclip, FileText, Upload } from 'lucide-react';
import { useAuthStore } from '../../store';
import { rapportDepensePDF, rapportDepensesExcel } from '../../lib/rapportDepense';

const MODES = ['ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE'];
const STATUT_CONFIG = {
  BROUILLON: { color:'#BA7517', label:'① Émise · à valider (DG)' },
  VALIDEE: { color:'#1a3f6f', label:'② Validée · à décaisser' },
  REJETEE: { color:'#A32D2D', label:'Rejetée' },
  PAYEE: { color:'#0F6E56', label:'③ Décaissée · à justifier' },
  JUSTIFIEE: { color:'#6B3FA0', label:'④ Justifiée · à clôturer' },
  CLOTUREE: { color:'#27500A', label:'⑤ Clôturée' },
};
const NATURE = { FIXE: { label:'Charge fixe', color:'#1a3f6f' }, VARIABLE: { label:'Autre charge', color:'#BA7517' } };
const FIXES = ['Salaires','Loyer','Électricité','Eau','Internet / Téléphone','Assurance'];
const fmtF = n => n>=1000000?`${(n/1000000).toFixed(2)}M F`:n>=1000?`${Math.round(n/1000)}k F`:`${Math.round(n||0)} F`;
const fmtFull = n => `${Math.round(n||0).toLocaleString('fr')} F`;
const moisCourant = () => new Date().toISOString().slice(0, 7);
const jourIso = (d) => d.toISOString().slice(0, 10);
const FORM_VIDE = () => ({ categorie:'', nature:'', description:'', montant:'', typePaiement:'ESPECES', beneficiaire:'', notes:'', employeId:'', periode:moisCourant(), recu:'', recuNom:'' });

/** Reçu : image réduite (1400 px, JPEG) ou PDF de 1 Mo max, converti en texte pour l'envoi. */
function lireRecu(f, ok, ko) {
  if (!f) return;
  if (f.type === 'application/pdf') {
    if (f.size > 1000000) return ko('PDF trop lourd (1 Mo max)');
    const r = new FileReader(); r.onload = () => ok(r.result, f.name); r.readAsDataURL(f); return;
  }
  if (!f.type.startsWith('image/')) return ko('Choisissez une photo ou un PDF');
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    ok(c.toDataURL('image/jpeg', 0.8), f.name); URL.revokeObjectURL(img.src);
  };
  img.onerror = () => ko('Image illisible');
  img.src = URL.createObjectURL(f);
}

function VoirRecu({ depense, peutModifier, onClose, onChange }) {
  const [erreur, setErreur] = useState('');
  const { data, isLoading } = useQuery({ queryKey:['recu-depense', depense.id], queryFn:()=>yakroAPI.recuDepenseYakro(depense.id), enabled: depense.aRecu, retry:false });
  const envoyer = useMutation({ mutationFn:(recu)=>yakroAPI.majRecuDepenseYakro(depense.id, recu), onSuccess:()=>{ onChange(); onClose(); }, onError:(e)=>setErreur(e?.error||e?.response?.data?.error||e.message) });
  const recu = data?.recu;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:520 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>Reçu — {depense.description}</h3>
          <button onClick={onClose} aria-label="Fermer" style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        {depense.aRecu ? (isLoading ? <p style={{ fontSize:13, color:'#888' }}>Chargement…</p>
          : recu?.startsWith('data:application/pdf') ? <iframe title="Reçu" src={recu} style={{ width:'100%', height:420, border:0, borderRadius:8 }}/>
          : recu ? <img src={recu} alt="Reçu" style={{ width:'100%', maxHeight:460, objectFit:'contain', borderRadius:8, background:'#F7F7F5' }}/>
          : <p style={{ fontSize:13, color:'#A32D2D' }}>Reçu introuvable.</p>)
          : <p style={{ fontSize:13, color:'#888' }}>Aucun reçu enregistré pour cette dépense.</p>}
        {erreur && <p role="alert" style={{ fontSize:12, color:'#A32D2D' }}>{erreur}</p>}
        {peutModifier && (
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <label className="btn btn-sm btn-ghost" style={{ cursor:'pointer' }}><Upload size={13}/> {depense.aRecu ? 'Remplacer le reçu' : 'Ajouter un reçu'}
              <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; e.target.value=''; lireRecu(f, r=>envoyer.mutate(r), setErreur); }}/>
            </label>
            {depense.aRecu && <button className="btn btn-sm btn-ghost" style={{ color:'#A32D2D' }} onClick={()=>envoyer.mutate('')}>Retirer</button>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Étapes du circuit : rejet (motif), décaissement (mode + référence), justification (montant réel + reçu). */
function EtapeModal({ etape, depense, onClose, onDone }) {
  const [motif, setMotif] = useState('');
  const [mode, setMode] = useState(depense.typePaiement || 'ESPECES');
  const [reference, setReference] = useState('');
  const [montant, setMontant] = useState(depense.montant);
  const [recu, setRecu] = useState('');
  const [recuNom, setRecuNom] = useState('');
  const [erreur, setErreur] = useState('');
  const m = useMutation({
    mutationFn: () => etape === 'rejeter' ? yakroAPI.rejeterDepenseYakro(depense.id, motif)
      : etape === 'payer' ? yakroAPI.payerDepenseYakro(depense.id, { typePaiement: mode, reference })
      : yakroAPI.justifierDepenseYakro(depense.id, { montantJustifie: Number(montant), note: motif, recu: recu || undefined }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e) => setErreur(e?.error || e?.response?.data?.error || e.message),
  });
  const titre = { rejeter: 'Rejeter la dépense', payer: 'Décaisser', justifier: 'Justifier la dépense' }[etape];
  const ecart = etape === 'justifier' && Number(montant) !== depense.montant;
  const ok = etape === 'rejeter' ? motif.trim() : etape === 'justifier' ? (depense.aRecu || recu) && (!ecart || motif.trim()) : true;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:440 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>{titre} — {fmtFull(depense.montant)}</h3>
          <button onClick={onClose} aria-label="Fermer" style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <p style={{ fontSize:12, color:'#888', margin:'0 0 10px' }}>{depense.description}</p>
        {etape === 'rejeter' && <><label className="label">Motif du rejet *</label><textarea className="input" rows={3} value={motif} onChange={e=>setMotif(e.target.value)}/></>}
        {etape === 'payer' && (
          <div className="form-grid">
            <div><label className="label">Mode de décaissement</label><select className="input" value={mode} onChange={e=>setMode(e.target.value)}>{MODES.map(x=><option key={x} value={x}>{x.replace(/_/g,' ')}</option>)}</select></div>
            <div><label className="label">Référence (n° transaction, chèque…)</label><input className="input" value={reference} onChange={e=>setReference(e.target.value)}/></div>
          </div>
        )}
        {etape === 'justifier' && (
          <div className="form-grid">
            <div><label className="label">Montant réellement dépensé (FCFA)</label><input className="input" type="number" min="0" value={montant} onChange={e=>setMontant(e.target.value)}/></div>
            <div><label className="label">Justificatif *</label>
              {depense.aRecu && !recu ? <span style={{ fontSize:12, color:'#27500A' }}>✓ Reçu déjà joint</span> : null}
              <label className="btn btn-sm btn-ghost" style={{ cursor:'pointer' }}><Paperclip size={13}/> {recu ? 'Remplacer' : depense.aRecu ? 'Changer' : 'Joindre'}
                <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; e.target.value=''; lireRecu(f, (r,n)=>{ setRecu(r); setRecuNom(n); }, setErreur); }}/>
              </label>{recuNom && <span style={{ fontSize:12, marginLeft:6 }}>✓ {recuNom}</span>}
            </div>
            <div className="full"><label className="label">{ecart ? `Écart de ${fmtFull(Math.abs(depense.montant - Number(montant)))} — explication *` : 'Note (facultatif)'}</label><textarea className="input" rows={2} value={motif} onChange={e=>setMotif(e.target.value)}/></div>
          </div>
        )}
        {erreur && <p role="alert" style={{ color:'#A32D2D', fontSize:13, marginTop:8 }}>{erreur}</p>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!ok || m.isPending} style={{ background: etape==='rejeter' ? '#A32D2D' : '#8B1A1A', border:'none' }} onClick={()=>{ setErreur(''); m.mutate(); }}>{m.isPending ? '...' : titre}</button>
        </div>
      </div>
    </div>
  );
}

export default function DepensesYakroPage({ histo = false }) {
  const qc = useQueryClient();
  const { courant, peut } = useYakro();
  const saisir = peut('depenses.saisir');
  const [showCreate, setShowCreate] = useState(false);
  const [statutFilter, setStatutFilter] = useState('');
  const [natureFilter, setNatureFilter] = useState('');
  const [categorieFilter, setCategorieFilter] = useState('');
  const [du, setDu] = useState(jourIso(new Date(Date.now() - 29 * 86400000)));
  const [au, setAu] = useState(jourIso(new Date()));
  const [form, setForm] = useState(FORM_VIDE());
  const [erreur, setErreur] = useState('');
  const [recuVu, setRecuVu] = useState(null);
  const [etape, setEtape] = useState(null); // { type, depense }
  const estDG = ['DG','DIRECTEUR'].includes(useAuthStore.getState().user?.role);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const rafraichir = () => { qc.invalidateQueries({ queryKey:['depenses-yakro'] }); qc.invalidateQueries({ queryKey:['stats-depenses-yakro'] }); qc.invalidateQueries({ queryKey:['recu-depense'] }); };

  const params = { statut:statutFilter||undefined, nature:natureFilter||undefined, archive: histo ? '1' : '0', ...(histo ? { du, au, categorie:categorieFilter||undefined } : {}) };
  const { data } = useQuery({ queryKey:['depenses-yakro', courant?.id, params], queryFn:()=>yakroAPI.depensesYakro(params), staleTime:15000 });
  const { data: stats } = useQuery({ queryKey:['stats-depenses-yakro', courant?.id], queryFn:yakroAPI.statsDepensesYakro, staleTime:60000, enabled:!histo });
  const { data: categories = [] } = useQuery({ queryKey:['cats-dep-yakro'], queryFn:yakroAPI.categoriesDepensesYakro, staleTime:3600000 });
  const estSalaire = form.categorie === 'Salaires';
  const { data: employes = [] } = useQuery({
    queryKey:['employes-yakro', courant?.id], enabled: showCreate && estSalaire,
    queryFn: async () => { const r = await employesAPI.list({ filiale:'YAKRO_GRILL', statut:'ACTIF', limit:200 }); const l = r?.data || r?.employes || r || []; return Array.isArray(l) ? l : []; },
  });
  const { data: salaire } = useQuery({ queryKey:['salaire-dep', form.employeId, form.periode], queryFn:()=>yakroAPI.salaireDepenseYakro(form.employeId, form.periode), enabled: showCreate && estSalaire && !!form.employeId });

  const createMut = useMutation({
    mutationFn: yakroAPI.createDepenseYakro,
    onSuccess: () => { rafraichir(); setShowCreate(false); setForm(FORM_VIDE()); setErreur(''); },
    onError: (e) => setErreur(e?.error || e?.response?.data?.error || e.message),
  });
  const validerMut = useMutation({ mutationFn:(id)=>yakroAPI.validerDepenseYakro(id), onSuccess:rafraichir });
  const cloturerMut = useMutation({ mutationFn:(id)=>yakroAPI.cloturerDepenseYakro(id), onSuccess:rafraichir });

  const depenses = data?.data || [];
  const choisirCategorie = (c) => setForm(f => ({ ...f, categorie:c, nature: FIXES.includes(c) ? 'FIXE' : 'VARIABLE', employeId:'', description: c === 'Salaires' ? 'Salaire' : f.description }));
  const choisirEmploye = (id) => {
    const e = employes.find(x => x.id === id);
    setForm(f => ({ ...f, employeId:id, beneficiaire: e ? `${e.prenom} ${e.nom}` : '', description: e ? `Salaire ${e.prenom} ${e.nom}` : 'Salaire' }));
  };
  const depasse = estSalaire && salaire && Number(form.montant) > salaire.reste;
  const peutCreer = form.categorie && form.description && Number(form.montant) > 0 && (!estSalaire || form.employeId) && !createMut.isPending;

  return (
    <div className="page-enter">
      {!histo && <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#8B1A1A' }}>💸 Dépenses Restaurant</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>{depenses.length} dépense(s) · Total: <strong>{fmtF(data?.total||0)}</strong></p>
        </div>
        {saisir && <button className="btn btn-primary btn-sm" style={{ background:'#8B1A1A', border:'none' }} onClick={()=>setShowCreate(true)}>
          <Plus size={13}/> Nouvelle dépense
        </button>}
      </div>}

      {!histo && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:16 }}>
          {[
            { label:"Aujourd'hui", value:fmtF(stats?.jour||0), color:'#8B1A1A' },
            { label:'Ce mois', value:fmtF(stats?.mois||0), color:'#E87722' },
            { label:'Charges fixes (mois)', value:fmtF(stats?.moisFixes||0), color:'#1a3f6f' },
            { label:'Autres charges (mois)', value:fmtF(stats?.moisVariables||0), color:'#BA7517' },
            { label:'À valider (DG)', value:depenses.filter(d=>d.statut==='BROUILLON').length, color:'#BA7517' },
            { label:'À décaisser', value:depenses.filter(d=>d.statut==='VALIDEE').length, color:'#1a3f6f' },
            { label:'À justifier', value:depenses.filter(d=>d.statut==='PAYEE').length, color:'#0F6E56' },
            { label:'À clôturer', value:depenses.filter(d=>d.statut==='JUSTIFIEE').length, color:'#6B3FA0' },
          ].map((k,i)=>(
            <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ fontSize:18, color:k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {histo && (
        <>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12, alignItems:'end' }}>
            <div><label className="label">Du</label><input className="input" type="date" value={du} onChange={e=>setDu(e.target.value)}/></div>
            <div><label className="label">Au</label><input className="input" type="date" value={au} onChange={e=>setAu(e.target.value)}/></div>
            <button className="btn btn-ghost btn-sm" disabled={!depenses.length} onClick={()=>rapportDepensesExcel(depenses)}><FileText size={13}/> Rapport détaillé (Excel)</button>
            <div><label className="label">Catégorie</label>
              <select className="input" value={categorieFilter} onChange={e=>setCategorieFilter(e.target.value)}>
                <option value="">Toutes</option>{(Array.isArray(categories)?categories:[]).map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:12 }}>
            {[['Total', data?.total, '#8B1A1A'], ['Charges fixes', data?.totalFixes, '#1a3f6f'], ['Autres charges', data?.totalVariables, '#BA7517']].map(([l,v,c])=>(
              <div key={l} className="kpi" style={{ borderTop:`3px solid ${c}` }}><div className="kpi-label">{l}</div><div className="kpi-value" style={{ fontSize:18, color:c }}>{fmtFull(v)}</div></div>
            ))}
          </div>
        </>
      )}

      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
        {(histo ? [['','Toutes'],['CLOTUREE','Clôturées'],['REJETEE','Rejetées']] : [['','Toutes'],['BROUILLON','À valider'],['VALIDEE','À décaisser'],['PAYEE','À justifier'],['JUSTIFIEE','À clôturer']]).map(([k,v])=>(
          <button key={k} onClick={()=>setStatutFilter(k)} className={`filter-btn ${statutFilter===k?'active':''}`}
            style={{ background:statutFilter===k?'#8B1A1A':undefined, color:statutFilter===k?'white':undefined }}>{v}</button>
        ))}
        <span style={{ width:1, background:'#e8e7e1', margin:'0 4px' }}/>
        {[['','Fixes + autres'],['FIXE','Charges fixes'],['VARIABLE','Autres charges']].map(([k,v])=>(
          <button key={k} onClick={()=>setNatureFilter(k)} className={`filter-btn ${natureFilter===k?'active':''}`}
            style={{ background:natureFilter===k?'#1a3f6f':undefined, color:natureFilter===k?'white':undefined }}>{v}</button>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {depenses.map(d=>{
          const st = STATUT_CONFIG[d.statut] || STATUT_CONFIG.BROUILLON;
          const nt = NATURE[d.nature] || NATURE.VARIABLE;
          return (
            <div key={d.id} style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:10, padding:'10px 14px', display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 200px', minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, background:st.color+'18', color:st.color, borderRadius:10, padding:'1px 7px', fontWeight:500 }}>{st.label}</span>
                  <span style={{ fontSize:10, background:nt.color+'18', color:nt.color, borderRadius:10, padding:'1px 7px', fontWeight:500 }}>{nt.label}</span>
                  <span style={{ fontSize:11, color:'#888' }}>{d.categorie}{d.periode ? ` · ${d.periode}` : ''}</span>
                </div>
                <div style={{ fontWeight:500, fontSize:13 }}>{d.description}</div>
                {d.beneficiaire && <div style={{ fontSize:11, color:'#888' }}>{d.employeId ? 'Salarié' : 'Bénéficiaire'}: {d.beneficiaire}</div>}
                {d.notes && <div style={{ fontSize:11, color:'#aaa', fontStyle:'italic' }}>{d.notes}</div>}
                <div style={{ fontSize:10, color:'#999', marginTop:3, lineHeight:1.5 }}>
                  Émise par {d.creeParNom}
                  {d.valideParNom && ` · ${d.statut==='REJETEE'?'rejetée':'validée'} par ${d.valideParNom}`}
                  {d.payeParNom && ` · décaissée par ${d.payeParNom}${d.reference ? ` (réf. ${d.reference})` : ''}`}
                  {d.justifieParNom && ` · justifiée par ${d.justifieParNom}${d.montantJustifie!=null && d.montantJustifie!==d.montant ? ` (réel ${fmtFull(d.montantJustifie)})` : ''}`}
                  {d.clotureParNom && ` · clôturée par ${d.clotureParNom}`}
                </div>
                {d.motifRejet && <div style={{ fontSize:11, color:'#A32D2D' }}>Motif du rejet : {d.motifRejet}</div>}
                {d.noteJustification && <div style={{ fontSize:11, color:'#6B3FA0', fontStyle:'italic' }}>Justification : {d.noteJustification}</div>}
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:15, color:'#8B1A1A' }}>{fmtF(d.montant)}</div>
                <div style={{ fontSize:10, color:'#888' }}>{new Date(d.date||d.createdAt).toLocaleDateString('fr')}</div>
              </div>
              <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                <button className="btn btn-sm btn-ghost" style={{ fontSize:11, color:d.aRecu?'#27500A':'#888' }} onClick={()=>setRecuVu(d)} aria-label="Reçu">
                  {d.aRecu ? <FileText size={12}/> : <Paperclip size={12}/>} {d.aRecu ? 'Reçu' : saisir ? 'Ajouter reçu' : 'Pas de reçu'}
                </button>
                {['CLOTUREE','REJETEE'].includes(d.statut) && (
                  <button className="btn btn-sm btn-ghost" style={{ fontSize:11 }} onClick={async ()=>{ let r=''; if (d.aRecu) { try { r=(await yakroAPI.recuDepenseYakro(d.id)).recu; } catch {} } rapportDepensePDF(d, r, courant?.nom); }}>📄 Rapport PDF</button>
                )}
                {!histo && d.statut==='BROUILLON' && estDG && (<>
                  <button className="btn btn-sm" style={{ background:'#1a3f6f', color:'white', border:'none', fontSize:11 }} onClick={()=>validerMut.mutate(d.id)}><Check size={11}/> Valider</button>
                  <button className="btn btn-sm btn-ghost" style={{ fontSize:11, color:'#A32D2D' }} onClick={()=>setEtape({ type:'rejeter', depense:d })}>Rejeter</button>
                </>)}
                {!histo && d.statut==='VALIDEE' && peut('depenses.decaisser') && (
                  <button className="btn btn-sm" style={{ background:'#0F6E56', color:'white', border:'none', fontSize:11 }} onClick={()=>setEtape({ type:'payer', depense:d })}>Décaisser</button>
                )}
                {!histo && d.statut==='PAYEE' && (saisir || peut('depenses.decaisser')) && (
                  <button className="btn btn-sm" style={{ background:'#6B3FA0', color:'white', border:'none', fontSize:11 }} onClick={()=>setEtape({ type:'justifier', depense:d })}>Justifier</button>
                )}
                {!histo && d.statut==='JUSTIFIEE' && peut('depenses.cloturer') && (
                  <button className="btn btn-sm" style={{ background:'#27500A', color:'white', border:'none', fontSize:11 }} onClick={()=>cloturerMut.mutate(d.id)}><Check size={11}/> Clôturer</button>
                )}
              </div>
            </div>
          );
        })}
        {depenses.length===0 && <div className="empty-state"><p>Aucune dépense</p></div>}
      </div>

      {etape && <EtapeModal etape={etape.type} depense={etape.depense} onClose={()=>setEtape(null)} onDone={rafraichir}/>}
      {recuVu && <VoirRecu depense={recuVu} peutModifier={saisir && !['CLOTUREE','REJETEE'].includes(recuVu.statut)} onClose={()=>setRecuVu(null)} onChange={rafraichir}/>}

      {showCreate && (
        <div className="modal-overlay" onClick={()=>setShowCreate(false)}>
          <div className="modal" style={{ maxWidth:520 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16, color:'#8B1A1A' }}>💸 Nouvelle dépense</h3>
              <button onClick={()=>setShowCreate(false)} aria-label="Fermer" style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div className="form-grid">
              <div>
                <label className="label">Catégorie *</label>
                <select className="input" value={form.categorie} onChange={e=>choisirCategorie(e.target.value)}>
                  <option value="">— Choisir</option>
                  {(Array.isArray(categories)?categories:[]).map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Nature</label>
                <select className="input" value={form.nature || 'VARIABLE'} onChange={e=>set('nature',e.target.value)}>
                  <option value="FIXE">Charge fixe</option><option value="VARIABLE">Autre charge</option>
                </select>
              </div>
              {estSalaire && (
                <>
                  <div>
                    <label className="label">Salarié *</label>
                    <select className="input" value={form.employeId} onChange={e=>choisirEmploye(e.target.value)}>
                      <option value="">— Choisir le salarié</option>
                      {employes.map(e=><option key={e.id} value={e.id}>{e.prenom} {e.nom}{e.poste ? ` — ${e.poste}` : ''}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Mois du salaire</label><input className="input" type="month" value={form.periode} onChange={e=>set('periode',e.target.value)}/></div>
                  {salaire && (
                    <div className="full" style={{ background:'#FAF6F0', borderRadius:10, padding:10, fontSize:12, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, textAlign:'center' }}>
                      <div>Salaire de base<br/><b>{fmtFull(salaire.salaireBase)}</b></div>
                      <div>Déjà versé ({salaire.periode})<br/><b>{fmtFull(salaire.verse)}</b></div>
                      <div>Reste à payer<br/><b style={{ color:'#8B1A1A' }}>{fmtFull(salaire.reste)}</b>
                        {salaire.reste>0 && <button type="button" className="btn btn-sm btn-ghost" style={{ display:'block', margin:'4px auto 0', fontSize:11 }} onClick={()=>set('montant', salaire.reste)}>Tout payer</button>}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="label">Mode paiement</label>
                <select className="input" value={form.typePaiement} onChange={e=>set('typePaiement',e.target.value)}>
                  {MODES.map(m=><option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Montant (FCFA) *</label><input className="input" type="number" min="0" value={form.montant} onChange={e=>set('montant',e.target.value)}/>
                {depasse && <div style={{ fontSize:11, color:'#B97A18', marginTop:3 }}>Dépasse le reste à payer ({fmtFull(salaire.reste)}) : prime ou avance ?</div>}
              </div>
              <div className="full"><label className="label">Description *</label><input className="input" value={form.description} onChange={e=>set('description',e.target.value)}/></div>
              {!estSalaire && <div className="full"><label className="label">Bénéficiaire</label><input className="input" value={form.beneficiaire} onChange={e=>set('beneficiaire',e.target.value)}/></div>}
              <div className="full"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} style={{ resize:'vertical' }}/></div>
              <div className="full">
                <label className="label">Reçu (photo ou PDF)</label>
                <label className="btn btn-sm btn-ghost" style={{ cursor:'pointer' }}><Paperclip size={13}/> {form.recu ? 'Remplacer' : 'Joindre le reçu'}
                  <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; e.target.value=''; lireRecu(f, (r,n)=>setForm(x=>({...x,recu:r,recuNom:n})), setErreur); }}/>
                </label>
                {form.recu && <span style={{ fontSize:12, marginLeft:8 }}>✓ {form.recuNom} <button type="button" onClick={()=>setForm(x=>({...x,recu:'',recuNom:''}))} style={{ background:'none', border:'none', color:'#A32D2D', cursor:'pointer' }}>retirer</button></span>}
              </div>
            </div>
            {erreur && <p role="alert" style={{ color:'#A32D2D', fontSize:13, marginTop:10 }}>{erreur}</p>}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button className="btn btn-ghost" onClick={()=>setShowCreate(false)}>Annuler</button>
              <button className="btn btn-primary" disabled={!peutCreer} style={{ background:'#8B1A1A', border:'none' }}
                onClick={()=>{ setErreur(''); const { recuNom, ...d } = form; createMut.mutate({ ...d, nature: d.nature || undefined, montant:Number(d.montant), recu: d.recu || undefined, employeId: d.employeId || undefined }); }}>
                {createMut.isPending?'...':'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
