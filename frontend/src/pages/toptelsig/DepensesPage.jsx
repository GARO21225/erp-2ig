import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { depensesAPIv2, toptelsigAPI } from '../../lib/api';
import { Plus, X, Check, ChevronRight, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import FilterBar from '../../components/ui/FilterBar';

const COULEURS = ['#1a3f6f','#2d5f9f','#4a80c4','#8B1A1A','#BA7517','#639922','#E85D04','#888'];

const STATUT_CONFIG = {
  EN_ATTENTE:     { badge: 'badge-gray',    label: 'En attente',       next: 'Valider N1' },
  VALIDEE_N1:     { badge: 'badge-blue',    label: 'Validée N1',       next: 'Valider (Direction)' },
  VALIDEE_FINALE: { badge: 'badge-amber',   label: 'Validée Direction',next: 'Payer' },
  PAYEE:          { badge: 'badge-green',   label: 'Payée',            next: null },
  REJETEE:        { badge: 'badge-red',     label: 'Rejetée',          next: null },
};

export default function DepensesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showRejet, setShowRejet] = useState(null);
  const [showPayer, setShowPayer] = useState(null);
  const [statutFilter, setStatutFilter] = useState('');
  const [motifRejet, setMotifRejet] = useState('');
  const [refVirement, setRefVirement] = useState('');
  const [form, setForm] = useState({ projetId: '', categorie: '', sousCategorie: '', montant: '', description: '', beneficiaire: '', typePaiement: 'ESPECES' });

  const { data } = useQuery({
    queryKey: ['depenses', statutFilter],
    queryFn: () => depensesAPIv2.list({ statut: statutFilter || undefined, limit: 50 })
  });
  const { data: stats } = useQuery({ queryKey: ['stats-depenses'], queryFn: depensesAPIv2.stats });
  const { data: projets } = useQuery({ queryKey: ['projets'], queryFn: toptelsigAPI.projets });
  const { data: categories } = useQuery({ queryKey: ['cats-depenses'], queryFn: depensesAPIv2.categories });

  const createMut = useMutation({ mutationFn: depensesAPIv2.create, onSuccess: () => { qc.invalidateQueries(['depenses','stats-depenses']); setShowCreate(false); } });
  const n1Mut = useMutation({ mutationFn: (id) => depensesAPIv2.validerN1(id), onSuccess: () => qc.invalidateQueries(['depenses']) });
  const finaleMut = useMutation({ mutationFn: (id) => depensesAPIv2.validerFinale(id), onSuccess: () => qc.invalidateQueries(['depenses']) });
  const payerMut = useMutation({ mutationFn: ({ id, data }) => depensesAPIv2.payer(id, data), onSuccess: () => { qc.invalidateQueries(['depenses']); setShowPayer(null); } });
  const rejeterMut = useMutation({ mutationFn: ({ id, motif }) => depensesAPIv2.rejeter(id, motif), onSuccess: () => { qc.invalidateQueries(['depenses']); setShowRejet(null); setMotifRejet(''); } });

  const depenses = data?.data || [];
  const totalMontant = data?.totalMontant || 0;
  const statsData = (Array.isArray(stats) ? stats : []).map((s, i) => ({ name: s.categorie, value: s._sum?.montant || 0, color: COULEURS[i % COULEURS.length] }));
  const listeProjets = Array.isArray(projets) ? projets : [];
  const categoriesMap = categories || {};
  const catKeys = Object.keys(categoriesMap);
  const sousCats = form.categorie ? (categoriesMap[form.categorie] || []) : [];

  const STATUTS_FILTRE = [['', 'Toutes'], ['EN_ATTENTE', 'En attente'], ['VALIDEE_N1', 'Validées N1'], ['VALIDEE_FINALE', 'À payer'], ['PAYEE', 'Payées'], ['REJETEE', 'Rejetées']];

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Dépenses Foncières</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
            Total filtré : <strong style={{ color: '#1a3f6f' }}>{totalMontant.toLocaleString('fr')} FCFA</strong>
          </div>
        </div>
        <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}>
          <Plus size={13} /> Nouvelle dépense
        </button>
      </div>

      {/* Workflow visuel */}
      <div style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: '12px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 0 }}>
        {['EN_ATTENTE', 'VALIDEE_N1', 'VALIDEE_FINALE', 'PAYEE'].map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1a3f6f' }}>
                {s === 'EN_ATTENTE' ? 'Créée' : s === 'VALIDEE_N1' ? 'Validée N1' : s === 'VALIDEE_FINALE' ? 'Validée Direction' : 'Payée'}
              </div>
              <div style={{ fontSize: 10, color: '#888' }}>
                {s === 'EN_ATTENTE' ? 'Initiateur' : s === 'VALIDEE_N1' ? 'Chef Projet' : s === 'VALIDEE_FINALE' ? 'DG / Directeur' : 'Comptable'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a3f6f', marginTop: 4 }}>
                {depenses.filter(d => d.statut === s).length}
              </div>
            </div>
            {i < 3 && <div style={{ fontSize: 18, color: '#d3d1c7', margin: '0 4px' }}>›</div>}
          </div>
        ))}
        {depenses.filter(d => d.statut === 'REJETEE').length > 0 && (
          <div style={{ marginLeft: 12, padding: '4px 12px', background: '#FCEBEB', borderRadius: 20, fontSize: 12, color: '#A32D2D', fontWeight: 500 }}>
            <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />
            {depenses.filter(d => d.statut === 'REJETEE').length} rejetée(s)
          </div>
        )}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {STATUTS_FILTRE.map(([k, v]) => (
          <button key={k} onClick={() => setStatutFilter(k)}
            style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, background: statutFilter === k ? '#1a3f6f' : '#F1EFE8', color: statutFilter === k ? 'white' : '#666', fontWeight: statutFilter === k ? 600 : 400 }}>
            {v}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table-erp">
            <thead><tr><th>Description</th><th>Catégorie</th><th>Montant</th><th>Bénéficiaire</th><th>Statut / Workflow</th></tr></thead>
            <tbody>
              {depenses.map(d => {
                const cfg = STATUT_CONFIG[d.statut] || STATUT_CONFIG.EN_ATTENTE;
                return (
                  <tr key={d.id}>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{d.description}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{d.projet?.nom}</div>
                    </td>
                    <td><span style={{ fontSize: 11, background: '#EEF3FB', color: '#1a3f6f', padding: '2px 8px', borderRadius: 10 }}>{d.categorie}</span></td>
                    <td style={{ fontWeight: 600, color: '#A32D2D' }}>{d.montant?.toLocaleString('fr')} F</td>
                    <td style={{ fontSize: 12, color: '#666' }}>{d.beneficiaire || '—'}</td>
                    <td>
                      <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                      {d.rejete && d.rejeteMotif && (
                        <div style={{ fontSize: 10, color: '#A32D2D', marginTop: 3 }}>{d.rejeteMotif}</div>
                      )}
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        {d.statut === 'EN_ATTENTE' && (
                          <>
                            <button onClick={() => n1Mut.mutate(d.id)} className="btn btn-sm" style={{ background: '#EEF3FB', color: '#1a3f6f', border: 'none', fontSize: 10, padding: '2px 8px' }}>
                              <Check size={10} /> Valider N1
                            </button>
                            <button onClick={() => setShowRejet(d)} className="btn btn-sm" style={{ background: '#FCEBEB', color: '#A32D2D', border: 'none', fontSize: 10, padding: '2px 8px' }}>Rejeter</button>
                          </>
                        )}
                        {d.statut === 'VALIDEE_N1' && (
                          <>
                            <button onClick={() => finaleMut.mutate(d.id)} className="btn btn-sm" style={{ background: '#EAF3DE', color: '#27500A', border: 'none', fontSize: 10, padding: '2px 8px' }}>
                              <Check size={10} /> Valider Direction
                            </button>
                            <button onClick={() => setShowRejet(d)} className="btn btn-sm" style={{ background: '#FCEBEB', color: '#A32D2D', border: 'none', fontSize: 10, padding: '2px 8px' }}>Rejeter</button>
                          </>
                        )}
                        {d.statut === 'VALIDEE_FINALE' && (
                          <button onClick={() => setShowPayer(d)} className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none', fontSize: 10, padding: '2px 10px' }}>
                            Payer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {depenses.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#ccc', padding: 40, fontSize: 13 }}>Aucune dépense</td></tr>}
            </tbody>
          </table>
        </div>

        <div>
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Répartition</div>
            {statsData.length > 0 ? (
              <>
                <PieChart width={220} height={150}>
                  <Pie data={statsData} cx={105} cy={70} innerRadius={35} outerRadius={65} dataKey="value">
                    {statsData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={v => v.toLocaleString('fr') + ' F'} contentStyle={{ fontSize: 11 }} />
                </PieChart>
                {statsData.slice(0, 5).map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, borderBottom: '0.5px solid #f0efe9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    </div>
                    <span style={{ fontWeight: 500, marginLeft: 4, flexShrink: 0 }}>{(d.value / 1000).toFixed(0)}k</span>
                  </div>
                ))}
              </>
            ) : <div style={{ color: '#ccc', fontSize: 13, textAlign: 'center', padding: 20 }}>Aucune donnée</div>}
          </div>
        </div>
      </div>

      {/* Modal création */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouvelle dépense</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Projet</label>
                <select className="input" value={form.projetId} onChange={e => setForm(f => ({ ...f, projetId: e.target.value }))}>
                  <option value="">Sélectionner un projet</option>
                  {listeProjets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
              <div><label className="label">Catégorie</label>
                <select className="input" value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value, sousCategorie: '' }))}>
                  <option value="">Sélectionner</option>
                  {catKeys.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Sous-catégorie</label>
                <select className="input" value={form.sousCategorie} onChange={e => setForm(f => ({ ...f, sousCategorie: e.target.value }))}>
                  <option value="">—</option>
                  {sousCats.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><label className="label">Montant (FCFA)</label><input className="input" type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} /></div>
              <div><label className="label">Bénéficiaire</label><input className="input" value={form.beneficiaire} onChange={e => setForm(f => ({ ...f, beneficiaire: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Mode de paiement</label>
                <select className="input" value={form.typePaiement} onChange={e => setForm(f => ({ ...f, typePaiement: e.target.value }))}>
                  {['ESPECES', 'ORANGE_MONEY', 'MTN_MONEY', 'MOOV_MONEY', 'WAVE', 'BANQUE'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={() => createMut.mutate({ ...form, montant: Number(form.montant) })}>Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rejet */}
      {showRejet && (
        <div className="modal-overlay" onClick={() => setShowRejet(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'Syne', margin: '0 0 14px', color: '#A32D2D' }}>Rejeter la dépense</h3>
            <label className="label">Motif de rejet <span style={{ color: '#A32D2D' }}>* obligatoire</span></label>
            <textarea className="input" rows={3} value={motifRejet} onChange={e => setMotifRejet(e.target.value)} placeholder="Expliquer la raison du rejet..." style={{ resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowRejet(null)}>Annuler</button>
              <button className="btn btn-sm btn-danger" disabled={!motifRejet} onClick={() => rejeterMut.mutate({ id: showRejet.id, motif: motifRejet })}>Confirmer rejet</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal paiement final */}
      {showPayer && (
        <div className="modal-overlay" onClick={() => setShowPayer(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'Syne', margin: '0 0 14px' }}>Paiement — {showPayer.montant?.toLocaleString('fr')} F</h3>
            <div style={{ background: '#EAF3DE', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>
              Validé par Direction — prêt pour décaissement
            </div>
            <label className="label">Référence virement (optionnel)</label>
            <input className="input" value={refVirement} onChange={e => setRefVirement(e.target.value)} placeholder="N° virement, chèque, bordereau..." />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPayer(null)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#27500A', color: 'white', border: 'none' }} onClick={() => payerMut.mutate({ id: showPayer.id, data: { referenceVirement: refVirement } })}>
                <Check size={13} /> Confirmer paiement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
