import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { Plus, TrendingUp, TrendingDown, Wallet, X, Check } from 'lucide-react';
import FilterBar from '../../components/ui/FilterBar';
import ExportBar from '../../components/ui/ExportBar';
import { exportExcel, exportPDF, exportEncaissements } from '../../lib/export';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';

const TYPE_PMT_LABELS = { ESPECES: 'Espèces', ORANGE_MONEY: 'Orange Money', WAVE: 'Wave', BANQUE: 'Banque', MTN_MONEY: 'MTN Money' };
const FILIALES_COLORS = { YAKRO_GRILL: '#8B1A1A', TOPTELSIG: '#1a3f6f', LIYA: '#E85D04', GROUPE: '#444' };

function ModalTransaction({ type, caisses, onClose, onSave }) {
  const [form, setForm] = useState({ caisseId: caisses?.[0]?.id || '', montant: '', typePaiement: 'ESPECES', motif: '', reference: '', filiale: caisses?.[0]?.filiale || 'YAKRO_GRILL' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isEnc = type === 'enc';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>{isEnc ? '↑ Encaissement' : '↓ Décaissement'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Caisse</label>
            <select className="input" value={form.caisseId} onChange={e => {
              const c = caisses.find(c => c.id === e.target.value);
              setForm(f => ({ ...f, caisseId: e.target.value, filiale: c?.filiale || f.filiale }));
            }}>
              {caisses?.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.filiale})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Montant (FCFA)</label>
            <input className="input" type="number" value={form.montant} onChange={e => set('montant', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="label">Moyen de paiement</label>
            <select className="input" value={form.typePaiement} onChange={e => set('typePaiement', e.target.value)}>
              {Object.entries(TYPE_PMT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Motif</label>
            <input className="input" value={form.motif} onChange={e => set('motif', e.target.value)} />
          </div>
          <div>
            <label className="label">Référence (optionnel)</label>
            <input className="input" value={form.reference} onChange={e => set('reference', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" style={{ background: isEnc ? '#27500A' : '#A32D2D' }} onClick={() => onSave({ ...form, montant: Number(form.montant) })}>
            {isEnc ? '↑ Enregistrer encaissement' : '↓ Enregistrer décaissement'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const { filiale } = useAuthStore();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [rapportMois, setRapportMois] = useState(new Date().getMonth() + 1);
  const [rapportAnnee] = useState(new Date().getFullYear());
  const [filtreDates, setFiltreDates] = useState(null);

  const { data: caisses } = useQuery({ queryKey: ['caisses'], queryFn: () => financeAPI.caisses() });
  const { data: encData } = useQuery({
    queryKey: ['encaissements', filtreDates],
    queryFn: () => financeAPI.encaissements({ limit: 50, dateDebut: filtreDates?.debut?.toISOString(), dateFin: filtreDates?.fin?.toISOString() })
  });
  const { data: decData } = useQuery({
    queryKey: ['decaissements', filtreDates],
    queryFn: () => financeAPI.decaissements({ limit: 50, dateDebut: filtreDates?.debut?.toISOString(), dateFin: filtreDates?.fin?.toISOString() })
  });
  const { data: rapport } = useQuery({ queryKey: ['rapport', rapportMois, rapportAnnee], queryFn: () => financeAPI.rapport({ mois: rapportMois, annee: rapportAnnee }) });

  const encMut = useMutation({ mutationFn: financeAPI.addEncaissement, onSuccess: () => { qc.invalidateQueries(['encaissements']); qc.invalidateQueries(['caisses']); setModal(null); } });
  const decMut = useMutation({ mutationFn: financeAPI.addDecaissement, onSuccess: () => { qc.invalidateQueries(['decaissements']); setModal(null); } });
  const validerDec = useMutation({ mutationFn: ({ id, data }) => financeAPI.validerDecaissement(id, data), onSuccess: () => qc.invalidateQueries(['decaissements']) });

  const encaissements = encData?.data || [];
  const decaissements = decData?.data || [];
  const listeCaisses = Array.isArray(caisses) ? caisses : [];

  const totalCaisses = listeCaisses.reduce((s, c) => s + (c.solde || 0), 0);
  const totalEnc = encData?.totalMontant || 0;

  const rapportData = rapport?.rapport
    ? Object.entries(rapport.rapport).map(([filiale, d]) => ({ name: filiale.replace('_', ' '), encaissements: d.encaissements, decaissements: d.decaissements, resultat: d.resultat }))
    : [];

  const pieData = listeCaisses.filter(c => c.solde > 0).map(c => ({ name: c.nom, value: c.solde, color: FILIALES_COLORS[c.filiale] || '#888' }));

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Finance Groupe</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>Caisses, flux, rapport consolidé</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterBar onChange={setFiltreDates} defaultPreset="month" color="#1a3f6f" />
          <ExportBar
            onExcelClick={() => { const { entetes, lignes } = exportEncaissements(encaissements); exportExcel('encaissements_2ig', 'Encaissements', entetes, lignes); }}
            onPDFClick={() => { const { entetes, lignes } = exportEncaissements(encaissements); exportPDF('Rapport Encaissements', 'finance_2ig', entetes, lignes); }}
          />
          <button className="btn btn-sm" style={{ background: '#EAF3DE', color: '#27500A', border: 'none' }} onClick={() => setModal('enc')}><TrendingUp size={13} /> Encaissement</button>
          <button className="btn btn-sm" style={{ background: '#FCEBEB', color: '#A32D2D', border: 'none' }} onClick={() => setModal('dec')}><TrendingDown size={13} /> Décaissement</button>
        </div>
      </div>

      {/* Caisses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div className="kpi" style={{ gridColumn: '1', background: 'linear-gradient(135deg, #1a3f6f, #2d5f9f)', color: 'white', border: 'none' }}>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Trésorerie Totale</div>
          <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 22, letterSpacing: -0.5 }}>{(totalCaisses / 1000000).toFixed(2)} M</div>
          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>FCFA — {listeCaisses.length} caisses</div>
        </div>
        {listeCaisses.map(c => (
          <div key={c.id} className="kpi">
            <div className="kpi-label">{c.nom}</div>
            <div className="kpi-value" style={{ fontSize: 16 }}>{(c.solde || 0).toLocaleString('fr')}</div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>FCFA · {c.filiale}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Rapport mensuel */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13 }}>Rapport mensuel</div>
            <select value={rapportMois} onChange={e => setRapportMois(Number(e.target.value))} style={{ border: '0.5px solid #e8e7e1', borderRadius: 6, padding: '3px 8px', fontSize: 12 }}>
              {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{new Date(2024, i).toLocaleString('fr', { month: 'long' })}</option>)}
            </select>
          </div>
          {rapportData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={rapportData}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={v => v.toLocaleString('fr') + ' FCFA'} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="encaissements" fill="#27500A" radius={[2, 2, 0, 0]} name="Encaissements" />
                <Bar dataKey="decaissements" fill="#A32D2D" radius={[2, 2, 0, 0]} name="Décaissements" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 13 }}>Aucune donnée pour ce mois</div>
          )}
        </div>

        {/* Répartition caisses */}
        <div className="card">
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Répartition trésorerie</div>
          {pieData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <PieChart width={120} height={120}>
                <Pie data={pieData} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div style={{ flex: 1 }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, borderBottom: '0.5px solid #f0efe9' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                      <span>{d.name}</span>
                    </div>
                    <span style={{ fontWeight: 500 }}>{(d.value / 1000).toFixed(0)}k</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 13 }}>Caisses vides</div>
          )}
        </div>
      </div>

      {/* Transactions récentes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f0efe9', fontFamily: 'Syne', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#27500A' }}>↑</span> Encaissements récents
          </div>
          <table className="table-erp">
            <thead><tr><th>Motif</th><th>Type</th><th>Montant</th><th>Date</th></tr></thead>
            <tbody>
              {encaissements.slice(0, 8).map(e => (
                <tr key={e.id}>
                  <td style={{ fontSize: 12 }}>{e.motif}</td>
                  <td><span className="badge badge-gray">{TYPE_PMT_LABELS[e.typePaiement] || e.typePaiement}</span></td>
                  <td style={{ fontWeight: 500, fontSize: 13, color: '#27500A' }}>+{e.montant?.toLocaleString('fr')}</td>
                  <td style={{ fontSize: 11, color: '#888' }}>{new Date(e.createdAt).toLocaleDateString('fr')}</td>
                </tr>
              ))}
              {encaissements.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#888', fontSize: 12, padding: 20 }}>Aucun encaissement</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f0efe9', fontFamily: 'Syne', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#A32D2D' }}>↓</span> Décaissements récents
          </div>
          <table className="table-erp">
            <thead><tr><th>Motif</th><th>Montant</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {decaissements.slice(0, 8).map(d => (
                <tr key={d.id}>
                  <td style={{ fontSize: 12 }}>{d.motif}</td>
                  <td style={{ fontWeight: 500, fontSize: 13, color: '#A32D2D' }}>-{d.montant?.toLocaleString('fr')}</td>
                  <td><span className={`badge ${d.valide ? 'badge-green' : 'badge-amber'}`}>{d.valide ? 'Validé' : 'En attente'}</span></td>
                  <td>
                    {!d.valide && (
                      <button onClick={() => validerDec.mutate({ id: d.id, data: { caisseId: d.caisseId, montant: d.montant } })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#27500A' }}>
                        <Check size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {decaissements.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#888', fontSize: 12, padding: 20 }}>Aucun décaissement</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'enc' && <ModalTransaction type="enc" caisses={listeCaisses} onClose={() => setModal(null)} onSave={d => encMut.mutate(d)} />}
      {modal === 'dec' && <ModalTransaction type="dec" caisses={listeCaisses} onClose={() => setModal(null)} onSave={d => decMut.mutate(d)} />}
    </div>
  );
}
