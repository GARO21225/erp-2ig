import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { liyaAPI } from '../../lib/api';
import { Plus, X, Truck, CheckCircle } from 'lucide-react';
import FilterBar from '../../components/ui/FilterBar';
import ExportBar from '../../components/ui/ExportBar';
import { exportExcel, exportPDF, exportLivraisons } from '../../lib/export';

const STATUT_MAP = {
  EN_ATTENTE: { label: 'En attente', badge: 'badge-gray', color: '#888' },
  PRISE_EN_CHARGE: { label: 'Prise en charge', badge: 'badge-blue', color: '#1a3f6f' },
  EN_ROUTE: { label: 'En route', badge: 'badge-amber', color: '#BA7517' },
  LIVRE: { label: 'Livré', badge: 'badge-green', color: '#639922' },
  ECHEC: { label: 'Échec', badge: 'badge-red', color: '#A32D2D' },
  ANNULE: { label: 'Annulé', badge: 'badge-red', color: '#A32D2D' },
};

function ModalCreateLivraison({ motos, onClose, onSave }) {
  const [form, setForm] = useState({ clientNom: '', clientTel: '', adressePrise: '', adresseLivraison: '', montant: '', typePaiement: 'ORANGE_MONEY', motoId: '', notes: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouvelle livraison</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label className="label">Nom client</label><input className="input" value={form.clientNom} onChange={e => set('clientNom', e.target.value)} /></div>
          <div><label className="label">Téléphone</label><input className="input" value={form.clientTel} onChange={e => set('clientTel', e.target.value)} /></div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Adresse de prise en charge</label><input className="input" value={form.adressePrise} onChange={e => set('adressePrise', e.target.value)} /></div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Adresse de livraison</label><input className="input" value={form.adresseLivraison} onChange={e => set('adresseLivraison', e.target.value)} /></div>
          <div><label className="label">Montant (FCFA)</label><input className="input" type="number" value={form.montant} onChange={e => set('montant', e.target.value)} /></div>
          <div><label className="label">Paiement</label>
            <select className="input" value={form.typePaiement} onChange={e => set('typePaiement', e.target.value)}>
              {['ESPECES', 'ORANGE_MONEY', 'WAVE', 'MTN_MONEY'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Moto assignée</label>
            <select className="input" value={form.motoId} onChange={e => set('motoId', e.target.value)}>
              <option value="">Non assignée</option>
              {(motos || []).filter(m => m.statut === 'DISPONIBLE').map(m => <option key={m.id} value={m.id}>{m.immatriculation} — {m.marque}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: '#E85D04', color: 'white', border: 'none' }} onClick={() => onSave({ ...form, montant: Number(form.montant) })}>Créer</button>
        </div>
      </div>
    </div>
  );
}

export default function LivraisonsPage() {
  const qc = useQueryClient();
  const [statut, setStatut] = useState('');
  const [filtreDates, setFiltreDates] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data } = useQuery({
    queryKey: ['livraisons', statut, filtreDates],
    queryFn: () => liyaAPI.livraisons({
      statut: statut || undefined,
      dateDebut: filtreDates?.debut?.toISOString(),
      dateFin: filtreDates?.fin?.toISOString(),
    }),
    refetchInterval: 15000
  });
  const { data: stats } = useQuery({ queryKey: ['stats-liya'], queryFn: liyaAPI.stats, refetchInterval: 15000 });
  const { data: motos } = useQuery({ queryKey: ['motos'], queryFn: liyaAPI.motos });

  const createMut = useMutation({ mutationFn: liyaAPI.createLivraison, onSuccess: () => { qc.invalidateQueries(['livraisons']); setShowCreate(false); } });
  const updateStatut = useMutation({ mutationFn: ({ id, statut }) => liyaAPI.updateStatut(id, statut), onSuccess: () => { qc.invalidateQueries(['livraisons']); qc.invalidateQueries(['stats-liya']); } });

  const livraisons = data?.data || [];

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Livraisons</h1>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <div className="dot dot-pulse" style={{ background: '#E85D04', marginTop: 2 }} />
            <span style={{ fontSize: 12, color: '#888' }}>Temps réel · {stats?.enCours || 0} en transit</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <FilterBar onChange={setFiltreDates} defaultPreset="today" color="#E85D04" />
          <ExportBar
            onExcelClick={() => { const { entetes, lignes } = exportLivraisons(livraisons); exportExcel('livraisons_liya', 'Livraisons', entetes, lignes); }}
            onPDFClick={() => { const { entetes, lignes } = exportLivraisons(livraisons); exportPDF('Rapport Livraisons LiYA', 'livraisons_liya', entetes, lignes, { orientation: 'landscape' }); }}
            count={livraisons.length}
          />
          <button className="btn btn-sm" style={{ background: '#E85D04', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}><Plus size={13} /> Nouvelle livraison</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Livraisons / jour', value: stats?.total || 0, color: '#E85D04' },
          { label: 'Livrées', value: stats?.livrees || 0, color: '#639922' },
          { label: 'En transit', value: stats?.enCours || 0, color: '#BA7517' },
          { label: 'Taux réussite', value: (stats?.tauxReussite || 0) + '%', color: '#1a3f6f' },
          { label: 'CA du jour', value: ((stats?.caJour || 0) / 1000).toFixed(0) + 'k F', color: '#E85D04' },
        ].map(k => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 20, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['', 'Toutes'], ['EN_ATTENTE', 'En attente'], ['EN_ROUTE', 'En route'], ['LIVRE', 'Livrées'], ['ECHEC', 'Échecs']].map(([k, v]) => (
          <button key={k} onClick={() => setStatut(k)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, background: statut === k ? '#E85D04' : '#F1EFE8', color: statut === k ? 'white' : '#666', fontWeight: statut === k ? 600 : 400 }}>{v}</button>
        ))}
      </div>

      {/* Liste */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table-erp">
          <thead>
            <tr><th>N° Livraison</th><th>Client</th><th>Itinéraire</th><th>Moto</th><th>Montant</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {livraisons.map(l => {
              const s = STATUT_MAP[l.statut] || STATUT_MAP.EN_ATTENTE;
              return (
                <tr key={l.id}>
                  <td><span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: '#E85D04' }}>{l.numero}</span></td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{l.clientNom}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{l.clientTel}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div style={{ color: '#888', marginBottom: 2 }}>📍 {l.adressePrise}</div>
                    <div>🏁 {l.adresseLivraison}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{l.moto?.immatriculation || <span style={{ color: '#ccc' }}>Non assignée</span>}</td>
                  <td style={{ fontWeight: 600, color: '#E85D04' }}>{l.montant?.toLocaleString('fr')} F</td>
                  <td><span className={`badge ${s.badge}`}>{s.label}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {l.statut === 'EN_ATTENTE' && <button onClick={() => updateStatut.mutate({ id: l.id, statut: 'PRISE_EN_CHARGE' })} className="btn btn-sm" style={{ background: '#E6F1FB', color: '#042C53', border: 'none', fontSize: 10 }}>Prendre</button>}
                      {l.statut === 'PRISE_EN_CHARGE' && <button onClick={() => updateStatut.mutate({ id: l.id, statut: 'EN_ROUTE' })} className="btn btn-sm" style={{ background: '#FAEEDA', color: '#412402', border: 'none', fontSize: 10 }}>En route</button>}
                      {l.statut === 'EN_ROUTE' && (
                        <>
                          <button onClick={() => updateStatut.mutate({ id: l.id, statut: 'LIVRE' })} className="btn btn-sm" style={{ background: '#EAF3DE', color: '#27500A', border: 'none', fontSize: 10 }}><CheckCircle size={10} /> Livré</button>
                          <button onClick={() => updateStatut.mutate({ id: l.id, statut: 'ECHEC' })} className="btn btn-sm" style={{ background: '#FCEBEB', color: '#A32D2D', border: 'none', fontSize: 10 }}>Échec</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {livraisons.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#ccc', padding: 40, fontSize: 13 }}><Truck size={28} style={{ marginBottom: 8 }} /><br />Aucune livraison</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && <ModalCreateLivraison motos={Array.isArray(motos) ? motos : []} onClose={() => setShowCreate(false)} onSave={d => createMut.mutate(d)} />}
    </div>
  );
}
