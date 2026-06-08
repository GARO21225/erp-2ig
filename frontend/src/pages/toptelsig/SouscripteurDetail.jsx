import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI } from '../../lib/api';
import { ArrowLeft, Phone, MessageSquare, Plus, X, Check, FileText } from 'lucide-react';
import ExportBar from '../../components/ui/ExportBar';
import { exportPDF } from '../../lib/export';

const STATUT_ECH = { EN_ATTENTE: 'badge-gray', PAYE: 'badge-green', RETARD: 'badge-red', PARTIEL: 'badge-amber' };

function ModalPaiement({ vente, echeance, souscripteurId, onClose, onSave }) {
  const [form, setForm] = useState({
    montant: echeance ? echeance.montant - echeance.montantPaye : '',
    typePaiement: 'ORANGE_MONEY', reference: '', venteId: vente.id,
    echeancierId: echeance?.id || '',
  });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>
            {echeance ? `Payer échéance #${echeance.numero}` : 'Paiement libre'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        {echeance && (
          <div style={{ background: '#EEF3FB', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>
            <div>Lot {vente.lot?.numero} — {vente.lot?.projet?.nom}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              Dû : {echeance.montant?.toLocaleString('fr')} F · Payé : {(echeance.montantPaye || 0).toLocaleString('fr')} F
              · Reste : <strong>{(echeance.montant - echeance.montantPaye).toLocaleString('fr')} F</strong>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Montant (FCFA)</label>
            <input className="input" type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} />
          </div>
          <div><label className="label">Mode de paiement</label>
            <select className="input" value={form.typePaiement} onChange={e => setForm(f => ({ ...f, typePaiement: e.target.value }))}>
              {['ESPECES', 'ORANGE_MONEY', 'MTN_MONEY', 'MOOV_MONEY', 'WAVE', 'BANQUE'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          {form.typePaiement !== 'ESPECES' && (
            <div><label className="label">Référence transaction <span style={{ color: '#A32D2D' }}>*</span></label>
              <input className="input" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="N° transaction..." />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }}
            onClick={() => onSave({ ...form, montant: Number(form.montant) })}>
            <Check size={13} /> Enregistrer paiement
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SouscripteurDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('ventes');
  const [paiementFor, setPaiementFor] = useState(null); // { vente, echeance? }

  const { data: s, isLoading } = useQuery({
    queryKey: ['souscripteur', id],
    queryFn: () => toptelsigAPI.getSouscripteur(id),
    enabled: !!id,
  });

  const paiementMut = useMutation({
    mutationFn: (data) => toptelsigAPI.addPaiement(id, data),
    onSuccess: () => { qc.invalidateQueries(['souscripteur', id]); setPaiementFor(null); }
  });

  const exportFichePDF = () => {
    if (!s) return;
    const paiements = s.ventes?.flatMap(v => v.paiements || []) || [];
    exportPDF(
      `Fiche Souscripteur — ${s.prenom} ${s.nom}`,
      `souscripteur_${s.code}`,
      ['Date', 'Lot', 'Projet', 'Montant', 'Type', 'Référence'],
      paiements.map(p => [
        new Date(p.createdAt).toLocaleDateString('fr'),
        s.ventes?.find(v => v.id === p.venteId)?.lot?.numero || '—',
        s.ventes?.find(v => v.id === p.venteId)?.lot?.projet?.nom || '—',
        p.montant?.toLocaleString('fr') + ' F',
        p.typePaiement?.replace(/_/g, ' '),
        p.reference || '—',
      ]),
      { sousTitre: `Code : ${s.code} · Tel : ${s.telephone}` }
    );
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Chargement...</div>;
  if (!s) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Souscripteur introuvable</div>;

  const tel = (s.telephone || '').replace(/[\s\-\+]/g, '').replace(/^0/, '225');
  const totalPaye = s.ventes?.flatMap(v => v.paiements || []).reduce((sum, p) => sum + p.montant, 0) || 0;
  const totalDu = s.ventes?.reduce((sum, v) => sum + (v.prixVente || 0), 0) || 0;
  const totalRetard = s.ventes?.flatMap(v => v.echeanciers || []).filter(e => e.statut === 'RETARD').length || 0;

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <button onClick={() => navigate('/toptelsig/souscripteurs')}
            style={{ background: '#F1EFE8', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555' }}>
            <ArrowLeft size={14} /> Retour
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>{s.prenom} {s.nom}</h1>
            <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{s.code} · {s.statut}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`tel:${s.telephone}`} className="btn btn-ghost btn-sm">📞 {s.telephone}</a>
          <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">📱 WhatsApp</a>
          <ExportBar onPDFClick={exportFichePDF} />
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Lots acquis', value: s.ventes?.length || 0 },
          { label: 'Total investi', value: (totalDu / 1000000).toFixed(2) + ' M F' },
          { label: 'Total payé', value: (totalPaye / 1000000).toFixed(2) + ' M F' },
          { label: 'Retards', value: totalRetard, alert: totalRetard > 0 },
        ].map(k => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 18, color: k.alert ? '#A32D2D' : '#1a3f6f' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Infos + Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14 }}>
        {/* Infos */}
        <div className="card">
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Informations</div>
          {[['Nom complet', `${s.prenom} ${s.nom}`], ['Téléphone', s.telephone], ['Email', s.email || '—'], ['Adresse', s.adresse || '—'], ['Profession', s.profession || '—'], ['N° CNI', s.numeroCni || '—'], ['Statut', s.statut], ['Prescripteur', s.prescripteur ? `${s.prescripteur.prenom} ${s.prescripteur.nom}` : '—'], ['Enregistré le', new Date(s.createdAt).toLocaleDateString('fr')]].map(([label, val]) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#888' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Onglets */}
        <div>
          <div style={{ display: 'flex', gap: 2, borderBottom: '0.5px solid #e8e7e1', marginBottom: 14 }}>
            {['ventes', 'paiements', 'documents'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '7px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? '#1a1a1a' : '#888', borderBottom: tab === t ? '2px solid #1a3f6f' : '2px solid transparent' }}>
                {t === 'ventes' ? 'Ventes & Échéanciers' : t === 'paiements' ? 'Historique paiements' : 'Documents GED'}
              </button>
            ))}
          </div>

          {/* Ventes & Échéanciers */}
          {tab === 'ventes' && (
            <div>
              {s.ventes?.length === 0 && <div style={{ color: '#888', fontSize: 13, padding: 20, textAlign: 'center' }}>Aucune vente enregistrée</div>}
              {s.ventes?.map(v => {
                const paidPct = v.prixVente > 0 ? Math.round((v.paiements?.reduce((s, p) => s + p.montant, 0) || 0) / v.prixVente * 100) : 0;
                return (
                  <div key={v.id} className="card" style={{ marginBottom: 12, borderLeft: '3px solid #1a3f6f' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>Lot {v.lot?.numero} — {v.lot?.projet?.nom}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{v.lot?.superficie} m² · {v.prixVente?.toLocaleString('fr')} F</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`badge ${v.statut === 'SOLDE' ? 'badge-green' : 'badge-blue'}`}>{v.statut}</span>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{paidPct}% payé</div>
                      </div>
                    </div>
                    {/* Barre progression */}
                    <div style={{ height: 4, background: '#EEF3FB', borderRadius: 2, marginBottom: 12 }}>
                      <div style={{ height: '100%', width: `${paidPct}%`, background: paidPct === 100 ? '#27500A' : '#1a3f6f', borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                    {/* Tableau échéancier */}
                    <table className="table-erp" style={{ fontSize: 12 }}>
                      <thead><tr><th>Éch. #</th><th>Montant dû</th><th>Payé</th><th>Échéance</th><th>Statut</th><th></th></tr></thead>
                      <tbody>
                        {v.echeanciers?.map(e => (
                          <tr key={e.id}>
                            <td>#{e.numero}</td>
                            <td>{e.montant?.toLocaleString('fr')} F</td>
                            <td style={{ color: e.montantPaye > 0 ? '#27500A' : '#888' }}>{(e.montantPaye || 0).toLocaleString('fr')} F</td>
                            <td style={{ color: e.statut === 'RETARD' ? '#A32D2D' : '#888' }}>{new Date(e.dateEcheance).toLocaleDateString('fr')}</td>
                            <td><span className={`badge ${STATUT_ECH[e.statut] || 'badge-gray'}`} style={{ fontSize: 10 }}>{e.statut}</span></td>
                            <td>
                              {e.statut !== 'PAYE' && (
                                <button onClick={() => setPaiementFor({ vente: v, echeance: e })}
                                  className="btn btn-sm" style={{ background: '#EEF3FB', color: '#1a3f6f', border: 'none', fontSize: 10, padding: '2px 8px' }}>
                                  Encaisser
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 10 }}>
                      <button onClick={() => setPaiementFor({ vente: v, echeance: null })}
                        className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none', fontSize: 12 }}>
                        <Plus size={12} /> Paiement libre
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Historique paiements */}
          {tab === 'paiements' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table-erp">
                <thead><tr><th>Date</th><th>Lot / Projet</th><th>Montant</th><th>Type</th><th>Référence</th></tr></thead>
                <tbody>
                  {s.ventes?.flatMap(v =>
                    (v.paiements || []).map(p => ({
                      ...p,
                      lotNum: v.lot?.numero, projetNom: v.lot?.projet?.nom
                    }))
                  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(p => (
                    <tr key={p.id}>
                      <td style={{ fontSize: 12 }}>{new Date(p.createdAt).toLocaleDateString('fr')}</td>
                      <td style={{ fontSize: 12 }}>Lot {p.lotNum} · {p.projetNom}</td>
                      <td style={{ fontWeight: 600, color: '#27500A' }}>{p.montant?.toLocaleString('fr')} F</td>
                      <td><span className="badge badge-toptelsig" style={{ fontSize: 10 }}>{p.typePaiement?.replace(/_/g, ' ')}</span></td>
                      <td style={{ fontSize: 11, color: '#888' }}>{p.reference || '—'}</td>
                    </tr>
                  ))}
                  {!s.ventes?.flatMap(v => v.paiements || []).length && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: '#ccc', padding: 30, fontSize: 13 }}>Aucun paiement</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Documents GED */}
          {tab === 'documents' && (
            <div>
              {s.documents?.length === 0 && (
                                  <GEDPanel entiteType="souscripteur" entiteId={s?.id} />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {s.documents?.map(d => (
                  <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, textDecoration: 'none', color: '#1a1a1a' }}>
                    <FileText size={20} color="#1a3f6f" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{d.nom}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{d.type} · v{d.version}</div>
                    </div>
                  </a>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <span className="badge badge-toptelsig" style={{ padding: '4px 10px', fontSize: 11 }}>
                  ↑ Upload via API POST /documents
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {paiementFor && (
        <ModalPaiement
          vente={paiementFor.vente}
          echeance={paiementFor.echeance}
          souscripteurId={id}
          onClose={() => setPaiementFor(null)}
          onSave={data => paiementMut.mutate(data)}
        />
      )}
    </div>
  );
}
