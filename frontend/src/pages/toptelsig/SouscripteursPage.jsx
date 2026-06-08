import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toptelsigAPI } from '../../lib/api';
import { Plus, X, Search, ChevronRight } from 'lucide-react';
import TemplateButton from '../../components/ui/TemplateButton';
import ExportBar from '../../components/ui/ExportBar';
import ImportButton from '../../components/ui/ImportButton';
import { exportExcel, exportPDF, exportSouscripteurs } from '../../lib/export';

// ══════════════════════════════════════════════════
// SOUSCRIPTEURS
// ══════════════════════════════════════════════════
function ModalPaiement({ souscripteur, onClose, onSave }) {
  const [form, setForm] = useState({ montant: '', typePaiement: 'ORANGE_MONEY', reference: '', venteId: souscripteur?.ventes?.[0]?.id || '', echeancierId: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const vente = souscripteur?.ventes?.find(v => v.id === form.venteId);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Enregistrer un paiement</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Vente</label>
            <select className="input" value={form.venteId} onChange={e => set('venteId', e.target.value)}>
              {souscripteur?.ventes?.map(v => <option key={v.id} value={v.id}>Lot {v.lot?.numero || ''} — {v.prixVente?.toLocaleString('fr')} F</option>)}
            </select>
          </div>
          {vente && (
            <div><label className="label">Échéance</label>
              <select className="input" value={form.echeancierId} onChange={e => set('echeancierId', e.target.value)}>
                <option value="">Paiement libre</option>
                {vente.echeanciers?.filter(e => e.statut !== 'PAYE').map(e => (
                  <option key={e.id} value={e.id}>Éch. #{e.numero} — {e.montant?.toLocaleString('fr')} F — {new Date(e.dateEcheance).toLocaleDateString('fr')}</option>
                ))}
              </select>
            </div>
          )}
          <div><label className="label">Montant (FCFA)</label><input className="input" type="number" value={form.montant} onChange={e => set('montant', e.target.value)} /></div>
          <div><label className="label">Mode de paiement</label>
            <select className="input" value={form.typePaiement} onChange={e => set('typePaiement', e.target.value)}>
              {['ESPECES', 'ORANGE_MONEY', 'WAVE', 'BANQUE', 'MTN_MONEY'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div><label className="label">Référence / Numéro transaction</label><input className="input" value={form.reference} onChange={e => set('reference', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={() => onSave({ ...form, montant: Number(form.montant) })}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

export function SouscripteursPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [paiementFor, setPaiementFor] = useState(null);
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '', email: '', adresse: '', profession: '' });

  const { data } = useQuery({ queryKey: ['souscripteurs', search], queryFn: () => toptelsigAPI.souscripteurs({ search: search || undefined, limit: 50 }) });
  const createMut = useMutation({ mutationFn: toptelsigAPI.createSouscripteur, onSuccess: () => { qc.invalidateQueries(['souscripteurs']); setShowCreate(false); } });
  const paiementMut = useMutation({ mutationFn: ({ id, data }) => toptelsigAPI.addPaiement(id, data), onSuccess: () => { qc.invalidateQueries(['souscripteurs']); setPaiementFor(null); } });

  const list = data?.data || [];

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Souscripteurs</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{data?.total || 0} souscripteurs enregistrés</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ExportBar
            onExcelClick={() => { const { entetes, lignes } = exportSouscripteurs(list); exportExcel('souscripteurs_2ig', 'Souscripteurs', entetes, lignes); }}
            onPDFClick={() => { const { entetes, lignes } = exportSouscripteurs(list); exportPDF('Liste des Souscripteurs', 'souscripteurs_2ig', entetes, lignes); }}
            count={list.length}
          />
          <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}><Plus size={13} /> Nouveau</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 8, padding: '6px 12px', marginBottom: 14 }}>
        <Search size={14} color="#888" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, téléphone, code..." style={{ border: 'none', outline: 'none', fontSize: 13, flex: 1 }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table-erp">
          <thead><tr><th>Souscripteur</th><th>Contact</th><th>Code</th><th>Lots</th><th>Prescripteur</th><th></th></tr></thead>
          <tbody>
            {list.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{s.prenom} {s.nom}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{s.profession || '—'}</div>
                </td>
                <td style={{ fontSize: 12 }}>{s.telephone}</td>
                <td><span className="badge badge-toptelsig">{s.code}</span></td>
                <td>
                  {s.ventes?.map(v => (
                    <div key={v.id} style={{ fontSize: 11 }}>
                      <span className={`badge ${v.statut === 'SOLDE' ? 'badge-green' : v.statut === 'EN_COURS' ? 'badge-amber' : 'badge-red'}`}>{v.statut}</span>
                    </div>
                  ))}
                  {!s.ventes?.length && <span style={{ fontSize: 11, color: '#ccc' }}>—</span>}
                </td>
                <td style={{ fontSize: 12, color: '#888' }}>{s.prescripteur ? `${s.prescripteur.prenom} ${s.prescripteur.nom}` : '—'}</td>
                <td>
                  <button onClick={() => setPaiementFor(s)} className="btn btn-sm" style={{ background: '#EEF3FB', color: '#1a3f6f', border: 'none', fontSize: 11 }}>+ Paiement</button>
                  <button onClick={() => navigate(`/toptelsig/souscripteurs/${s.id}`)} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}><ChevronRight size={12} /> Fiche</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#ccc', padding: 40, fontSize: 13 }}>Aucun souscripteur</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouveau souscripteur</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['Nom', 'nom'], ['Prénom', 'prenom'], ['Téléphone', 'telephone'], ['Email', 'email'], ['Adresse', 'adresse'], ['Profession', 'profession']].map(([label, key]) => (
                <div key={key}><label className="label">{label}</label><input className="input" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} /></div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={() => createMut.mutate(form)}>Créer</button>
            </div>
          </div>
        </div>
      )}

      {paiementFor && <ModalPaiement souscripteur={paiementFor} onClose={() => setPaiementFor(null)} onSave={d => paiementMut.mutate({ id: paiementFor.id, data: d })} />}
    </div>
  );
}

export default SouscripteursPage;
