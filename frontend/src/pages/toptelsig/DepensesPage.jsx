/**
 * TOPTELSIG — Dépenses Foncières
 * Module enrichi : cascade Projet→Phase→Activité, bénéficiaire typé, workflow complet
 */
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { depensesAPIv2, toptelsigAPI, employesAPI, documentsAPI } from '../../lib/api';
import { Plus, X, Check, Upload, FileText, Eye, ChevronDown, ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

// ── Constantes ────────────────────────────────────────────────────────────────
const COULEURS = ['#1a3f6f','#E87722','#8B1A1A','#E85D04','#27500A','#BA7517','#639922','#888'];

const TYPES_BENEFICIAIRES = [
  'Employé','Propriétaire terrien','Exploitant agricole','Occupant',
  'Autorité coutumière','Administration publique','Fournisseur','Entreprise',
  "Bureau d'étude",'Géomètre','Association','Coopérative','Partenaire','Autre'
];

const MODES_PMT = ['ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE'];

// Workflow enrichi — statuts + libellés + couleurs
const STATUT_CONFIG = {
  BROUILLON:             { color:'#888',    bg:'#F7F7F5', badge:'badge-gray',  label:'Brouillon',               icon:'📝' },
  DEMANDEE:              { color:'#BA7517', bg:'#FAEEDA', badge:'badge-amber', label:'Demandée',                icon:'📋' },
  EN_ATTENTE:            { color:'#BA7517', bg:'#FAEEDA', badge:'badge-amber', label:'En attente',              icon:'⏳' },
  VALIDATION_RP:         { color:'#1a3f6f', bg:'#EEF3FB', badge:'badge-blue',  label:'Validation Resp. Projet', icon:'🔍' },
  VALIDATION_DIR:        { color:'#E87722', bg:'#FEF0E6', badge:'badge-orange',label:'Validation Direction',    icon:'📤' },
  VALIDEE_N1:            { color:'#E87722', bg:'#FEF0E6', badge:'badge-orange',label:'Validée N1',              icon:'✓' },
  VALIDEE_FINALE:        { color:'#E87722', bg:'#FEF0E6', badge:'badge-orange',label:'Validée Direction',       icon:'✓✓' },
  AUTORISATION_PAIEMENT: { color:'#639922', bg:'#F0F7E4', badge:'badge-lime',  label:'Autorisée Paiement',      icon:'💳' },
  PAYEE:                 { color:'#27500A', bg:'#EAF3DE', badge:'badge-green', label:'Payée',                   icon:'✅' },
  JUSTIFIEE:             { color:'#27500A', bg:'#EAF3DE', badge:'badge-green', label:'Justifiée',               icon:'📁' },
  CLOTUREE:              { color:'#5F5E5A', bg:'#F7F7F5', badge:'badge-gray',  label:'Clôturée',                icon:'🔒' },
  REJETEE:               { color:'#A32D2D', bg:'#FCEBEB', badge:'badge-red',   label:'Rejetée',                 icon:'❌' },
};

const normaliserStatut = s => {
  if (!s) return 'DEMANDEE';
  const map = { EN_ATTENTE:'DEMANDEE', VALIDEE_N1:'VALIDATION_DIR', VALIDEE_FINALE:'AUTORISATION_PAIEMENT' };
  return map[s] || s;
};

const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(2)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${Math.round(n||0)} F`;

const FORM_INIT = {
  projetId:'', phaseId:'', activiteId:'',
  categorie:'', sousCategorie:'', description:'', observations:'',
  montantPrevu:'', montantDemande:'', montant:'',
  beneficiaire:'', typeBeneficiaire:'', beneficiaireId:'',
  typePaiement:'ESPECES', initiateurId:'',
};

// ── Mini GED Justificatifs ────────────────────────────────────────────────────
function JustificatifsUpload({ depenseId }) {
  const qc = useQueryClient();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function getToken() {
    try { return JSON.parse(localStorage.getItem('2ig-auth') || '{}')?.state?.token || ''; }
    catch { return ''; }
  }

  const { data: docs = [] } = useQuery({
    queryKey: ['docs-depense', depenseId],
    queryFn: () => documentsAPI.list({ entiteType: 'depense', entiteId: depenseId }),
    enabled: !!depenseId,
    staleTime: 30000,
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      fd.append('entiteType', 'depense');
      fd.append('entiteId', depenseId);
      fd.append('type', 'JUSTIFICATIF');
      fd.append('nom', file.name);
      await documentsAPI.upload(fd);
      qc.invalidateQueries(['docs-depense', depenseId]);
      e.target.value = '';
    } catch (err) { setError(err?.response?.data?.error || err.message); }
    finally { setUploading(false); }
  };

  return (
    <div style={{ marginTop:10, padding:12, background:'#F7F7F5', borderRadius:8, border:'0.5px solid #e8e7e1' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:600 }}>📎 Justificatifs ({docs.length})</span>
        <div>
          <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
            onChange={handleUpload} style={{ display:'none' }} />
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ fontSize:11, padding:'3px 8px', background:'#1a3f6f', color:'white', border:'none', borderRadius:5, cursor:'pointer' }}>
            <Upload size={10} style={{ verticalAlign:'middle', marginRight:3 }} />
            {uploading ? 'Envoi...' : 'Ajouter'}
          </button>
        </div>
      </div>
      {error && <div style={{ fontSize:11, color:'#A32D2D', marginBottom:6 }}>{error}</div>}
      {docs.length === 0 ? (
        <div style={{ fontSize:11, color:'#aaa', textAlign:'center', padding:'8px 0' }}>
          Aucun justificatif — reçu, fiche de décharge, bon de commande...
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
              <FileText size={11} color="#888" />
              <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.nom}</span>
              <button onClick={() => window.open(`${documentsAPI.viewUrl(doc.id)}?token=${getToken()}`, '_blank')}
                style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 4px' }}>
                <Eye size={11} color="#1a3f6f" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Carte dépense ─────────────────────────────────────────────────────────────
function CarteDépense({ d, onExpand, isExpanded, onWorkflow }) {
  const sc = STATUT_CONFIG[normaliserStatut(d.statut)] || STATUT_CONFIG[d.statut] || STATUT_CONFIG.DEMANDEE;
  const statut = normaliserStatut(d.statut);

  return (
    <div style={{ border:`1.5px solid ${isExpanded ? sc.color+'40' : '#e8e7e1'}`, borderRadius:10, overflow:'hidden', background:'white' }}>
      {/* Ligne principale */}
      <div style={{ padding:'12px 16px', cursor:'pointer', display:'flex', gap:12, alignItems:'flex-start' }}
        onClick={() => onExpand(d.id)}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, background:sc.bg, color:sc.color, borderRadius:10, padding:'2px 8px', fontWeight:600 }}>
              {sc.icon} {sc.label}
            </span>
            <span style={{ fontSize:11, color:'#888' }}>{d.categorie}{d.sousCategorie ? ` › ${d.sousCategorie}` : ''}</span>
            {d.phase && <span style={{ fontSize:10, background:'#EEF3FB', color:'#1a3f6f', borderRadius:6, padding:'1px 6px' }}>{d.phase.nom?.slice(0,25)}</span>}
            {d.activite && <span style={{ fontSize:10, background:'#F7F7F5', color:'#888', borderRadius:6, padding:'1px 6px' }}>{d.activite.nom?.slice(0,20)}</span>}
          </div>
          <div style={{ fontWeight:600, fontSize:13 }}>{d.description}</div>
          <div style={{ fontSize:11, color:'#888', marginTop:3, display:'flex', gap:10, flexWrap:'wrap' }}>
            {d.beneficiaire && <span>👤 {d.typeBeneficiaire ? `[${d.typeBeneficiaire}] ` : ''}{d.beneficiaire}</span>}
            {d.projet && <span>📍 {d.projet.nom}</span>}
            <span>{new Date(d.date || d.createdAt).toLocaleDateString('fr')}</span>
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:16, color:'#1a3f6f' }}>
            {fmtF(d.montantPaye || d.montant)}
          </div>
          {d.montantPrevu && d.montantPrevu !== d.montant && (
            <div style={{ fontSize:10, color:'#888' }}>Prévu: {fmtF(d.montantPrevu)}</div>
          )}
          {d.montantDemande && d.montantDemande !== d.montant && (
            <div style={{ fontSize:10, color:'#BA7517' }}>Demandé: {fmtF(d.montantDemande)}</div>
          )}
        </div>
      </div>

      {/* Barre d'actions workflow */}
      <div style={{ padding:'6px 16px 8px', borderTop:'0.5px solid #f0efe9', display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', background:'#FAFAF8' }}>
        {/* Boutons selon statut */}
        {['DEMANDEE','EN_ATTENTE'].includes(d.statut) && (
          <>
            <button className="btn btn-sm" style={{ background:'#1a3f6f', color:'white', border:'none', fontSize:11 }}
              onClick={() => onWorkflow(d.id, 'valider_rp')}>
              <Check size={11}/> Valider Resp. Projet
            </button>
            <button className="btn btn-sm btn-ghost" style={{ fontSize:11, color:'#A32D2D' }}
              onClick={() => onWorkflow(d.id, 'rejeter')}>Rejeter</button>
          </>
        )}
        {['VALIDATION_DIR','VALIDEE_N1'].includes(d.statut) && (
          <>
            <button className="btn btn-sm" style={{ background:'#E87722', color:'white', border:'none', fontSize:11 }}
              onClick={() => onWorkflow(d.id, 'valider_dir')}>
              <Check size={11}/> Valider Direction
            </button>
            <button className="btn btn-sm btn-ghost" style={{ fontSize:11, color:'#A32D2D' }}
              onClick={() => onWorkflow(d.id, 'rejeter')}>Rejeter</button>
          </>
        )}
        {['AUTORISATION_PAIEMENT','VALIDEE_FINALE'].includes(d.statut) && (
          <>
            <button className="btn btn-sm" style={{ background:'#639922', color:'white', border:'none', fontSize:11 }}
              onClick={() => onWorkflow(d.id, 'autoriser')}>
              <Check size={11}/> Autoriser paiement
            </button>
            <button className="btn btn-sm" style={{ background:'#27500A', color:'white', border:'none', fontSize:11 }}
              onClick={() => onWorkflow(d.id, 'payer')}>
              <Check size={11}/> Marquer payée
            </button>
          </>
        )}
        {d.statut === 'PAYEE' && (
          <button className="btn btn-sm" style={{ background:'#27500A', color:'white', border:'none', fontSize:11 }}
            onClick={() => onWorkflow(d.id, 'justifier')}>
            <FileText size={11}/> Justifier
          </button>
        )}
        {d.statut === 'JUSTIFIEE' && (
          <button className="btn btn-sm" style={{ background:'#5F5E5A', color:'white', border:'none', fontSize:11 }}
            onClick={() => onWorkflow(d.id, 'cloturer')}>
            🔒 Clôturer
          </button>
        )}
        <button onClick={() => onExpand(d.id)}
          style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#1a3f6f', display:'flex', alignItems:'center', gap:3 }}>
          {isExpanded ? <><ChevronDown size={11}/> Réduire</> : <><ChevronRight size={11}/> Détails & Justificatifs</>}
        </button>
      </div>

      {/* Contenu développé : détails + justificatifs */}
      {isExpanded && (
        <div style={{ padding:'0 16px 14px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:8, marginBottom:4 }}>
            {[
              { label:'Montant prévu', value:fmtF(d.montantPrevu||0) },
              { label:'Montant demandé', value:fmtF(d.montantDemande||d.montant||0) },
              { label:'Montant payé', value:fmtF(d.montantPaye||0) },
            ].map((k,i)=>(
              <div key={i} style={{ background:'#F7F7F5', borderRadius:7, padding:'6px 10px' }}>
                <div style={{ fontSize:9, color:'#888' }}>{k.label}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a3f6f' }}>{k.value}</div>
              </div>
            ))}
          </div>
          {d.observations && (
            <div style={{ background:'#FAEEDA', borderRadius:7, padding:'7px 10px', fontSize:11, color:'#412402', marginBottom:6 }}>
              <strong>Observations :</strong> {d.observations}
            </div>
          )}
          <div style={{ display:'flex', gap:12, fontSize:11, color:'#888', marginBottom:4, flexWrap:'wrap' }}>
            {d.dateDemande && <span>📅 Demande: {new Date(d.dateDemande).toLocaleDateString('fr')}</span>}
            {d.dateValidation && <span>✓ Validation: {new Date(d.dateValidation).toLocaleDateString('fr')}</span>}
            {d.datePaiement && <span>💳 Paiement: {new Date(d.datePaiement).toLocaleDateString('fr')}</span>}
            {d.referenceVirement && <span>🔖 Réf: {d.referenceVirement}</span>}
          </div>
          <JustificatifsUpload depenseId={d.id}/>
        </div>
      )}
    </div>
  );
}

// ── Formulaire création dépense ───────────────────────────────────────────────
function ModalCreerDepense({ onClose, onSave, loading, projets, employes }) {
  const [form, setForm] = useState(FORM_INIT);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  // Charger phases du projet sélectionné
  const { data: phases = [] } = useQuery({
    queryKey: ['phases-dep', form.projetId],
    queryFn: () => depensesAPIv2.phasesProjet(form.projetId),
    enabled: !!form.projetId,
    staleTime: 60000,
  });

  const { data: categories = {} } = useQuery({
    queryKey: ['cats-depenses'],
    queryFn: depensesAPIv2.categories,
    staleTime: 3600000,
  });

  const catKeys = Object.keys(categories);
  const sousCats = form.categorie ? (categories[form.categorie] || []) : [];
  const activitesDeLaPhase = phases.find(p=>p.id===form.phaseId)?.activites || [];
  const listeEmployes = employes?.data || employes || [];

  const handleSave = () => {
    const payload = {
      ...form,
      montant: Number(form.montantDemande || form.montant || 0),
      montantPrevu: form.montantPrevu ? Number(form.montantPrevu) : undefined,
      montantDemande: Number(form.montantDemande || form.montant || 0),
      phaseId: form.phaseId || undefined,
      activiteId: form.activiteId || undefined,
      initiateurId: form.initiateurId || undefined,
    };
    onSave(payload);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:600 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>💳 Nouvelle dépense foncière</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>

        <div style={{ maxHeight:'70vh', overflowY:'auto', paddingRight:4 }}>
          {/* ── PROJET → PHASE → ACTIVITÉ ── */}
          <div style={{ background:'#EEF3FB', borderRadius:8, padding:'10px 12px', marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#1a3f6f', marginBottom:10 }}>📍 Rattachement projet (obligatoire)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:8 }}>
              <div>
                <label className="label">Projet *</label>
                <select className="input" value={form.projetId} onChange={e=>{set('projetId',e.target.value);set('phaseId','');set('activiteId','');set('categorie','');}}>
                  <option value="">— Sélectionner un projet</option>
                  {projets.map(p=><option key={p.id} value={p.id}>{p.nom} — {p.code}</option>)}
                </select>
              </div>
              {form.projetId && (
                <div>
                  <label className="label">Phase projet *</label>
                  <select className="input" value={form.phaseId} onChange={e=>{set('phaseId',e.target.value);set('activiteId','');const ph=phases.find(p=>p.id===e.target.value);if(ph)set('categorie',ph.nom);}}>
                    <option value="">— Sélectionner une phase</option>
                    {phases.map(p=>(
                      <option key={p.id} value={p.id}>{p.ordre}. {p.nom}</option>
                    ))}
                  </select>
                  {phases.length === 0 && (
                    <div style={{ fontSize:10, color:'#BA7517', marginTop:3 }}>⚠ Aucune phase — cliquez sur "Init. phases" dans Gestion de Projet</div>
                  )}
                </div>
              )}
              {form.phaseId && activitesDeLaPhase.length > 0 && (
                <div>
                  <label className="label">Activité *</label>
                  <select className="input" value={form.activiteId} onChange={e=>set('activiteId',e.target.value)}>
                    <option value="">— Sélectionner une activité</option>
                    {activitesDeLaPhase.map(a=>(
                      <option key={a.id} value={a.id}>{a.nom}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ── CATÉGORIE ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <label className="label">Catégorie *</label>
              <select className="input" value={form.categorie} onChange={e=>{set('categorie',e.target.value);set('sousCategorie','');}}>
                <option value="">— Sélectionner</option>
                {catKeys.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sous-catégorie</label>
              <select className="input" value={form.sousCategorie} onChange={e=>set('sousCategorie',e.target.value)} disabled={!sousCats.length}>
                <option value="">—</option>
                {sousCats.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* ── DESCRIPTION ── */}
          <div style={{ marginBottom:12 }}>
            <label className="label">Description *</label>
            <input className="input" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Objet précis de la dépense..."/>
          </div>

          {/* ── MONTANTS ── */}
          <div style={{ background:'#F7F7F5', borderRadius:8, padding:'10px 12px', marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#888', marginBottom:10 }}>💰 Montants</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label className="label">Montant prévu (budget)</label>
                <input className="input" type="number" min={0} value={form.montantPrevu} onChange={e=>set('montantPrevu',e.target.value)} placeholder="0 FCFA"/>
              </div>
              <div>
                <label className="label">Montant demandé *</label>
                <input className="input" type="number" min={0} value={form.montantDemande} onChange={e=>set('montantDemande',e.target.value)} placeholder="0 FCFA"/>
              </div>
            </div>
            <div style={{ marginTop:8 }}>
              <label className="label">Mode de paiement</label>
              <select className="input" value={form.typePaiement} onChange={e=>set('typePaiement',e.target.value)}>
                {MODES_PMT.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>

          {/* ── BÉNÉFICIAIRE ── */}
          <div style={{ background:'#F7F7F5', borderRadius:8, padding:'10px 12px', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
              <span style={{ fontSize:11, fontWeight:700 }}>👤 Bénéficiaire *</span>
              <span style={{ fontSize:10, color:'#888', fontStyle:'italic' }}>(Personne ou organisme qui reçoit l'argent)</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label className="label">Type de bénéficiaire</label>
                <select className="input" value={form.typeBeneficiaire} onChange={e=>set('typeBeneficiaire',e.target.value)}>
                  <option value="">— Choisir</option>
                  {TYPES_BENEFICIAIRES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Nom du bénéficiaire *</label>
                <input className="input" value={form.beneficiaire} onChange={e=>set('beneficiaire',e.target.value)} placeholder="Nom complet ou raison sociale"/>
              </div>
            </div>
          </div>

          {/* ── INITIATEUR ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:10, marginBottom:12 }}>
            <div>
              <label className="label">Initiateur (employé TOPTELSIG)</label>
              <select className="input" value={form.initiateurId} onChange={e=>set('initiateurId',e.target.value)}>
                <option value="">— Sélectionner</option>
                {(listeEmployes || []).map?.(e=>(
                  <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.poste}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── OBSERVATIONS ── */}
          <div style={{ marginBottom:12 }}>
            <label className="label">Observations</label>
            <textarea className="input" rows={2} value={form.observations} onChange={e=>set('observations',e.target.value)}
              placeholder="Remarques internes, contexte, conditions particulières..." style={{ resize:'vertical' }}/>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16, borderTop:'0.5px solid #e8e7e1', paddingTop:12 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background:'#1a3f6f', color:'white', border:'none' }}
            disabled={!form.projetId||!form.phaseId||!form.categorie||!form.description||(!form.montantDemande&&!form.montant)||!form.beneficiaire||loading}
            onClick={handleSave}>
            {loading ? 'Création...' : '✓ Créer la dépense'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────────────────
export default function DepensesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showRejet, setShowRejet] = useState(null);
  const [showPayer, setShowPayer] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [statutFilter, setStatutFilter] = useState('');
  const [projetFilter, setProjetFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [motifRejet, setMotifRejet] = useState('');
  const [refVirement, setRefVirement] = useState('');
  const [pendingWorkflow, setPendingWorkflow] = useState(null); // { id, action }
  const [toast, setToast] = useState(null);
  const showToast = (msg, t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3500); };

  // Données
  const { data } = useQuery({
    queryKey: ['depenses', statutFilter, projetFilter, phaseFilter],
    queryFn: () => depensesAPIv2.list({ statut:statutFilter||undefined, projetId:projetFilter||undefined, phaseId:phaseFilter||undefined, limit:100 }),
    staleTime: 15000,
  });
  const { data: stats } = useQuery({ queryKey:['stats-depenses'], queryFn:depensesAPIv2.stats, staleTime:60000 });
  const { data: projets } = useQuery({ queryKey:['projets'], queryFn:toptelsigAPI.projets, staleTime:60000 });
  const { data: employes } = useQuery({ queryKey:['employes-toptelsig'], queryFn:()=>employesAPI.list({ filiale:'TOPTELSIG', statut:'ACTIF', limit:100 }), staleTime:300000 });

  const createMut = useMutation({
    mutationFn: depensesAPIv2.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['depenses'], exact:false }); qc.invalidateQueries(['stats-depenses']); setShowCreate(false); showToast('Dépense créée ✓'); },
    onError: e => showToast(e?.response?.data?.error || 'Erreur', 'error'),
  });

  const workflowMut = useMutation({
    mutationFn: ({ id, action, extra={} }) => depensesAPIv2.workflow(id, action, extra),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['depenses'], exact:false }); setPendingWorkflow(null); showToast('Statut mis à jour ✓'); },
    onError: e => showToast(e?.response?.data?.error || 'Erreur workflow', 'error'),
  });

  const handleWorkflow = (id, action) => {
    if (action === 'rejeter') { setPendingWorkflow({ id, action }); return; }
    if (action === 'payer' || action === 'autoriser') { setShowPayer({ id, action }); return; }
    workflowMut.mutate({ id, action });
  };

  const depenses = data?.data || [];
  const listeProjets = Array.isArray(projets) ? projets : [];

  // Stats globales depuis l'API (pas limitées aux 100 premiers)
  const totalGlobal     = stats?.total || 0;
  const nbGlobal        = stats?.nbDepenses || 0;
  const parStatutStats  = stats?.parStatut || [];
  const totalPayee      = parStatutStats.find(s => s.statut === 'PAYEE')?.montant || 0;
  const totalEnAttente  = parStatutStats
    .filter(s => ['DEMANDEE','VALIDATION_DIR','AUTORISATION_PAIEMENT'].includes(s.statut))
    .reduce((s,x) => s + x.montant, 0);
  const totalRejete     = parStatutStats.find(s => s.statut === 'REJETEE')?.montant || 0;

  // Total liste locale (filtrée)
  const totalMontant = depenses.reduce((s,d) => s + (d.montant||0), 0);

  // Graphiques : utiliser stats.parCategorie
  const statsData = (stats?.parCategorie || []).slice(0,8).map((s,i) => ({
    name: (s.categorie||'Autre').slice(0,20),
    value: s.montant || 0,
    color: COULEURS[i % COULEURS.length]
  }));

  const STATUTS_FILTRE = [
    ['','Toutes'],
    ['DEMANDEE','Demandées'],
    ['VALIDATION_DIR','Validation Direction'],
    ['AUTORISATION_PAIEMENT','À payer'],
    ['PAYEE','Payées'],
    ['JUSTIFIEE','Justifiées'],
    ['CLOTUREE','Clôturées'],
    ['REJETEE','Rejetées'],
  ];

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20 }}>💳 Dépenses Foncières</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            {depenses.length} dépense(s) · Total: <strong>{totalMontant.toLocaleString('fr')} F</strong>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
            onClick={() => setShowCreate(true)}>
            <Plus size={13}/> Nouvelle dépense
          </button>
        </div>
      </div>

      {/* KPI Stats globales */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'Total dépenses',    value:fmtF(totalGlobal),    color:'#1a3f6f', sub:`${nbGlobal} dépense(s)` },
          { label:'Montant payé',      value:fmtF(totalPayee),     color:'#27500A', sub:'Décaissé' },
          { label:'En attente',        value:fmtF(totalEnAttente), color:'#BA7517', sub:'À valider/payer' },
          { label:'Rejeté',            value:fmtF(totalRejete),    color:'#A32D2D', sub:'Dépenses rejetées' },
        ].map((k,i) => (
          <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
            <div className="kpi-label">{k.label}</div>
            <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:18, color:k.color }}>{k.value}</div>
            <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* KPI + Graphiques */}
      {statsData.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
          <div className="card">
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, marginBottom:10 }}>🥧 Répartition par catégorie</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={statsData} cx="40%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                  {statsData.map((s,i)=><Cell key={i} fill={s.color}/>)}
                </Pie>
                <Tooltip formatter={v=>fmtF(v)}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, marginBottom:10 }}>📊 Montants par catégorie</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={statsData} layout="vertical" barSize={10}>
                <XAxis type="number" tick={{ fontSize:9 }} tickFormatter={v=>v>=1000?Math.round(v/1000)+'k':v}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize:9 }} width={90}/>
                <Tooltip formatter={v=>fmtF(v)}/>
                <Bar dataKey="value" radius={[0,4,4,0]}>
                  {statsData.map((s,i)=><Cell key={i} fill={s.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        {STATUTS_FILTRE.map(([k,v])=>(
          <button key={k} onClick={()=>setStatutFilter(k)} className={`filter-btn ${statutFilter===k?'active':''}`}>
            {v} {k && <span style={{ fontSize:10 }}>({depenses.filter(d=>normaliserStatut(d.statut)===k||d.statut===k).length})</span>}
          </button>
        ))}
        {listeProjets.length > 0 && (
          <select className="input" style={{ width:180, marginLeft:'auto' }} value={projetFilter} onChange={e=>setProjetFilter(e.target.value)}>
            <option value="">Tous les projets</option>
            {listeProjets.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        )}
      </div>

      {/* Liste dépenses */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {depenses.length === 0 && (
          <div className="empty-state"><p>Aucune dépense trouvée</p></div>
        )}
        {depenses.map(d => (
          <CarteDépense
            key={d.id}
            d={d}
            isExpanded={expandedId === d.id}
            onExpand={(id) => setExpandedId(expandedId === id ? null : id)}
            onWorkflow={handleWorkflow}
          />
        ))}
      </div>

      {/* Modal création */}
      {showCreate && (
        <ModalCreerDepense
          onClose={() => setShowCreate(false)}
          onSave={createMut.mutate}
          loading={createMut.isPending}
          projets={listeProjets}
          employes={employes}
        />
      )}

      {/* Modal rejet */}
      {pendingWorkflow?.action === 'rejeter' && (
        <div className="modal-overlay" onClick={()=>setPendingWorkflow(null)}>
          <div className="modal" style={{ maxWidth:380 }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontFamily:'Syne', margin:'0 0 14px', color:'#A32D2D' }}>❌ Rejeter la dépense</h3>
            <label className="label">Motif de rejet *</label>
            <textarea className="input" rows={3} value={motifRejet} onChange={e=>setMotifRejet(e.target.value)}
              placeholder="Expliquer la raison du rejet..." style={{ resize:'vertical' }}/>
            <div style={{ display:'flex', gap:10, marginTop:14, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setPendingWorkflow(null)}>Annuler</button>
              <button className="btn btn-sm btn-danger" disabled={!motifRejet||workflowMut.isPending}
                onClick={()=>{workflowMut.mutate({ id:pendingWorkflow.id, action:'rejeter', extra:{ motif:motifRejet } }); setMotifRejet('');}}>
                Confirmer rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal paiement */}
      {showPayer && (
        <div className="modal-overlay" onClick={()=>setShowPayer(null)}>
          <div className="modal" style={{ maxWidth:380 }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontFamily:'Syne', margin:'0 0 14px' }}>💳 Confirmer le paiement</h3>
            <div style={{ background:'#EAF3DE', borderRadius:8, padding:10, marginBottom:14, fontSize:13 }}>
              Dépense autorisée — prête pour décaissement
            </div>
            <label className="label">Référence (virement, chèque, bordereau...)</label>
            <input className="input" value={refVirement} onChange={e=>setRefVirement(e.target.value)} placeholder="Optionnel"/>
            <div style={{ display:'flex', gap:10, marginTop:14, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowPayer(null)}>Annuler</button>
              <button className="btn btn-sm" style={{ background:'#27500A', color:'white', border:'none' }}
                disabled={workflowMut.isPending}
                onClick={()=>{workflowMut.mutate({ id:showPayer.id, action:showPayer.action||'payer', extra:{ referenceVirement:refVirement } }); setRefVirement(''); setShowPayer(null);}}>
                <Check size={13}/> Confirmer
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
