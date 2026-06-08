import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { depensesAPIv2, toptelsigAPI, employesAPI, documentsAPI } from '../../lib/api';
import { Plus, X, Check, Upload, FileText, Trash2, Eye } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COULEURS = ['#1a3f6f','#E87722','#8B1A1A','#E85D04','#27500A','#BA7517','#639922','#888'];
const STATUT_CONFIG = {
  EN_ATTENTE:     { badge: 'badge-gray',  label: 'En attente',        next: 'Valider N1' },
  VALIDEE_N1:     { badge: 'badge-blue',  label: 'Validée N1',        next: 'Valider Direction' },
  VALIDEE_FINALE: { badge: 'badge-amber', label: 'Validée Direction', next: 'Marquer Payée' },
  PAYEE:          { badge: 'badge-green', label: 'Payée',             next: null },
  REJETEE:        { badge: 'badge-red',   label: 'Rejetée',           next: null },
};
const MODES_PMT = ['ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE'];

const FORM_INIT = {
  projetId: '', categorie: '', sousCategorie: '', montant: '', description: '',
  beneficiaire: '', beneficiaireId: '', initiateurId: '', typePaiement: 'ESPECES',
};

// ── Mini GED Justificatifs ────────────────────────────────────────────────
function JustificatifsUpload({ depenseId }) {
  const qc = useQueryClient();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const { data: docs = [] } = useQuery({
    queryKey: ['docs-depense', depenseId],
    queryFn: () => documentsAPI.list({ entiteType: 'depense', entiteId: depenseId }),
    enabled: !!depenseId,
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
    <div style={{ marginTop: 12, padding: 12, background: '#F7F7F5', borderRadius: 8, border: '0.5px solid #e8e7e1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>📎 Justificatifs ({docs.length})</span>
        <div>
          <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
            onChange={handleUpload} style={{ display: 'none' }} />
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ fontSize: 11, padding: '3px 8px', background: '#1a3f6f', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
            <Upload size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            {uploading ? 'Envoi...' : 'Ajouter'}
          </button>
        </div>
      </div>
      {error && <div style={{ fontSize: 11, color: '#A32D2D', marginBottom: 6 }}>{error}</div>}
      {docs.length === 0 ? (
        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: '8px 0' }}>
          Aucun justificatif — reçu, fiche de décharge, bon de commande...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <FileText size={11} color="#888" />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom}</span>
              <button onClick={() => window.open(documentsAPI.viewUrl(doc.id), '_blank')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                <Eye size={11} color="#1a3f6f" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────
export default function DepensesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showRejet, setShowRejet] = useState(null);
  const [showPayer, setShowPayer] = useState(null);
  const [expandedId, setExpandedId] = useState(null); // dépense ouverte pour justificatifs
  const [statutFilter, setStatutFilter] = useState('');
  const [motifRejet, setMotifRejet] = useState('');
  const [refVirement, setRefVirement] = useState('');
  const [form, setForm] = useState(FORM_INIT);
  const [benefSaisie, setBenefSaisie] = useState(''); // mode saisie libre bénéficiaire
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data } = useQuery({ queryKey: ['depenses', statutFilter], queryFn: () => depensesAPIv2.list({ statut: statutFilter || undefined, limit: 50 }) });
  const { data: stats } = useQuery({ queryKey: ['stats-depenses'], queryFn: depensesAPIv2.stats });
  const { data: projets } = useQuery({ queryKey: ['projets'], queryFn: toptelsigAPI.projets });
  const { data: categories } = useQuery({ queryKey: ['cats-depenses'], queryFn: depensesAPIv2.categories });
  const { data: employes } = useQuery({ queryKey: ['employes-actifs'], queryFn: () => employesAPI.list({ filiale: 'TOPTELSIG', statut: 'ACTIF', limit: 100 }) });
  const { data: prescripteurs } = useQuery({ queryKey: ['prescripteurs'], queryFn: toptelsigAPI.prescripteurs });

  const createMut = useMutation({ mutationFn: depensesAPIv2.create, onSuccess: () => { qc.invalidateQueries({ queryKey: ['depenses'], exact: false }); setShowCreate(false); setForm(FORM_INIT); setBenefSaisie(''); } });
  const n1Mut = useMutation({ mutationFn: depensesAPIv2.validerN1, onSuccess: () => qc.invalidateQueries({ queryKey: ['depenses'], exact: false }) });
  const finaleMut = useMutation({ mutationFn: depensesAPIv2.validerFinale, onSuccess: () => qc.invalidateQueries({ queryKey: ['depenses'], exact: false }) });
  const payerMut = useMutation({ mutationFn: ({ id, data }) => depensesAPIv2.payer(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['depenses'], exact: false }); setShowPayer(null); } });
  const rejeterMut = useMutation({ mutationFn: ({ id, motif }) => depensesAPIv2.rejeter(id, motif), onSuccess: () => { qc.invalidateQueries({ queryKey: ['depenses'], exact: false }); setShowRejet(null); setMotifRejet(''); } });

  const depenses = data?.data || [];
  const totalMontant = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const statsData = (Array.isArray(stats) ? stats : []).slice(0, 6).map((s, i) => ({ name: (s.categorie || '').slice(0, 18), value: s._sum?.montant || 0, color: COULEURS[i % COULEURS.length] }));
  const listeProjets = Array.isArray(projets) ? projets : [];
  const categoriesMap = categories || {};
  const catKeys = Object.keys(categoriesMap);
  const sousCats = form.categorie ? (categoriesMap[form.categorie] || []) : [];
  const listeEmployes = employes?.data || employes || [];
  const listePrescs = Array.isArray(prescripteurs) ? prescripteurs : [];

  const STATUTS_FILTRE = [['', 'Toutes'], ['EN_ATTENTE', 'En attente'], ['VALIDEE_N1', 'Validées N1'], ['VALIDEE_FINALE', 'À payer'], ['PAYEE', 'Payées'], ['REJETEE', 'Rejetées']];

  const handleCreate = () => {
    const payload = {
      ...form,
      montant: Number(form.montant),
      beneficiaire: form.beneficiaireId
        ? listePrescs.find(p => p.id === form.beneficiaireId)?.nom || benefSaisie
        : benefSaisie || form.beneficiaire,
    };
    createMut.mutate(payload);
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Syne', fontWeight: 800, fontSize: 20 }}>Dépenses Foncières</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
            {depenses.length} dépense(s) · Total: <strong>{totalMontant.toLocaleString('fr')} F</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => window.open(depensesAPIv2.exportUrl?.(), '_blank')}>📊 Export</button>
          <button className="btn btn-primary btn-sm" style={{ background: '#1a3f6f', border: 'none' }} onClick={() => setShowCreate(true)}>
            <Plus size={13} /> Nouvelle dépense
          </button>
        </div>
      </div>

      {/* KPI + Graphiques */}
      {statsData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>🥧 Répartition par catégorie</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={statsData} cx="40%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                  {statsData.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={v => v.toLocaleString('fr') + ' F'} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📊 Montants par catégorie</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={statsData} layout="vertical" barSize={10}>
                <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? Math.round(v/1000)+'k' : v} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                <Tooltip formatter={v => v.toLocaleString('fr') + ' F'} />
                <Bar dataKey="value" radius={[0,4,4,0]}>
                  {statsData.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {STATUTS_FILTRE.map(([k, v]) => (
          <button key={k} onClick={() => setStatutFilter(k)}
            style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: statutFilter === k ? 600 : 400, background: statutFilter === k ? '#1a3f6f' : '#F1EFE8', color: statutFilter === k ? 'white' : '#666' }}>
            {v}
          </button>
        ))}
      </div>

      {/* Liste dépenses */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {depenses.length === 0 && (
          <div className="empty-state"><p>Aucune dépense trouvée</p></div>
        )}
        {depenses.map(d => {
          const sc = STATUT_CONFIG[d.statut] || STATUT_CONFIG.EN_ATTENTE;
          const isExpanded = expandedId === d.id;
          return (
            <div key={d.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}
                onClick={() => setExpandedId(isExpanded ? null : d.id)}
                onKeyDown={() => {}} style={{ cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`badge ${sc.badge}`} style={{ fontSize: 10 }}>{sc.label}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>{d.categorie} {d.sousCategorie ? `· ${d.sousCategorie}` : ''}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{d.description}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    Initiateur : <strong>{d.initiateur?.nom ? `${d.initiateur.prenom} ${d.initiateur.nom}` : '—'}</strong>
                    {' · '} Bénéficiaire : <strong>{d.beneficiaire || '—'}</strong>
                    {d.projet && ` · ${d.projet.nom}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 15, color: '#1a3f6f' }}>{d.montant?.toLocaleString('fr')} F</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{new Date(d.date || d.createdAt).toLocaleDateString('fr')}</div>
                </div>
              </div>

              {/* Actions workflow */}
              <div style={{ padding: '8px 16px', borderTop: '0.5px solid #f0efe9', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', background: '#FAFAF8' }}>
                {d.statut === 'EN_ATTENTE' && (
                  <>
                    <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none', fontSize: 11 }} onClick={() => n1Mut.mutate(d.id)}><Check size={11} /> Valider N1</button>
                    <button className="btn btn-sm btn-ghost" style={{ fontSize: 11, color: '#A32D2D' }} onClick={() => setShowRejet(d)}>Rejeter</button>
                  </>
                )}
                {d.statut === 'VALIDEE_N1' && (
                  <>
                    <button className="btn btn-sm" style={{ background: '#E87722', color: 'white', border: 'none', fontSize: 11 }} onClick={() => finaleMut.mutate(d.id)}><Check size={11} /> Valider Direction</button>
                    <button className="btn btn-sm btn-ghost" style={{ fontSize: 11, color: '#A32D2D' }} onClick={() => setShowRejet(d)}>Rejeter</button>
                  </>
                )}
                {d.statut === 'VALIDEE_FINALE' && (
                  <button className="btn btn-sm" style={{ background: '#27500A', color: 'white', border: 'none', fontSize: 11 }} onClick={() => setShowPayer(d)}><Check size={11} /> Marquer payée</button>
                )}
                <button onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1a3f6f' }}>
                  {isExpanded ? '▲ Masquer' : '▼ Justificatifs'}
                </button>
              </div>

              {/* Justificatifs expandés */}
              {isExpanded && (
                <div style={{ padding: '0 16px 12px' }}>
                  <JustificatifsUpload depenseId={d.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal création dépense */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouvelle dépense</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              {/* Projet */}
              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">Projet *</label>
                <select className="input" value={form.projetId} onChange={e => set('projetId', e.target.value)}>
                  <option value="">Sélectionner un projet</option>
                  {listeProjets.map(p => <option key={p.id} value={p.id}>{p.nom} — {p.code}</option>)}
                </select>
              </div>

              {/* Catégorie + Sous-catégorie */}
              <div>
                <label className="label">Catégorie *</label>
                <select className="input" value={form.categorie} onChange={e => { set('categorie', e.target.value); set('sousCategorie', ''); }}>
                  <option value="">Sélectionner</option>
                  {catKeys.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Sous-catégorie</label>
                <select className="input" value={form.sousCategorie} onChange={e => set('sousCategorie', e.target.value)} disabled={!sousCats.length}>
                  <option value="">—</option>
                  {sousCats.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Description */}
              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">Description *</label>
                <input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Objet de la dépense..." />
              </div>

              {/* Montant + Mode paiement */}
              <div>
                <label className="label">Montant (FCFA) *</label>
                <input className="input" type="number" min={0} value={form.montant} onChange={e => set('montant', e.target.value)} />
              </div>
              <div>
                <label className="label">Mode de paiement</label>
                <select className="input" value={form.typePaiement} onChange={e => set('typePaiement', e.target.value)}>
                  {MODES_PMT.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              {/* Initiateur (employé TOPTELSIG) */}
              <div>
                <label className="label">Initiateur (employé)</label>
                <select className="input" value={form.initiateurId} onChange={e => set('initiateurId', e.target.value)}>
                  <option value="">— Sélectionner</option>
                  {listeEmployes.map ? listeEmployes.map(e => (
                    <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.poste}</option>
                  )) : null}
                </select>
              </div>

              {/* Bénéficiaire : prescripteur OU saisie libre */}
              <div>
                <label className="label">Bénéficiaire</label>
                <select className="input" value={form.beneficiaireId}
                  onChange={e => { set('beneficiaireId', e.target.value); setBenefSaisie(''); }}>
                  <option value="">— Prescripteur ou saisie libre</option>
                  {listePrescs.map(p => (
                    <option key={p.id} value={p.id}>{p.prenom} {p.nom} {p.raisonSociale ? `(${p.raisonSociale})` : ''}</option>
                  ))}
                </select>
                {!form.beneficiaireId && (
                  <input className="input" style={{ marginTop: 6 }} value={benefSaisie}
                    onChange={e => setBenefSaisie(e.target.value)}
                    placeholder="Ou saisir un bénéficiaire libre..." />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowCreate(false); setForm(FORM_INIT); setBenefSaisie(''); }}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }}
                disabled={!form.projetId || !form.categorie || !form.montant || !form.description || createMut.isPending}
                onClick={handleCreate}>
                {createMut.isPending ? 'Création...' : 'Créer la dépense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rejet */}
      {showRejet && (
        <div className="modal-overlay" onClick={() => setShowRejet(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'Syne', margin: '0 0 14px', color: '#A32D2D' }}>Rejeter la dépense</h3>
            <label className="label">Motif de rejet *</label>
            <textarea className="input" rows={3} value={motifRejet} onChange={e => setMotifRejet(e.target.value)} placeholder="Expliquer la raison du rejet..." style={{ resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowRejet(null)}>Annuler</button>
              <button className="btn btn-sm btn-danger" disabled={!motifRejet || rejeterMut.isPending} onClick={() => rejeterMut.mutate({ id: showRejet.id, motif: motifRejet })}>Confirmer rejet</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal paiement */}
      {showPayer && (
        <div className="modal-overlay" onClick={() => setShowPayer(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'Syne', margin: '0 0 14px' }}>Paiement — {showPayer.montant?.toLocaleString('fr')} F</h3>
            <div style={{ background: '#EAF3DE', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>Validé par Direction — prêt pour décaissement</div>
            <label className="label">Référence (virement, chèque, bordereau...)</label>
            <input className="input" value={refVirement} onChange={e => setRefVirement(e.target.value)} placeholder="Optionnel" />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPayer(null)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#27500A', color: 'white', border: 'none' }}
                disabled={payerMut.isPending}
                onClick={() => payerMut.mutate({ id: showPayer.id, data: { referenceVirement: refVirement } })}>
                <Check size={13} /> Confirmer paiement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
