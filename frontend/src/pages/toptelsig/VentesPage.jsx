import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI } from '../../lib/api';
import { Plus, X, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import FilterBar from '../../components/ui/FilterBar';
import ExportBar from '../../components/ui/ExportBar';
import { exportExcel, exportPDF } from '../../lib/export';

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

// Modal paiement sur une échéance spécifique
function ModalEncaisserEcheance({ vente, echeance, onClose, onSave }) {
  const [form, setForm] = useState({
    montant: echeance.montant - echeance.montantPaye,
    typePaiement: 'ORANGE_MONEY',
    reference: '',
    notes: '',
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Encaisser échéance #{echeance.numero}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ background: '#F7F7F5', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
            {vente.souscripteur?.prenom} {vente.souscripteur?.nom} · Lot {vente.lot?.numero} · {vente.lot?.projet?.nom}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: '#888' }}>Montant total</div>
              <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'Syne' }}>{echeance.montant.toLocaleString('fr')} F</div>
            </div>
            {echeance.montantPaye > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#888' }}>Déjà payé</div>
                <div style={{ fontWeight: 600, color: '#27500A' }}>{echeance.montantPaye.toLocaleString('fr')} F</div>
              </div>
            )}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#A32D2D' }}>Reste dû</div>
              <div style={{ fontWeight: 700, color: '#A32D2D', fontSize: 16 }}>{(echeance.montant - echeance.montantPaye).toLocaleString('fr')} F</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="label">Montant encaissé (FCFA)</label>
            <input className="input" type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} />
          </div>
          <div>
            <label className="label">Mode de paiement</label>
            <select className="input" value={form.typePaiement} onChange={e => setForm(f => ({ ...f, typePaiement: e.target.value }))}>
              {['ESPECES', 'ORANGE_MONEY', 'MTN_MONEY', 'MOOV_MONEY', 'WAVE', 'BANQUE'].map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          {form.typePaiement !== 'ESPECES' && (
            <div>
              <label className="label">Référence transaction <span style={{ color: '#A32D2D' }}>*</span></label>
              <input className="input" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="N° Orange Money, virement..." />
            </div>
          )}
          <div>
            <label className="label">Notes (optionnel)</label>
            <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }}
            onClick={() => onSave({ venteId: vente.id, echeancierId: echeance.id, ...form, montant: Number(form.montant) })}>
            <CheckCircle size={13} /> Encaisser
          </button>
        </div>
      </div>
    </div>
  );
}

// Panel détail vente avec échéancier ligne par ligne
function PanelVente({ vente, onClose, onEncaisser }) {
  const total = vente.echeanciers?.length || 0;
  const payees = vente.echeanciers?.filter(e => e.statut === 'PAYE').length || 0;
  const totalPaye = vente.echeanciers?.reduce((s, e) => s + e.montantPaye, 0) || 0;
  const progression = total > 0 ? Math.round((payees / total) * 100) : 0;

  return (
    <div style={{ position: 'fixed', right: 0, top: 56, bottom: 0, width: 480, background: 'white', borderLeft: '0.5px solid #e8e7e1', zIndex: 500, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #e8e7e1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 15 }}>{vente.souscripteur?.prenom} {vente.souscripteur?.nom}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Lot {vente.lot?.numero} · {vente.lot?.projet?.nom}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a3f6f', marginTop: 4 }}>{vente.prixVente?.toLocaleString('fr')} F</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
      </div>

      {/* Progression */}
      <div style={{ padding: '12px 20px', background: '#F7F7F5', borderBottom: '0.5px solid #e8e7e1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: '#888' }}>Encaissements {payees}/{total} échéances</span>
          <span style={{ fontWeight: 700, color: '#1a3f6f' }}>{progression}%</span>
        </div>
        <div style={{ height: 6, background: '#EEF3FB', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progression}%`, background: progression === 100 ? '#27500A' : '#1a3f6f', borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
          <span style={{ color: '#27500A', fontWeight: 600 }}>Perçu : {totalPaye.toLocaleString('fr')} F</span>
          <span style={{ color: '#A32D2D', fontWeight: 600 }}>Restant : {(vente.prixVente - totalPaye).toLocaleString('fr')} F</span>
        </div>
      </div>

      {/* Tableau échéancier */}
      <div style={{ flex: 1 }}>
        <div style={{ padding: '10px 20px 4px', fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>Échéancier détaillé</div>
        {(vente.echeanciers || []).sort((a, b) => a.numero - b.numero).map(ech => {
          const cfg = STATUT_ECH[ech.statut] || STATUT_ECH.EN_ATTENTE;
          const isActionnable = ['EN_ATTENTE', 'PARTIEL', 'RETARD'].includes(ech.statut);
          const resteEch = ech.montant - ech.montantPaye;
          return (
            <div key={ech.id} style={{ padding: '12px 20px', borderBottom: '0.5px solid #f0efe9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: cfg.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: cfg.color, flexShrink: 0 }}>
                {ech.numero}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{ech.montant.toLocaleString('fr')} F</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.color + '15', padding: '2px 8px', borderRadius: 10 }}>{cfg.label}</span>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {new Date(ech.dateEcheance).toLocaleDateString('fr', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {ech.montantPaye > 0 && ech.statut !== 'PAYE' && (
                    <span style={{ color: '#27500A', marginLeft: 8 }}>· Déjà payé : {ech.montantPaye.toLocaleString('fr')} F</span>
                  )}
                </div>
              </div>
              {isActionnable && (
                <button onClick={() => onEncaisser(vente, ech)}
                  style={{ padding: '5px 12px', background: '#1a3f6f', color: 'white', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  Encaisser
                </button>
              )}
              {ech.statut === 'PAYE' && <CheckCircle size={18} color="#27500A" />}
            </div>
          );
        })}
      </div>

      {/* Infos souscripteur */}
      <div style={{ padding: '14px 20px', borderTop: '0.5px solid #e8e7e1', background: '#F7F7F5' }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Contact souscripteur</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`tel:${vente.souscripteur?.telephone}`} style={{ padding: '5px 12px', background: '#EAF3DE', color: '#27500A', borderRadius: 7, textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>📞 {vente.souscripteur?.telephone}</a>
          <a href={`https://wa.me/${(vente.souscripteur?.telephone || '').replace(/[\s\-\+]/g, '').replace(/^0/, '225')}`} target="_blank" rel="noreferrer"
            style={{ padding: '5px 12px', background: '#FFF0EB', color: '#E85D04', borderRadius: 7, textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>📱 WhatsApp</a>
        </div>
      </div>
    </div>
  );
}

export default function VentesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showRetards, setShowRetards] = useState(false);
  const [selectedVente, setSelectedVente] = useState(null);
  const [encaisserTarget, setEncaisserTarget] = useState(null); // { vente, echeance }
  const [filtreDates, setFiltreDates] = useState(null);
  const [form, setForm] = useState({ projetId: '', lotId: '', souscripteurId: '', prixVente: '', nombreEcheances: 12, prescripteurId: '' });
  const [lotsDispos, setLotsDispos] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);

  const handleProjetChange = async (projetId) => {
    setForm(f => ({ ...f, projetId, lotId: '', prixVente: '' }));
    setLotsDispos([]);
    if (!projetId) return;
    setLoadingLots(true);
    try {
      const data = await toptelsigAPI.lotsDispo(projetId);
      setLotsDispos(Array.isArray(data) ? data : []);
    } catch { setLotsDispos([]); }
    finally { setLoadingLots(false); }
  };

  const handleLotChange = (lotId) => {
    const lot = lotsDispos.find(l => l.id === lotId);
    setForm(f => ({ ...f, lotId, prixVente: lot ? lot.prix : '' }));
  };

  const { data } = useQuery({
    queryKey: ['ventes', filtreDates],
    queryFn: () => toptelsigAPI.ventes({ limit: 100 }),
  });
  const { data: retards } = useQuery({ queryKey: ['retards'], queryFn: toptelsigAPI.retards });
  const { data: lots } = useQuery({ queryKey: ['lots-dispo'], queryFn: () => toptelsigAPI.lots({ statut: 'DISPONIBLE' }) });
  const { data: projets } = useQuery({
    queryKey: ['projets'],
    queryFn: toptelsigAPI.projets,
  });

  const { data: souscripteurs } = useQuery({ queryKey: ['sous-all'], queryFn: () => toptelsigAPI.souscripteurs({ limit: 200 }) });

  const createMut = useMutation({ mutationFn: toptelsigAPI.createVente, onSuccess: () => { qc.invalidateQueries(['ventes']); setShowCreate(false); } });
  const paiementMut = useMutation({
    mutationFn: ({ souscripteurId, data }) => toptelsigAPI.addPaiement(souscripteurId, data),
    onSuccess: () => { qc.invalidateQueries(['ventes']); setEncaisserTarget(null); }
  });

  const ventes = data?.data || [];
  const nbRetards = Array.isArray(retards) ? retards.length : 0;
  const totalCA = ventes.reduce((s, v) => s + v.prixVente, 0);
  const totalPercu = ventes.reduce((s, v) => s + (v.echeanciers?.reduce((ss, e) => ss + e.montantPaye, 0) || 0), 0);

  const exportData = () => {
    const entetes = ['Souscripteur', 'Téléphone', 'Lot', 'Projet', 'Prix vente', 'Statut', 'Échéances payées', 'Date vente'];
    const lignes = ventes.map(v => {
      const payees = v.echeanciers?.filter(e => e.statut === 'PAYE').length || 0;
      return [
        `${v.souscripteur?.prenom} ${v.souscripteur?.nom}`,
        v.souscripteur?.telephone || '—',
        `Lot ${v.lot?.numero}`, v.lot?.projet?.nom || '—',
        v.prixVente?.toLocaleString('fr') + ' F', v.statut,
        `${payees}/${v.echeanciers?.length || 0}`,
        new Date(v.dateVente).toLocaleDateString('fr'),
      ];
    });
    exportExcel('ventes_toptelsig', 'Ventes foncières', entetes, lignes);
  };

  return (
    <div className="page-enter" style={{ paddingRight: selectedVente ? 496 : 0, transition: 'padding-right 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Ventes & Échéanciers</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
            CA total : <strong style={{ color: '#1a3f6f' }}>{(totalCA / 1000000).toFixed(2)} M F</strong>
            {' · '}Perçu : <strong style={{ color: '#27500A' }}>{(totalPercu / 1000000).toFixed(2)} M F</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {nbRetards > 0 && (
            <button onClick={() => setShowRetards(!showRetards)} className="btn btn-sm"
              style={{ background: '#FCEBEB', color: '#A32D2D', border: 'none' }}>
              <AlertTriangle size={13} /> {nbRetards} retard(s)
            </button>
          )}
          <ExportBar onExcelClick={exportData} count={ventes.length} />
          <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}>
            <Plus size={13} /> Nouvelle vente
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Ventes actives', value: ventes.filter(v => v.statut === 'EN_COURS').length, color: '#1a3f6f' },
          { label: 'Soldées', value: ventes.filter(v => v.statut === 'SOLDE').length, color: '#27500A' },
          { label: 'Retards paiement', value: nbRetards, color: nbRetards > 0 ? '#A32D2D' : '#888' },
          { label: 'Taux encaissement', value: totalCA > 0 ? Math.round((totalPercu / totalCA) * 100) + '%' : '—', color: '#1a3f6f' },
        ].map(k => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Retards */}
      {showRetards && Array.isArray(retards) && retards.length > 0 && (
        <div className="card" style={{ marginBottom: 14, border: '1px solid #F7C1C1', background: '#FEF8F8' }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: '#A32D2D', marginBottom: 10 }}>⚠ Échéanciers en retard</div>
          {retards.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #F7C1C1', fontSize: 12 }}>
              <div>
                <span style={{ fontWeight: 600 }}>{r.vente?.souscripteur?.prenom} {r.vente?.souscripteur?.nom}</span>
                <span style={{ color: '#888', marginLeft: 8 }}>Lot {r.vente?.lot?.numero} · {r.vente?.lot?.projet?.nom}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ color: '#A32D2D', fontWeight: 700 }}>{r.montant?.toLocaleString('fr')} F</span>
                <span style={{ color: '#888' }}>Dû le {new Date(r.dateEcheance).toLocaleDateString('fr')}</span>
                <button onClick={() => { const v = ventes.find(v => v.id === r.venteId); if (v) { setSelectedVente(v); setShowRetards(false); } }}
                  style={{ padding: '3px 10px', background: '#1a3f6f', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  Voir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tableau ventes */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table-erp">
          <thead>
            <tr><th>Souscripteur</th><th>Lot / Projet</th><th>Prix vente</th><th>Statut</th><th>Progression</th><th>Date</th><th></th></tr>
          </thead>
          <tbody>
            {ventes.map(v => {
              const total = v.echeanciers?.length || 0;
              const payees = v.echeanciers?.filter(e => e.statut === 'PAYE').length || 0;
              const enRetard = v.echeanciers?.filter(e => e.statut === 'RETARD').length || 0;
              const pct = total > 0 ? Math.round((payees / total) * 100) : 0;
              const cfg = STATUT_VENTE[v.statut] || STATUT_VENTE.EN_COURS;
              const isSelected = selectedVente?.id === v.id;
              return (
                <tr key={v.id} onClick={() => setSelectedVente(isSelected ? null : v)}
                  style={{ cursor: 'pointer', background: isSelected ? '#EEF3FB' : undefined }}>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{v.souscripteur?.prenom} {v.souscripteur?.nom}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{v.souscripteur?.telephone}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>Lot {v.lot?.numero} {v.lot?.ilot ? `· ${v.lot.ilot}` : ''}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{v.lot?.projet?.nom}</div>
                  </td>
                  <td style={{ fontWeight: 700, color: '#1a3f6f' }}>{v.prixVente?.toLocaleString('fr')} F</td>
                  <td><span className={`badge ${cfg.badge}`}>{cfg.label}</span></td>
                  <td style={{ minWidth: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ height: 5, flex: 1, background: '#EEF3FB', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: enRetard > 0 ? '#A32D2D' : '#1a3f6f', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: enRetard > 0 ? '#A32D2D' : '#888', fontWeight: enRetard > 0 ? 600 : 400, minWidth: 50 }}>
                        {payees}/{total} {enRetard > 0 && `(${enRetard}⚠)`}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 11, color: '#888' }}>{new Date(v.dateVente).toLocaleDateString('fr')}</td>
                  <td><ChevronRight size={14} color={isSelected ? '#1a3f6f' : '#ccc'} /></td>
                </tr>
              );
            })}
            {ventes.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#ccc', padding: 40, fontSize: 13 }}>Aucune vente enregistrée</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Panel détail vente */}
      {selectedVente && (
        <PanelVente
          vente={selectedVente}
          onClose={() => setSelectedVente(null)}
          onEncaisser={(vente, ech) => setEncaisserTarget({ vente, echeance: ech })}
        />
      )}

      {/* Modal encaissement */}
      {encaisserTarget && (
        <ModalEncaisserEcheance
          vente={encaisserTarget.vente}
          echeance={encaisserTarget.echeance}
          onClose={() => setEncaisserTarget(null)}
          onSave={(data) => paiementMut.mutate({ souscripteurId: encaisserTarget.vente.souscripteurId, data })}
        />
      )}

      {/* Modal nouvelle vente */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouvelle vente foncière</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* 1. Sélectionner le projet */}
              <div>
                <label className="label">Projet foncier</label>
                <select className="input" value={form.projetId} onChange={e => handleProjetChange(e.target.value)}>
                  <option value="">— Choisir un projet —</option>
                  {(Array.isArray(projets) ? projets : []).map(p => (
                    <option key={p.id} value={p.id}>{p.nom} — {p.ville} ({p.code})</option>
                  ))}
                </select>
              </div>

              {/* 2. Lot disponible dans ce projet */}
              <div>
                <label className="label">
                  Lot disponible
                  {form.projetId && <span style={{ color: '#888', fontWeight: 400, marginLeft: 6 }}>
                    {loadingLots ? 'Chargement...' : `${lotsDispos.length} lot(s) disponible(s)`}
                  </span>}
                </label>
                <select className="input" value={form.lotId} onChange={e => handleLotChange(e.target.value)}
                  disabled={!form.projetId || loadingLots}>
                  <option value="">{!form.projetId ? "Sélectionner un projet d'abord" : "Choisir un lot"}</option>
                  {lotsDispos.map(l => (
                    <option key={l.id} value={l.id}>
                      Lot {l.numero}{l.ilot ? ` — Îlot ${l.ilot}` : ''} — {l.superficie} m² — {l.prix?.toLocaleString('fr')} F
                    </option>
                  ))}
                </select>
                {form.lotId && lotsDispos.find(l => l.id === form.lotId) && (
                  <div style={{ fontSize: 11, color: '#1a3f6f', marginTop: 4, background: '#EEF3FB', borderRadius: 6, padding: '4px 8px' }}>
                    Prix catalogue : {lotsDispos.find(l => l.id === form.lotId)?.prix?.toLocaleString('fr')} F — {lotsDispos.find(l => l.id === form.lotId)?.superficie} m²
                  </div>
                )}
              </div>
              <div>
                <label className="label">Souscripteur</label>
                <select className="input" value={form.souscripteurId} onChange={e => setForm(f => ({ ...f, souscripteurId: e.target.value }))}>
                  <option value="">Sélectionner</option>
                  {(souscripteurs?.data || []).map(s => (
                    <option key={s.id} value={s.id}>{s.prenom} {s.nom} — {s.telephone}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Prix de vente (FCFA)</label>
                <input className="input" type="number" value={form.prixVente} onChange={e => setForm(f => ({ ...f, prixVente: e.target.value }))} />
              </div>
              <div>
                <label className="label">Nombre d'échéances mensuelles</label>
                <input className="input" type="number" min={1} max={60} value={form.nombreEcheances} onChange={e => setForm(f => ({ ...f, nombreEcheances: Number(e.target.value) }))} />
              </div>
              {form.prixVente && form.nombreEcheances > 0 && (
                <div style={{ background: '#EEF3FB', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1a3f6f' }}>
                  Mensualité : <strong>{Math.round(Number(form.prixVente) / form.nombreEcheances).toLocaleString('fr')} FCFA / mois</strong>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }}
                onClick={() => createMut.mutate({ ...form, prixVente: Number(form.prixVente) })}>
                Créer la vente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
