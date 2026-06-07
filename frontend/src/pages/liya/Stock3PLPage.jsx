import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stock3plAPI } from '../../lib/api';
import { Plus, X, Package } from 'lucide-react';

export default function Stock3PLPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showSortie, setShowSortie] = useState(null);
  const [form, setForm] = useState({ clientNom: '', clientTel: '', article: '', quantite: '', unite: 'carton', notes: '' });
  const [qteSortie, setQteSortie] = useState('');

  const { data } = useQuery({ queryKey: ['stock3pl'], queryFn: () => stock3plAPI.list({ limit: 50 }) });
  const createMut = useMutation({ mutationFn: stock3plAPI.create, onSuccess: () => { qc.invalidateQueries(['stock3pl']); setShowCreate(false); } });
  const sortieMut = useMutation({ mutationFn: ({ id, data }) => stock3plAPI.sortie(id, data), onSuccess: () => { qc.invalidateQueries(['stock3pl']); setShowSortie(null); } });

  const list = data?.data || [];
  const statsClient = data?.statsClient || [];
  const enStock = list.filter(s => s.statut === 'EN_STOCK' || s.statut === 'SORTI_PARTIEL').length;

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Stock Clients 3PL</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>Stockage pour boutiques partenaires · {enStock} articles en stock</div>
        </div>
        <button className="btn btn-sm" style={{ background: '#E85D04', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}>
          <Plus size={13} /> Nouvelle entrée
        </button>
      </div>

      {/* Stats clients */}
      {statsClient.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
          {statsClient.map(c => (
            <div key={c.clientNom} className="kpi">
              <div className="kpi-label">{c.clientNom}</div>
              <div className="kpi-value" style={{ fontSize: 18, color: '#E85D04' }}>{c._sum?.quantite || 0}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{c._count?.id || 0} référence(s) en stock</div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table-erp">
          <thead><tr><th>Client</th><th>Article</th><th>Quantité</th><th>Entrée</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {list.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{s.clientNom}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{s.clientTel}</div>
                </td>
                <td style={{ fontSize: 13 }}>{s.article}</td>
                <td style={{ fontWeight: 600, fontSize: 14, color: s.quantite === 0 ? '#888' : '#E85D04' }}>{s.quantite} {s.unite}</td>
                <td style={{ fontSize: 11, color: '#888' }}>{new Date(s.dateEntree).toLocaleDateString('fr')}</td>
                <td>
                  <span className={`badge ${s.statut === 'EN_STOCK' ? 'badge-green' : s.statut === 'SORTI_PARTIEL' ? 'badge-amber' : 'badge-gray'}`}>
                    {s.statut.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  {s.statut !== 'SORTI_TOTAL' && (
                    <button onClick={() => setShowSortie(s)} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}>Sortie</button>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#ccc', padding: 40, fontSize: 13 }}>
              <Package size={28} style={{ marginBottom: 8 }} /><br />Aucun stock client enregistré
            </td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouvelle entrée stock client</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="label">Nom client / Boutique</label><input className="input" value={form.clientNom} onChange={e => setForm(f => ({ ...f, clientNom: e.target.value }))} /></div>
              <div><label className="label">Téléphone</label><input className="input" value={form.clientTel} onChange={e => setForm(f => ({ ...f, clientTel: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Article / Désignation</label><input className="input" value={form.article} onChange={e => setForm(f => ({ ...f, article: e.target.value }))} /></div>
              <div><label className="label">Quantité</label><input className="input" type="number" value={form.quantite} onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))} /></div>
              <div><label className="label">Unité</label>
                <select className="input" value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}>
                  {['carton', 'pièce', 'kg', 'litre', 'sac', 'palette', 'colis'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#E85D04', color: 'white', border: 'none' }} onClick={() => createMut.mutate({ ...form, quantite: Number(form.quantite) })}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showSortie && (
        <div className="modal-overlay" onClick={() => setShowSortie(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'Syne', margin: '0 0 16px' }}>Sortie — {showSortie.article}</h3>
            <div style={{ background: '#F7F7F5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
              Stock actuel : <strong>{showSortie.quantite} {showSortie.unite}</strong> · Client : {showSortie.clientNom}
            </div>
            <div><label className="label">Quantité à sortir</label>
              <input className="input" type="number" min="1" max={showSortie.quantite} value={qteSortie} onChange={e => setQteSortie(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSortie(null)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#E85D04', color: 'white', border: 'none' }} onClick={() => sortieMut.mutate({ id: showSortie.id, data: { quantiteSortie: Number(qteSortie) } })}>Valider sortie</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
