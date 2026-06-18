/**
 * TOPTELSIG — Gestion de Projet Foncier
 * Vue hiérarchique complète : Projet → Phase → Activité → Tâche → Livrable
 * Tout inline, tout modifiable, sans changer de page
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI } from '../../lib/api';
import GEDPanel from '../../components/ui/GEDPanel';
import {
  ChevronDown, ChevronRight, Plus, Edit2, Trash2, X,
  FileText, Target, CheckSquare, Square, AlertTriangle, Clock, Zap
} from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUT_PHASE = {
  A_FAIRE:  { color:'#888',    bg:'#F7F7F5', label:'À faire' },
  EN_COURS: { color:'#1a3f6f', bg:'#EEF3FB', label:'En cours' },
  BLOQUE:   { color:'#A32D2D', bg:'#FCEBEB', label:'Bloqué' },
  TERMINE:  { color:'#27500A', bg:'#EAF3DE', label:'Terminé' },
};
const STATUT_LIV_COLORS = {
  A_PRODUIRE:'#888', EN_COURS:'#1a3f6f', SOUMIS:'#BA7517',
  A_VALIDER:'#E87722', VALIDE:'#27500A', REFUSE:'#A32D2D', ARCHIVE:'#888'
};
const STATUT_TACHE = ['A_FAIRE','EN_COURS','EN_ATTENTE','TERMINEE','ANNULEE'];
const PRIORITES = ['HAUTE','NORMALE','BASSE'];
const TYPES_LIVRABLE = ['TITRE_FONCIER','ACD','PLAN_PARCELLAIRE','RAPPORT_TOPO','PV','CONTRAT','AUTORISATION','AUTRE'];
const PHASES_DEFAULT = [
  'Coutumier & Acquisition Foncière','Topographie & Études','Administratif & Dossiers',
  'Lotissement & Bornage','Ouverture de Voies & Viabilisation','DTC & Services Techniques',
  'Assainissement & Environnement','Enquêtes & Commissions','Travaux de Construction',
  'Transport & Déplacements','Personnel','Commercial & Marketing',
  'Fournitures & Fonctionnement','Frais Financiers','Autres Dépenses',
];
const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(2)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${Math.round(n||0)} F`;

// ── Mini formulaire inline ────────────────────────────────────────────────────
function InlineForm({ fields, onSave, onCancel, loading, defaultValues = {} }) {
  const [form, setForm] = useState(defaultValues);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const required = fields.filter(f => f.required);
  const valid = required.every(f => form[f.key]);

  return (
    <div style={{ background:'#F7F7F5', borderRadius:8, padding:10, marginTop:4 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:6, marginBottom:8 }}>
        {fields.map(f => (
          <div key={f.key}>
            <label style={{ fontSize:10, color:'#888', display:'block', marginBottom:2 }}>{f.label}{f.required?' *':''}</label>
            {f.type === 'select' ? (
              <select className="input" style={{ fontSize:11, padding:'4px 8px' }} value={form[f.key]||''} onChange={e=>set(f.key,e.target.value)}>
                <option value="">— Choisir —</option>
                {(f.options||[]).map(o=><option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
              </select>
            ) : f.type === 'checkbox' ? (
              <label style={{ display:'flex', alignItems:'center', gap:4, marginTop:4, fontSize:11 }}>
                <input type="checkbox" checked={!!form[f.key]} onChange={e=>set(f.key,e.target.checked)}/>
                Oui
              </label>
            ) : f.type === 'textarea' ? (
              <textarea className="input" style={{ fontSize:11, padding:'4px 8px', resize:'vertical', minHeight:50 }}
                value={form[f.key]||''} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder||''}/>
            ) : (
              <input className="input" type={f.type||'text'} style={{ fontSize:11, padding:'4px 8px' }}
                value={form[f.key]||''} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder||''}/>
            )}
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
        <button className="btn btn-ghost btn-xs" onClick={onCancel}>Annuler</button>
        <button className="btn btn-primary btn-xs" style={{ background:'#1a3f6f', border:'none' }}
          disabled={!valid||loading} onClick={()=>onSave(form)}>
          {loading ? '...' : '✓ Créer'}
        </button>
      </div>
    </div>
  );
}

// ── Tâche item ────────────────────────────────────────────────────────────────
function TacheItem({ tache, activiteId, projetId }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const retard = tache.dateEcheance && !tache.termine && new Date(tache.dateEcheance) < new Date();

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => toptelsigAPI.updateTache(id, data),
    onSuccess: () => qc.invalidateQueries(['gp-projet', projetId])
  });

  return (
    <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'6px 0', borderBottom:'0.5px solid #f0efe9' }}>
      <button style={{ background:'none', border:'none', cursor:'pointer', flexShrink:0, paddingTop:1 }}
        onClick={() => updateMut.mutate({ id: tache.id, data: { termine: !tache.termine, statut: !tache.termine ? 'TERMINEE' : 'EN_COURS' } })}>
        {tache.termine ? <CheckSquare size={14} color="#27500A"/> : <Square size={14} color="#888"/>}
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, textDecoration:tache.termine?'line-through':undefined, color:tache.termine?'#aaa':'#1a1a1a' }}>
          {tache.nom}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:2 }}>
          {tache.assigneNom && <span style={{ fontSize:10, color:'#888' }}>👤 {tache.assigneNom}</span>}
          {tache.dateEcheance && (
            <span style={{ fontSize:10, color:retard?'#A32D2D':'#888' }}>
              {retard ? '⚠ Retard' : '📅'} {new Date(tache.dateEcheance).toLocaleDateString('fr')}
            </span>
          )}
          {tache.description && <span style={{ fontSize:10, color:'#aaa', fontStyle:'italic' }}>{tache.description}</span>}
        </div>
      </div>
      <div style={{ display:'flex', gap:4, flexShrink:0 }}>
        <span style={{ fontSize:9, background:tache.priorite==='HAUTE'?'#FCEBEB':tache.priorite==='BASSE'?'#EAF3DE':'#F7F7F5', color:tache.priorite==='HAUTE'?'#A32D2D':tache.priorite==='BASSE'?'#27500A':'#888', borderRadius:4, padding:'1px 5px' }}>
          {tache.priorite}
        </span>
        <span style={{ fontSize:9, background:'#F7F7F5', color:'#888', borderRadius:4, padding:'1px 5px' }}>{tache.statut?.replace('_',' ')}</span>
      </div>
    </div>
  );
}

// ── Livrable item ─────────────────────────────────────────────────────────────
function LivrableItem({ livrable, projetId }) {
  const qc = useQueryClient();
  const [showGED, setShowGED] = useState(false);
  const retard = livrable.datePrevue && new Date(livrable.datePrevue) < new Date() && livrable.statut !== 'VALIDE';
  const color = STATUT_LIV_COLORS[livrable.statut] || '#888';

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => toptelsigAPI.updateLivrable(id, data),
    onSuccess: () => qc.invalidateQueries(['gp-projet', projetId])
  });

  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', padding:'6px 8px', background:'white', border:`0.5px solid ${retard?'#F7C1C1':'#e8e7e1'}`, borderRadius:7, marginBottom:3 }}>
      <FileText size={13} color={color} style={{ flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:500 }}>{livrable.nom}
          {livrable.obligatoire && <span style={{ fontSize:9, background:'#FCEBEB', color:'#A32D2D', borderRadius:4, padding:'1px 5px', marginLeft:5 }}>Obligatoire</span>}
          {retard && <span style={{ fontSize:9, background:'#FCEBEB', color:'#A32D2D', borderRadius:4, padding:'1px 5px', marginLeft:5 }}>⚠ En retard</span>}
        </div>
        <div style={{ fontSize:10, color:'#888' }}>
          {livrable.typeLivrable?.replace(/_/g,' ')} · v{livrable.version}
          {livrable.responsableNom && ` · ${livrable.responsableNom}`}
          {livrable.datePrevue && ` · prévu ${new Date(livrable.datePrevue).toLocaleDateString('fr')}`}
        </div>
      </div>
      <div style={{ display:'flex', gap:5, flexShrink:0 }}>
        <select style={{ fontSize:10, padding:'2px 6px', borderRadius:6, border:`1px solid ${color}40`, background:color+'10', color, cursor:'pointer' }}
          value={livrable.statut}
          onChange={e => updateMut.mutate({ id:livrable.id, data:{ statut:e.target.value } })}>
          {Object.keys(STATUT_LIV_COLORS).map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <button onClick={()=>setShowGED(!showGED)}
          style={{ fontSize:10, background:'#EEF3FB', border:'none', borderRadius:5, padding:'3px 7px', cursor:'pointer', color:'#1a3f6f' }}>
          📎
        </button>
      </div>
      {showGED && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={()=>setShowGED(false)}>
          <div style={{ background:'white', borderRadius:14, padding:20, width:540, maxHeight:'70vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
              <h4 style={{ margin:0, fontFamily:'Syne', fontSize:14 }}>📎 {livrable.nom}</h4>
              <button onClick={()=>setShowGED(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={16}/></button>
            </div>
            <GEDPanel entiteType="livrable" entiteId={livrable.id}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activité avec tâches + livrables ─────────────────────────────────────────
function ActiviteCard({ activite, phaseId, projetId, index }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showFormTache, setShowFormTache] = useState(false);
  const [showFormLivrable, setShowFormLivrable] = useState(false);

  const createTache = useMutation({
    mutationFn: toptelsigAPI.createTache,
    onSuccess: () => { qc.invalidateQueries(['gp-projet', projetId]); setShowFormTache(false); }
  });
  const createLivrable = useMutation({
    mutationFn: toptelsigAPI.createLivrable,
    onSuccess: () => { qc.invalidateQueries(['gp-projet', projetId]); setShowFormLivrable(false); }
  });
  const updateActivite = useMutation({
    mutationFn: ({ id, data }) => toptelsigAPI.updateActivite(id, data),
    onSuccess: () => qc.invalidateQueries(['gp-projet', projetId])
  });

  const tachesTerminees = activite.taches?.filter(t => t.termine).length || 0;
  const nbTaches = activite.taches?.length || 0;

  return (
    <div style={{ background:'#FAFAF8', border:'0.5px solid #e8e7e1', borderRadius:8, marginBottom:6, overflow:'hidden' }}>
      <div style={{ padding:'8px 12px', display:'flex', gap:8, alignItems:'center', cursor:'pointer' }}
        onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={13} color="#888"/> : <ChevronRight size={13} color="#888"/>}
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:500, fontSize:12 }}>{index}. {activite.nom}</span>
          <span style={{ fontSize:10, color:'#888', marginLeft:8 }}>
            {nbTaches > 0 && `${tachesTerminees}/${nbTaches} tâches`}
            {activite.livrables?.length > 0 && ` · ${activite.livrables.length} livrable(s)`}
          </span>
          {activite.responsableNom && <span style={{ fontSize:10, color:'#888', marginLeft:8 }}>👤 {activite.responsableNom}</span>}
        </div>
        <div style={{ display:'flex', gap:4 }} onClick={e=>e.stopPropagation()}>
          <select style={{ fontSize:10, padding:'2px 5px', borderRadius:5, border:'0.5px solid #ddd', background:'white', cursor:'pointer' }}
            value={activite.statut || 'A_FAIRE'}
            onChange={e => updateActivite.mutate({ id:activite.id, data:{ statut:e.target.value } })}>
            {['A_FAIRE','EN_COURS','BLOQUE','TERMINE'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
          <button className="btn btn-ghost btn-xs" title="Ajouter tâche" onClick={()=>{setOpen(true);setShowFormTache(true);}}>
            <Plus size={10}/> Tâche
          </button>
          <button className="btn btn-ghost btn-xs" title="Ajouter livrable" onClick={()=>{setOpen(true);setShowFormLivrable(true);}}>
            <Plus size={10}/> Livrable
          </button>
        </div>
      </div>

      {open && (
        <div style={{ padding:'4px 12px 10px 28px' }}>
          {/* Tâches */}
          {activite.taches?.map(t => (
            <TacheItem key={t.id} tache={t} activiteId={activite.id} projetId={projetId}/>
          ))}

          {showFormTache && (
            <InlineForm
              fields={[
                { key:'nom', label:'Nom tâche', required:true, placeholder:'Ex: Contacter le géomètre' },
                { key:'priorite', label:'Priorité', type:'select', options:PRIORITES },
                { key:'dateEcheance', label:'Échéance', type:'date' },
                { key:'assigneNom', label:'Assigné à', placeholder:'Nom responsable' },
                { key:'description', label:'Description', type:'textarea', placeholder:'Détails...' },
              ]}
              defaultValues={{ priorite:'NORMALE' }}
              loading={createTache.isPending}
              onCancel={() => setShowFormTache(false)}
              onSave={d => createTache.mutate({ ...d, activiteId: activite.id })}
            />
          )}

          {/* Livrables de l'activité */}
          {activite.livrables?.map(l => (
            <LivrableItem key={l.id} livrable={l} projetId={projetId}/>
          ))}

          {showFormLivrable && (
            <InlineForm
              fields={[
                { key:'nom', label:'Nom livrable', required:true },
                { key:'typeLivrable', label:'Type', type:'select', options:TYPES_LIVRABLE },
                { key:'datePrevue', label:'Date prévue', type:'date' },
                { key:'responsableNom', label:'Responsable' },
                { key:'obligatoire', label:'Obligatoire', type:'checkbox' },
              ]}
              defaultValues={{ typeLivrable:'AUTRE' }}
              loading={createLivrable.isPending}
              onCancel={() => setShowFormLivrable(false)}
              onSave={d => createLivrable.mutate({ ...d, phaseId })}
            />
          )}

          {activite.taches?.length === 0 && !showFormTache && (
            <button className="btn btn-ghost btn-xs" style={{ marginTop:4, color:'#888' }}
              onClick={() => setShowFormTache(true)}>
              <Plus size={10}/> Ajouter une tâche
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Phase accordion ───────────────────────────────────────────────────────────
function PhaseCard({ phase, index, projetId }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showFormActivite, setShowFormActivite] = useState(false);
  const [showFormLivrable, setShowFormLivrable] = useState(false);
  const [editingProgress, setEditingProgress] = useState(false);
  const [progress, setProgress] = useState(phase.avancement || 0);

  const st = STATUT_PHASE[phase.statut] || STATUT_PHASE.A_FAIRE;
  const nbLivOblNonValides = phase.livrables?.filter(l => l.obligatoire && l.statut !== 'VALIDE').length || 0;
  const nbLivValides = phase.livrables?.filter(l => l.statut === 'VALIDE').length || 0;

  const updatePhase = useMutation({
    mutationFn: ({ id, data }) => toptelsigAPI.updatePhase(id, data),
    onSuccess: () => qc.invalidateQueries(['gp-projet', projetId])
  });
  const createActivite = useMutation({
    mutationFn: toptelsigAPI.createActivite,
    onSuccess: () => { qc.invalidateQueries(['gp-projet', projetId]); setShowFormActivite(false); }
  });
  const createLivrable = useMutation({
    mutationFn: toptelsigAPI.createLivrable,
    onSuccess: () => { qc.invalidateQueries(['gp-projet', projetId]); setShowFormLivrable(false); }
  });

  return (
    <div style={{ marginBottom:10, border:`1.5px solid ${open ? st.color+'50' : '#e8e7e1'}`, borderRadius:12, overflow:'hidden', transition:'border-color 0.2s' }}>
      {/* Header phase */}
      <div style={{ background: open ? st.bg : 'white', padding:'12px 16px', display:'flex', gap:10, alignItems:'center', cursor:'pointer' }}
        onClick={()=>setOpen(!open)}>
        {open ? <ChevronDown size={16} color={st.color}/> : <ChevronRight size={16} color="#888"/>}
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, color: open ? st.color : '#1a1a1a' }}>
              {index}. {phase.nom}
            </span>
            <span style={{ fontSize:10, background:st.color+'18', color:st.color, borderRadius:10, padding:'1px 7px' }}>{st.label}</span>
            {nbLivOblNonValides > 0 && (
              <span style={{ fontSize:10, background:'#FCEBEB', color:'#A32D2D', borderRadius:10, padding:'1px 7px' }}>
                ⚠ {nbLivOblNonValides} livrable(s) requis
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:10, marginTop:3, fontSize:10, color:'#888' }}>
            <span>{phase.activites?.length||0} activité(s)</span>
            <span>{nbLivValides}/{phase.livrables?.length||0} livrables validés</span>
            {phase.responsableNom && <span>👤 {phase.responsableNom}</span>}
            {phase.budgetPrevu && <span>Budget: {fmtF(phase.budgetPrevu)}</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }} onClick={e=>e.stopPropagation()}>
          {/* Avancement */}
          <div style={{ width:80 }}>
            {editingProgress ? (
              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                <input type="number" min={0} max={100} value={progress}
                  onChange={e=>setProgress(Number(e.target.value))}
                  style={{ width:45, fontSize:11, padding:'2px 4px', border:'1px solid #1a3f6f', borderRadius:4 }}
                  onClick={e=>e.stopPropagation()}/>
                <button className="btn btn-xs" style={{ background:'#1a3f6f', color:'white', border:'none', borderRadius:4, padding:'2px 6px', cursor:'pointer', fontSize:10 }}
                  onClick={() => { updatePhase.mutate({ id:phase.id, data:{ avancement:progress } }); setEditingProgress(false); }}>✓</button>
              </div>
            ) : (
              <div style={{ cursor:'pointer' }} onClick={()=>setEditingProgress(true)} title="Cliquer pour modifier">
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#888', marginBottom:2 }}>
                  <span>{phase.avancement}%</span><span style={{ color:'#1a3f6f', fontSize:8 }}>✏</span>
                </div>
                <div style={{ height:5, background:'#e8e7e1', borderRadius:3 }}>
                  <div style={{ height:'100%', width:`${phase.avancement||0}%`, background:st.color, borderRadius:3 }}/>
                </div>
              </div>
            )}
          </div>
          {/* Statut */}
          <select style={{ fontSize:10, padding:'3px 6px', borderRadius:6, border:'0.5px solid #ddd', cursor:'pointer' }}
            value={phase.statut}
            onChange={e => updatePhase.mutate({ id:phase.id, data:{ statut:e.target.value } })}>
            {Object.entries(STATUT_PHASE).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* Contenu accordéon */}
      {open && (
        <div style={{ padding:'12px 16px' }}>
          {/* Boutons actions phase */}
          <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
            <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={()=>setShowFormActivite(true)}>
              <Plus size={11}/> Activité
            </button>
            <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={()=>setShowFormLivrable(true)}>
              <Plus size={11}/> Livrable de phase
            </button>
          </div>

          {/* Formulaire activité inline */}
          {showFormActivite && (
            <div style={{ marginBottom:12 }}>
              <InlineForm
                fields={[
                  { key:'nom', label:'Nom activité', required:true, placeholder:'Ex: Délimitation terrain' },
                  { key:'dateDebut', label:'Date début', type:'date' },
                  { key:'dateFin', label:'Date fin', type:'date' },
                  { key:'responsableNom', label:'Responsable', placeholder:'Nom' },
                ]}
                loading={createActivite.isPending}
                onCancel={()=>setShowFormActivite(false)}
                onSave={d => createActivite.mutate({ ...d, phaseId: phase.id })}
              />
            </div>
          )}

          {/* Livrables de la phase (pas liés à une activité spécifique) */}
          {phase.livrables?.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:'#888', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>
                📎 Livrables de la phase
              </div>
              {phase.livrables.map(l => <LivrableItem key={l.id} livrable={l} projetId={projetId}/>)}
            </div>
          )}

          {/* Formulaire livrable de phase */}
          {showFormLivrable && (
            <div style={{ marginBottom:12 }}>
              <InlineForm
                fields={[
                  { key:'nom', label:'Nom livrable', required:true },
                  { key:'typeLivrable', label:'Type', type:'select', options:TYPES_LIVRABLE },
                  { key:'datePrevue', label:'Date prévue', type:'date' },
                  { key:'responsableNom', label:'Responsable' },
                  { key:'obligatoire', label:'Obligatoire', type:'checkbox' },
                ]}
                defaultValues={{ typeLivrable:'AUTRE' }}
                loading={createLivrable.isPending}
                onCancel={()=>setShowFormLivrable(false)}
                onSave={d => createLivrable.mutate({ ...d, phaseId: phase.id })}
              />
            </div>
          )}

          {/* Activités */}
          {phase.activites?.map((act, ai) => (
            <ActiviteCard
              key={act.id}
              activite={act}
              phaseId={phase.id}
              projetId={projetId}
              index={`${index}.${ai+1}`}
            />
          ))}

          {phase.activites?.length === 0 && !showFormActivite && (
            <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'12px 0' }}>
              Aucune activité — <button style={{ color:'#1a3f6f', background:'none', border:'none', cursor:'pointer', fontSize:12, textDecoration:'underline' }} onClick={()=>setShowFormActivite(true)}>Ajouter une activité</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────────────────
export default function GestionProjetPage() {
  const qc = useQueryClient();
  const [projetId, setProjetId] = useState('');
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg, t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3000); };

  const { data: projets = [] } = useQuery({
    queryKey: ['projets'],
    queryFn: toptelsigAPI.projets,
    staleTime: 60000,
  });

  const pid = projetId || projets[0]?.id;

  const { data: phases = [], isLoading } = useQuery({
    queryKey: ['gp-projet', pid],
    queryFn: async () => {
      if (!pid) return [];
      const data = await toptelsigAPI.gestionProjet(pid);
      return data?.phases || [];
    },
    enabled: !!pid,
    staleTime: 15000,
  });

  const projet = projets.find(p => p.id === pid);

  const createPhase = useMutation({
    mutationFn: toptelsigAPI.createPhase,
    onSuccess: () => { qc.invalidateQueries(['gp-projet', pid]); setShowAddPhase(false); showToast('Phase créée ✓'); }
  });
  const seedPhases = useMutation({
    mutationFn: () => toptelsigAPI.seedPhasesProjet(pid),
    onSuccess: r => { qc.invalidateQueries(['gp-projet', pid]); showToast(r.message || `${r.created} phases créées`); }
  });

  // Stats rapides
  const nbPhases = phases.length;
  const nbTerminees = phases.filter(p => p.statut === 'TERMINE').length;
  const nbActivites = phases.reduce((s, p) => s + (p.activites?.length || 0), 0);
  const nbTaches = phases.reduce((s, p) => s + p.activites?.reduce((a, ac) => a + (ac.taches?.length || 0), 0), 0);
  const nbLivrables = phases.reduce((s, p) => s + (p.livrables?.length || 0) + p.activites?.reduce((a, ac) => a + (ac.livrables?.length || 0), 0), 0);
  const avancementMoyen = phases.length > 0 ? Math.round(phases.reduce((s, p) => s + (p.avancement || 0), 0) / phases.length) : 0;

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#1a3f6f' }}>
            📋 Gestion de Projet Foncier
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            Phases · Activités · Tâches · Livrables · GED
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select className="input" style={{ width:220 }} value={projetId} onChange={e=>setProjetId(e.target.value)}>
            {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          {pid && !isLoading && phases.length === 0 && (
            <button className="btn btn-primary btn-sm" style={{ background:'#E87722', border:'none' }}
              disabled={seedPhases.isPending} onClick={() => seedPhases.mutate()}>
              <Zap size={13}/> {seedPhases.isPending ? '...' : '15 phases standard'}
            </button>
          )}
          {pid && (
            <button className="btn btn-ghost btn-sm" onClick={()=>setShowAddPhase(!showAddPhase)}>
              <Plus size={13}/> Phase personnalisée
            </button>
          )}
        </div>
      </div>

      {/* KPI rapides */}
      {phases.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))', gap:8, marginBottom:16 }}>
          {[
            { label:'Phases', value:`${nbTerminees}/${nbPhases}`, sub:'terminées', color:'#1a3f6f' },
            { label:'Avancement', value:`${avancementMoyen}%`, sub:'moyen', color:'#E87722' },
            { label:'Activités', value:nbActivites, color:'#1a3f6f' },
            { label:'Tâches', value:nbTaches, color:'#888' },
            { label:'Livrables', value:nbLivrables, color:'#BA7517' },
            { label:'Projet', value:projet?.nom?.slice(0,12) || '—', sub:projet?.statut, color:'#1a3f6f' },
          ].map((k,i) => (
            <div key={i} style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:8, padding:'8px 12px', borderTop:`3px solid ${k.color}` }}>
              <div style={{ fontSize:10, color:'#888' }}>{k.label}</div>
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:16, color:k.color }}>{k.value}</div>
              {k.sub && <div style={{ fontSize:9, color:'#aaa' }}>{k.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Formulaire nouvelle phase personnalisée */}
      {showAddPhase && pid && (
        <div style={{ marginBottom:16 }}>
          <InlineForm
            fields={[
              { key:'nom', label:'Nom de la phase', required:true },
              { key:'ordre', label:'Ordre', type:'number', placeholder:'1' },
              { key:'dateDebut', label:'Date début', type:'date' },
              { key:'dateFin', label:'Date fin', type:'date' },
              { key:'budgetPrevu', label:'Budget (FCFA)', type:'number' },
              { key:'responsableNom', label:'Responsable' },
            ]}
            loading={createPhase.isPending}
            onCancel={()=>setShowAddPhase(false)}
            onSave={d => createPhase.mutate({ ...d, projetId: pid, ordre: Number(d.ordre) || 1 })}
          />
        </div>
      )}

      {/* Liste phases */}
      {isLoading && (
        <div style={{ textAlign:'center', padding:40, color:'#888' }}>Chargement des phases...</div>
      )}

      {!isLoading && !pid && (
        <div className="empty-state"><Target size={40}/><p>Sélectionner un projet</p></div>
      )}

      {!isLoading && pid && phases.length === 0 && !showAddPhase && (
        <div className="empty-state">
          <Target size={40}/>
          <p style={{ marginBottom:8 }}>Aucune phase pour ce projet</p>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
              disabled={seedPhases.isPending} onClick={()=>seedPhases.mutate()}>
              <Zap size={13}/> Créer les 15 phases standard
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setShowAddPhase(true)}>
              <Plus size={13}/> Phase personnalisée
            </button>
          </div>
        </div>
      )}

      {phases.map((phase, i) => (
        <PhaseCard key={phase.id} phase={phase} index={i+1} projetId={pid}/>
      ))}

      {toast && (
        <div style={{ position:'fixed', bottom:20, right:16, background:toast.t==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
