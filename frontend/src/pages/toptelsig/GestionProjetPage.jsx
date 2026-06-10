/**
 * TOPTELSIG — Gestion de Projet Foncier
 * Vue hiérarchique : Projet → Phase → Activité → Tâche → Livrable
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toptelsigAPI } from '../../lib/api';
import GEDPanel from '../../components/ui/GEDPanel';
import {
  ChevronDown, ChevronRight, Plus, Edit2, Trash2, X, CheckCircle,
  AlertTriangle, Clock, FileText, Target, Users, TrendingUp, Package
} from 'lucide-react';

const STATUT_PHASE = {
  A_FAIRE: { color:'#888', label:'À faire', bg:'#F7F7F5' },
  EN_COURS: { color:'#1a3f6f', label:'En cours', bg:'#EEF3FB' },
  BLOQUE: { color:'#A32D2D', label:'Bloqué', bg:'#FCEBEB' },
  TERMINE: { color:'#27500A', label:'Terminé', bg:'#EAF3DE' },
};
const STATUT_LIVRABLE = {
  A_PRODUIRE: { color:'#888', label:'À produire' },
  EN_COURS: { color:'#1a3f6f', label:'En cours' },
  SOUMIS: { color:'#BA7517', label:'Soumis' },
  A_VALIDER: { color:'#E87722', label:'À valider' },
  VALIDE: { color:'#27500A', label:'Validé ✓' },
  REFUSE: { color:'#A32D2D', label:'Refusé' },
  ARCHIVE: { color:'#888', label:'Archivé' },
};
const TYPES_LIVRABLE = ['TITRE_FONCIER','ACD','PLAN_PARCELLAIRE','RAPPORT_TOPO','PV','CONTRAT','AUTORISATION','AUTRE'];
const PRIORITES = ['HAUTE','NORMALE','BASSE'];
const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(2)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${Math.round(n||0)} F`;

// ── Barre de progression ─────────────────────────────────────────────────────
function ProgressBar({ value, color='#1a3f6f', height=6 }) {
  return (
    <div style={{ height, background:'#F7F7F5', borderRadius:height/2 }}>
      <div style={{ height:'100%', width:`${Math.min(value||0,100)}%`, background:color, borderRadius:height/2, transition:'width 0.5s ease' }}/>
    </div>
  );
}

// ── Livrable item ────────────────────────────────────────────────────────────
function LivrableItem({ livrable, projetId, onUpdate }) {
  const [showGED, setShowGED] = useState(false);
  const st = STATUT_LIVRABLE[livrable.statut] || STATUT_LIVRABLE.A_PRODUIRE;
  return (
    <div style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 10px', background:'white', border:'0.5px solid #e8e7e1', borderRadius:8, marginBottom:4 }}>
      <FileText size={14} color={st.color} style={{ flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
          {livrable.nom}
          {livrable.obligatoire && <span style={{ fontSize:9, background:'#FCEBEB', color:'#A32D2D', borderRadius:4, padding:'1px 5px' }}>Obligatoire</span>}
        </div>
        <div style={{ fontSize:10, color:'#888' }}>
          {livrable.typeLivrable} · v{livrable.version}
          {livrable.datePrevue && ` · prévu ${new Date(livrable.datePrevue).toLocaleDateString('fr')}`}
          {livrable.responsableNom && ` · ${livrable.responsableNom}`}
        </div>
      </div>
      <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
        <select style={{ fontSize:10, padding:'3px 6px', borderRadius:6, border:`1px solid ${st.color}40`, background:st.color+'10', color:st.color, cursor:'pointer' }}
          value={livrable.statut}
          onChange={e => onUpdate(livrable.id, { statut: e.target.value, dateLivraison: e.target.value === 'VALIDE' ? new Date().toISOString() : undefined })}>
          {Object.entries(STATUT_LIVRABLE).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setShowGED(!showGED)} style={{ background:'#EEF3FB', border:'none', borderRadius:6, padding:'4px 7px', cursor:'pointer', fontSize:10, color:'#1a3f6f' }}>
          📎 GED
        </button>
      </div>
      {showGED && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setShowGED(false)}>
          <div style={{ background:'white', borderRadius:14, padding:20, width:520, maxHeight:'70vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
              <h4 style={{ margin:0, fontFamily:'Syne', fontSize:14 }}>📎 Documents — {livrable.nom}</h4>
              <button onClick={() => setShowGED(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={16}/></button>
            </div>
            <GEDPanel entiteType="livrable" entiteId={livrable.id}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function GestionProjetPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [projetFilter, setProjetFilter] = useState('');
  const [openPhases, setOpenPhases] = useState({});
  const [openActivites, setOpenActivites] = useState({});
  const [showModalPhase, setShowModalPhase] = useState(null); // { projetId } ou { phase }
  const [showModalActivite, setShowModalActivite] = useState(null);
  const [showModalLivrable, setShowModalLivrable] = useState(null);
  const [showModalTache, setShowModalTache] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg, t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3000); };

  const { data: projets = [] } = useQuery({
    queryKey: ['projets'],
    queryFn: toptelsigAPI.projets,
    staleTime: 30000,
  });

  const projetActif = projetFilter || projets[0]?.id;

  const { data: projetDetail, isLoading } = useQuery({
    queryKey: ['projet-detail', projetActif],
    queryFn: () => toptelsigAPI.gestionProjet(projetActif),
    enabled: !!projetActif,
    staleTime: 15000,
  });

  const { data: dashProjet } = useQuery({
    queryKey: ['dash-projet', projetActif],
    queryFn: () => toptelsigAPI.dashboardProjet(projetActif),
    enabled: !!projetActif,
    staleTime: 30000,
  });

  const createPhase = useMutation({ mutationFn: toptelsigAPI.createPhase, onSuccess: () => { qc.invalidateQueries(['projet-detail', projetActif]); setShowModalPhase(null); showToast('Phase créée'); } });
  const updatePhase = useMutation({ mutationFn: ({ id, data }) => toptelsigAPI.updatePhase(id, data), onSuccess: () => qc.invalidateQueries(['projet-detail', projetActif]) });
  const createActivite = useMutation({ mutationFn: toptelsigAPI.createActivite, onSuccess: () => { qc.invalidateQueries(['projet-detail', projetActif]); setShowModalActivite(null); showToast('Activité créée'); } });
  const createLivrable = useMutation({ mutationFn: toptelsigAPI.createLivrable, onSuccess: () => { qc.invalidateQueries(['projet-detail', projetActif]); setShowModalLivrable(null); showToast('Livrable créé'); } });
  const updateLivrable = useMutation({ mutationFn: ({ id, data }) => toptelsigAPI.updateLivrable(id, data), onSuccess: () => qc.invalidateQueries(['projet-detail', projetActif]) });
  const createTache = useMutation({ mutationFn: toptelsigAPI.createTache, onSuccess: () => { qc.invalidateQueries(['projet-detail', projetActif]); setShowModalTache(null); showToast('Tâche créée'); } });

  const togglePhase = id => setOpenPhases(p => ({ ...p, [id]: !p[id] }));
  const toggleActivite = id => setOpenActivites(p => ({ ...p, [id]: !p[id] }));

  const phases = projetDetail?.phases || [];
  const d = dashProjet;

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#1a3f6f' }}>
            📋 Gestion de Projet Foncier
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Phases · Activités · Tâches · Livrables · GED</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select className="input" style={{ width:220 }} value={projetFilter} onChange={e => setProjetFilter(e.target.value)}>
            <option value="">— Choisir un projet —</option>
            {projets.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
          </select>
          {projetActif && (
            <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
              onClick={() => setShowModalPhase({ projetId: projetActif })}>
              <Plus size={13}/> Phase
            </button>
          )}
        </div>
      </div>

      {/* Dashboard projet */}
      {d && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20 }}>
          {[
            { label:'CA encaissé', value:fmtF(d.ca?.realise||0), sub:`${d.ca?.tauxEncaissement||0}% du CA prévu`, color:'#27500A' },
            { label:'Dépenses', value:fmtF(d.depenses?.total||0), sub:`Budget: ${fmtF(d.depenses?.budget||0)}`, color:'#A32D2D' },
            { label:'Résultat brut', value:fmtF(d.resultat?.brut||0), sub:`Marge: ${d.resultat?.marge||0}%`, color:d.resultat?.brut>=0?'#1a3f6f':'#A32D2D' },
            { label:'Lots vendus', value:`${d.lots?.vendus||0}/${d.lots?.total||0}`, sub:`${d.lots?.tauxVente||0}% du parc`, color:'#1a3f6f' },
            { label:'Avancement', value:`${d.projet?.avancement||0}%`, sub:`${phases.length} phase(s)`, color:'#E87722' },
          ].map((k,i) => (
            <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ fontSize:18, color:k.color }}>{k.value}</div>
              <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Phases */}
      {isLoading && <div style={{ textAlign:'center', padding:40, color:'#888' }}>Chargement du projet...</div>}
      {!isLoading && !projetActif && (
        <div className="empty-state"><Target size={40}/><p>Sélectionner un projet pour voir ses phases</p></div>
      )}

      {phases.map((phase, pi) => {
        const st = STATUT_PHASE[phase.statut] || STATUT_PHASE.A_FAIRE;
        const isOpen = openPhases[phase.id] !== false; // ouvert par défaut
        const nbLivOk = phase.livrables?.filter(l=>l.statut==='VALIDE').length || 0;
        const nbLivTotal = phase.livrables?.length || 0;
        const nbLivObl = phase.livrables?.filter(l=>l.obligatoire && l.statut !== 'VALIDE').length || 0;

        return (
          <div key={phase.id} style={{ marginBottom:12, border:`1.5px solid ${st.color}30`, borderRadius:12, overflow:'hidden' }}>
            {/* Header phase */}
            <div style={{ background:st.bg, padding:'12px 16px', display:'flex', gap:10, alignItems:'center', cursor:'pointer' }}
              onClick={() => togglePhase(phase.id)}>
              {isOpen ? <ChevronDown size={16} color={st.color}/> : <ChevronRight size={16} color={st.color}/>}
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, color:st.color }}>
                    {pi+1}. {phase.nom}
                  </span>
                  <span style={{ fontSize:10, background:st.color+'20', color:st.color, borderRadius:10, padding:'2px 8px' }}>{st.label}</span>
                  {nbLivObl > 0 && <span style={{ fontSize:10, background:'#FCEBEB', color:'#A32D2D', borderRadius:10, padding:'2px 8px' }}>⚠ {nbLivObl} livrable(s) requis</span>}
                </div>
                <div style={{ display:'flex', gap:12, marginTop:4 }}>
                  <span style={{ fontSize:10, color:'#888' }}>{phase.activites?.length||0} activité(s)</span>
                  <span style={{ fontSize:10, color:'#888' }}>{nbLivOk}/{nbLivTotal} livrables validés</span>
                  {phase.responsableNom && <span style={{ fontSize:10, color:'#888' }}>👤 {phase.responsableNom}</span>}
                  {phase.budgetPrevu && <span style={{ fontSize:10, color:'#888' }}>Budget: {fmtF(phase.budgetPrevu)}</span>}
                </div>
              </div>

              {/* Contrôles phase */}
              <div style={{ display:'flex', gap:6, alignItems:'center' }} onClick={e=>e.stopPropagation()}>
                <div style={{ width:80 }}>
                  <div style={{ fontSize:9, color:'#888', textAlign:'right', marginBottom:2 }}>{phase.avancement}%</div>
                  <ProgressBar value={phase.avancement} color={st.color}/>
                </div>
                <select style={{ fontSize:10, padding:'3px 6px', borderRadius:6, border:'0.5px solid #ddd', background:'white', cursor:'pointer' }}
                  value={phase.statut}
                  onChange={e => updatePhase.mutate({ id:phase.id, data:{ statut:e.target.value } })}>
                  {Object.entries(STATUT_PHASE).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <button className="btn btn-ghost btn-xs" onClick={() => setShowModalActivite({ phaseId:phase.id })} title="Ajouter activité">
                  <Plus size={11}/>
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => setShowModalLivrable({ phaseId:phase.id })} title="Ajouter livrable">
                  <FileText size={11}/>
                </button>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding:'12px 16px' }}>
                {/* Livrables de la phase */}
                {phase.livrables?.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#888', marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>
                      📎 Livrables ({phase.livrables.length})
                    </div>
                    {phase.livrables.map(l => (
                      <LivrableItem key={l.id} livrable={l} projetId={projetActif}
                        onUpdate={(id, data) => updateLivrable.mutate({ id, data })}/>
                    ))}
                  </div>
                )}

                {/* Activités */}
                {phase.activites?.map((act, ai) => (
                  <div key={act.id} style={{ marginBottom:8, background:'#FAFAF8', borderRadius:8, border:'0.5px solid #e8e7e1', overflow:'hidden' }}>
                    <div style={{ padding:'8px 12px', display:'flex', gap:8, alignItems:'center', cursor:'pointer' }}
                      onClick={() => toggleActivite(act.id)}>
                      {openActivites[act.id] ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                      <div style={{ flex:1 }}>
                        <span style={{ fontWeight:500, fontSize:12 }}>{pi+1}.{ai+1} {act.nom}</span>
                        <span style={{ fontSize:10, color:'#888', marginLeft:8 }}>{act.taches?.length||0} tâche(s)</span>
                        {act.responsableNom && <span style={{ fontSize:10, color:'#888', marginLeft:8 }}>· {act.responsableNom}</span>}
                      </div>
                      <div style={{ display:'flex', gap:4 }} onClick={e=>e.stopPropagation()}>
                        <span style={{ fontSize:9, color:'#888' }}>{act.avancement}%</span>
                        <button className="btn btn-ghost btn-xs" onClick={() => setShowModalTache({ activiteId:act.id })}><Plus size={10}/></button>
                      </div>
                    </div>

                    {openActivites[act.id] && act.taches?.length > 0 && (
                      <div style={{ padding:'4px 12px 8px 32px' }}>
                        {act.taches.map(t => (
                          <div key={t.id} style={{ display:'flex', gap:8, alignItems:'center', padding:'4px 0', borderBottom:'0.5px solid #f0efe9' }}>
                            <input type="checkbox" checked={t.termine} readOnly style={{ cursor:'default' }}/>
                            <span style={{ fontSize:11, flex:1, textDecoration:t.termine?'line-through':undefined, color:t.termine?'#aaa':undefined }}>{t.nom}</span>
                            {t.dateEcheance && <span style={{ fontSize:10, color: new Date(t.dateEcheance)<new Date()&&!t.termine?'#A32D2D':'#888' }}>{new Date(t.dateEcheance).toLocaleDateString('fr')}</span>}
                            {t.assigneNom && <span style={{ fontSize:10, color:'#888' }}>👤 {t.assigneNom}</span>}
                            <span style={{ fontSize:9, background:t.priorite==='HAUTE'?'#FCEBEB':'#F7F7F5', color:t.priorite==='HAUTE'?'#A32D2D':'#888', borderRadius:4, padding:'1px 5px' }}>{t.priorite}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {phase.activites?.length === 0 && (
                  <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'16px 0' }}>
                    Aucune activité — <button className="btn btn-ghost btn-xs" onClick={() => setShowModalActivite({ phaseId:phase.id })}>Ajouter une activité</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!isLoading && projetActif && phases.length === 0 && (
        <div className="empty-state">
          <Target size={40}/>
          <p>Aucune phase définie pour ce projet</p>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none', marginTop:8 }}
            onClick={() => setShowModalPhase({ projetId: projetActif })}>
            <Plus size={13}/> Créer la première phase
          </button>
        </div>
      )}

      {/* Modals */}
      {showModalPhase && <ModalSimple title="Nouvelle phase" fields={[
        { key:'nom', label:'Nom *', type:'text' },
        { key:'ordre', label:'Ordre', type:'number' },
        { key:'dateDebut', label:'Date début', type:'date' },
        { key:'dateFin', label:'Date fin prévue', type:'date' },
        { key:'budgetPrevu', label:'Budget prévu (FCFA)', type:'number' },
        { key:'responsableNom', label:'Responsable', type:'text' },
      ]} onClose={() => setShowModalPhase(null)} loading={createPhase.isPending}
        onSave={d => createPhase.mutate({ ...d, projetId: showModalPhase.projetId })}/>}

      {showModalActivite && <ModalSimple title="Nouvelle activité" fields={[
        { key:'nom', label:'Nom *', type:'text' },
        { key:'dateDebut', label:'Date début', type:'date' },
        { key:'dateFin', label:'Date fin', type:'date' },
        { key:'responsableNom', label:'Responsable', type:'text' },
      ]} onClose={() => setShowModalActivite(null)} loading={createActivite.isPending}
        onSave={d => createActivite.mutate({ ...d, phaseId: showModalActivite.phaseId })}/>}

      {showModalLivrable && <ModalSimple title="Nouveau livrable" fields={[
        { key:'nom', label:'Nom *', type:'text' },
        { key:'typeLivrable', label:'Type', type:'select', options: TYPES_LIVRABLE },
        { key:'datePrevue', label:'Date prévue', type:'date' },
        { key:'responsableNom', label:'Responsable', type:'text' },
        { key:'obligatoire', label:'Obligatoire', type:'checkbox' },
      ]} onClose={() => setShowModalLivrable(null)} loading={createLivrable.isPending}
        onSave={d => createLivrable.mutate({ ...d, phaseId: showModalLivrable.phaseId })}/>}

      {showModalTache && <ModalSimple title="Nouvelle tâche" fields={[
        { key:'nom', label:'Nom *', type:'text' },
        { key:'priorite', label:'Priorité', type:'select', options: PRIORITES },
        { key:'dateEcheance', label:'Échéance', type:'date' },
        { key:'assigneNom', label:'Assigné à', type:'text' },
        { key:'description', label:'Description', type:'textarea' },
      ]} onClose={() => setShowModalTache(null)} loading={createTache.isPending}
        onSave={d => createTache.mutate({ ...d, activiteId: showModalTache.activiteId })}/>}

      {toast && <div style={{ position:'fixed', bottom:20, right:16, background:toast.t==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>{toast.msg}</div>}
    </div>
  );
}

// ── Modal générique ──────────────────────────────────────────────────────────
function ModalSimple({ title, fields, onClose, onSave, loading }) {
  const [form, setForm] = useState(() => fields.reduce((acc, f) => ({ ...acc, [f.key]: f.default || '' }), {}));
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const requiredFields = fields.filter(f => f.label.includes('*'));
  const isValid = requiredFields.every(f => form[f.key]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div className="form-grid">
          {fields.map(f => (
            <div key={f.key} className={f.type === 'textarea' ? 'full' : ''}>
              <label className="label">{f.label}</label>
              {f.type === 'select' ? (
                <select className="input" value={form[f.key]} onChange={e => set(f.key, e.target.value)}>
                  <option value="">— Choisir —</option>
                  {(f.options || []).map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
                </select>
              ) : f.type === 'checkbox' ? (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                  <input type="checkbox" checked={!!form[f.key]} onChange={e => set(f.key, e.target.checked)} style={{ width:16, height:16 }}/>
                  <span style={{ fontSize:12, color:'#555' }}>Oui</span>
                </div>
              ) : f.type === 'textarea' ? (
                <textarea className="input" value={form[f.key]} onChange={e => set(f.key, e.target.value)} rows={3} style={{ resize:'vertical' }}/>
              ) : (
                <input className="input" type={f.type||'text'} value={form[f.key]} onChange={e => set(f.key, e.target.value)}/>
              )}
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!isValid || loading}
            style={{ background:'#1a3f6f', border:'none' }} onClick={() => onSave(form)}>
            {loading ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
