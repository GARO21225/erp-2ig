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


// ── Modal Planifier Échéancier ────────────────────────────────────────────────
function ModalPlanifierEcheancier({ vente, onClose, onSave, loading }) {
  const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(2)}M F` : `${Math.round(n||0).toLocaleString('fr')} F`;
  const dejaPaye = (vente.paiements || []).reduce((s, p) => s + p.montant, 0);
  const restant = vente.prixVente - dejaPaye;
  const [form, setForm] = useState({
    nombreEcheances: '12',
    montantTotal: String(Math.round(restant)),
    dateDebut: new Date().toISOString().split('T')[0],
    periodeJours: '30',
  });
  const s = (k,v) => setForm(f => ({...f, [k]: v}));
  const montantEch = form.nombreEcheances > 0 ? Math.round(Number(form.montantTotal) / Number(form.nombreEcheances)) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>📅 Planifier l'échéancier</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ background:'#EEF3FB', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
          <strong>Lot {vente.lot?.numero} — {vente.lot?.projet?.nom}</strong><br/>
          <span style={{ color:'#888' }}>Prix : {fmtF(vente.prixVente)} · Déjà payé : {fmtF(dejaPaye)} · Restant : </span>
          <strong style={{ color:'#A32D2D' }}>{fmtF(restant)}</strong>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label className="label">Montant total à échelonner *</label>
            <input className="input" type="number" value={form.montantTotal} onChange={e=>s('montantTotal',e.target.value)}/>
            <div style={{ fontSize:10, color:'#888', marginTop:2 }}>Restant à payer : {fmtF(restant)}</div>
          </div>
          <div>
            <label className="label">Nombre d'échéances *</label>
            <input className="input" type="number" min={1} max={120} value={form.nombreEcheances} onChange={e=>s('nombreEcheances',e.target.value)}/>
          </div>
          <div>
            <label className="label">Date de début</label>
            <input className="input" type="date" value={form.dateDebut} onChange={e=>s('dateDebut',e.target.value)}/>
          </div>
          <div>
            <label className="label">Fréquence</label>
            <select className="input" value={form.periodeJours} onChange={e=>s('periodeJours',e.target.value)}>
              <option value="30">Mensuelle (30j)</option>
              <option value="15">Bi-mensuelle (15j)</option>
              <option value="90">Trimestrielle (90j)</option>
              <option value="180">Semestrielle (180j)</option>
              <option value="365">Annuelle</option>
            </select>
          </div>
        </div>

        {form.montantTotal && form.nombreEcheances && (
          <div style={{ background:'#EAF3DE', borderRadius:8, padding:'10px 14px', marginTop:14, fontSize:12 }}>
            <div style={{ fontWeight:700, marginBottom:4, color:'#27500A' }}>Aperçu</div>
            <div>{form.nombreEcheances} échéance(s) de <strong>{fmtF(montantEch)}</strong> chacune</div>
            {vente.echeanciers?.length > 0 && (
              <div style={{ color:'#A32D2D', marginTop:4, fontSize:11 }}>
                ⚠ Les {vente.echeanciers.length} échéance(s) non payées seront remplacées
              </div>
            )}
          </div>
        )}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!form.montantTotal||!form.nombreEcheances||loading}
            style={{ background:'#27500A', border:'none' }}
            onClick={() => onSave({
              nombreEcheances: Number(form.nombreEcheances),
              montantTotal: Number(form.montantTotal),
              dateDebut: form.dateDebut,
              periodeJours: Number(form.periodeJours),
            })}>
            {loading ? '...' : "📅 Créer l'échéancier"}
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
  const [paiementFor, setPaiementFor] = useState(null);
  const [planifierFor, setPlanifierFor] = useState(null); // vente pour créer échéancier // { vente, echeance? }

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
              {(!s.ventes || s.ventes.length === 0) && (
                <div style={{ color:'#888', fontSize:13, padding:20, textAlign:'center' }}>Aucune vente enregistrée</div>
              )}
              {(s.ventes||[]).map(v => {
                const pmts = v.paiements || [];
                const totalVentePaye = pmts.reduce((acc, p) => acc + p.montant, 0);
                const paidPct = v.prixVente > 0 ? Math.round(totalVentePaye / v.prixVente * 100) : 0;
                const enRetard = v.echeanciers?.some(e => e.statut === 'RETARD');
                return (
                  <div key={v.id} className="card" style={{ marginBottom:16, borderLeft:`3px solid ${enRetard?'#A32D2D':'#1a3f6f'}` }}>
                    {/* En-tête lot */}
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                      <div>
                        <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:15 }}>
                          📍 Lot {v.lot?.numero} — {v.lot?.projet?.nom}
                        </div>
                        <div style={{ fontSize:12, color:'#888', marginTop:2 }}>
                          {v.lot?.superficie ? `${v.lot.superficie.toLocaleString('fr')} m² · ` : ''}
                          Vendu le {v.dateVente ? new Date(v.dateVente).toLocaleDateString('fr') : '—'}
                        </div>
                      </div>
                      <span style={{ fontSize:11, background:v.statut==='SOLDE'?'#EAF3DE':enRetard?'#FCEBEB':'#EEF3FB', color:v.statut==='SOLDE'?'#27500A':enRetard?'#A32D2D':'#1a3f6f', borderRadius:10, padding:'3px 10px', fontWeight:600, height:'fit-content' }}>
                        {v.statut==='SOLDE'?'✅ Soldé':enRetard?'⚠ Retard':'En cours'}
                      </span>
                    </div>

                    {/* KPIs lot */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:12 }}>
                      {[
                        { label:'Prix vente', value:`${(v.prixVente||0).toLocaleString('fr')} F`, color:'#1a3f6f' },
                        { label:'Payé', value:`${totalVentePaye.toLocaleString('fr')} F`, color:'#27500A' },
                        { label:'Restant', value:`${Math.max(0,v.prixVente-totalVentePaye).toLocaleString('fr')} F`, color:paidPct<100?'#A32D2D':'#27500A' },
                        { label:'Avancement', value:`${paidPct}%`, color:paidPct>=100?'#27500A':paidPct>=50?'#1a3f6f':'#BA7517' },
                      ].map((k,i) => (
                        <div key={i} style={{ background:'#F7F7F5', borderRadius:8, padding:'8px 10px', borderTop:`2px solid ${k.color}` }}>
                          <div style={{ fontSize:10, color:'#888', marginBottom:2 }}>{k.label}</div>
                          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, color:k.color }}>{k.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Barre progression */}
                    <div style={{ height:6, background:'#EEF3FB', borderRadius:3, marginBottom:12 }}>
                      <div style={{ height:'100%', width:`${Math.min(paidPct,100)}%`, background:paidPct>=100?'#27500A':'#1a3f6f', borderRadius:3, transition:'width 0.5s' }}/>
                    </div>

                    {/* Tableau échéancier */}
                    {v.echeanciers?.length > 0 ? (
                      <table className="table-erp" style={{ fontSize:12, marginBottom:10 }}>
                        <thead><tr><th>#</th><th>Dû</th><th>Payé</th><th>Date</th><th>Statut</th><th></th></tr></thead>
                        <tbody>
                          {v.echeanciers.map(e => (
                            <tr key={e.id} style={{ background:e.statut==='RETARD'?'#FDF2F2':e.statut==='PAYE'?'#F5FAF0':undefined }}>
                              <td style={{ fontWeight:600 }}>#{e.numero}</td>
                              <td>{(e.montant||0).toLocaleString('fr')} F</td>
                              <td style={{ color:e.montantPaye>0?'#27500A':'#888' }}>{(e.montantPaye||0).toLocaleString('fr')} F</td>
                              <td style={{ color:e.statut==='RETARD'?'#A32D2D':'#888', fontSize:11 }}>{new Date(e.dateEcheance).toLocaleDateString('fr')}</td>
                              <td>
                                <span style={{ fontSize:10, fontWeight:600, color:e.statut==='PAYE'?'#27500A':e.statut==='RETARD'?'#A32D2D':e.statut==='PARTIEL'?'#BA7517':'#888' }}>
                                  {e.statut==='PAYE'?'✅ Payé':e.statut==='RETARD'?'⚠ Retard':e.statut==='PARTIEL'?'Partiel':'En attente'}
                                </span>
                              </td>
                              <td>
                                {e.statut !== 'PAYE' && (
                                  <button onClick={() => setPaiementFor({ vente:v, echeance:e })}
                                    className="btn btn-sm" style={{ background:'#EEF3FB', color:'#1a3f6f', border:'none', fontSize:10, padding:'2px 8px' }}>
                                    Encaisser
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ background:'#FAEEDA', borderRadius:8, padding:'10px 14px', marginBottom:10, fontSize:12, color:'#BA7517' }}>
                        ⚠ Aucun échéancier — Ce lot a suivi le parcours CRM sans planification d'échéances.
                        Cliquez sur "Planifier échéancier" pour définir le calendrier de paiement.
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button onClick={() => setPaiementFor({ vente:v, echeance:null })}
                        className="btn btn-sm" style={{ background:'#1a3f6f', color:'white', border:'none', fontSize:12 }}>
                        <Plus size={12}/> Paiement libre
                      </button>
                      <button onClick={() => setPlanifierFor(v)}
                        className="btn btn-sm" style={{ background: v.echeanciers?.length > 0 ? '#F7F7F5' : '#27500A', color: v.echeanciers?.length > 0 ? '#888' : 'white', border: v.echeanciers?.length > 0 ? '1px solid #e8e7e1' : 'none', fontSize:12 }}>
                        📅 {v.echeanciers?.length > 0 ? 'Modifier le plan' : 'Planifier échéancier'}
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
              <GEDPanel entiteType="souscripteur" entiteId={s?.id} />
              <div style={{ marginTop: 12 }}>
                <span className="badge badge-toptelsig" style={{ padding: '4px 10px', fontSize: 11 }}>
                  ↑ Upload via API POST /documents
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {planifierFor && (
        <ModalPlanifierEcheancier
          vente={planifierFor}
          onClose={() => setPlanifierFor(null)}
          onSave={data => planifierMut.mutate({ venteId: planifierFor.id, data })}
          loading={planifierMut.isPending}
        />
      )}
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
