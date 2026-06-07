import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import { Plus, X, Calendar } from 'lucide-react';

export default function ReservationsYakro() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ tableId: '', nomClient: '', telephone: '', dateHeure: '', nbPersonnes: 2, notes: '' });

  const { data: reservations } = useQuery({ queryKey: ['reservations', date], queryFn: () => yakroAPI.reservations({ date }) });
  const { data: tables } = useQuery({ queryKey: ['tables'], queryFn: yakroAPI.tables });
  const createMut = useMutation({ mutationFn: yakroAPI.createReservation, onSuccess: () => { qc.invalidateQueries(['reservations']); setShowCreate(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, statut }) => yakroAPI.updateReservation(id, statut), onSuccess: () => qc.invalidateQueries(['reservations']) });

  const list = Array.isArray(reservations) ? reservations : [];

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Réservations</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" style={{ width: 160 }} />
          <button className="btn btn-sm" style={{ background: '#8B1A1A', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}><Plus size={13} /> Réserver</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {list.map(r => (
          <div key={r.id} className="card" style={{ borderLeft: `3px solid ${r.statut === 'CONFIRMEE' ? '#BA7517' : r.statut === 'HONOREE' ? '#639922' : '#ccc'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.nomClient}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{r.telephone}</div>
              </div>
              <span className={`badge ${r.statut === 'CONFIRMEE' ? 'badge-amber' : r.statut === 'HONOREE' ? 'badge-green' : 'badge-gray'}`}>{r.statut}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 12 }}><span style={{ color: '#888' }}>Table : </span>T{r.table?.numero} ({r.table?.zone})</div>
              <div style={{ fontSize: 12 }}><span style={{ color: '#888' }}>Personnes : </span>{r.nbPersonnes}</div>
              <div style={{ fontSize: 12 }}><span style={{ color: '#888' }}>Heure : </span>{new Date(r.dateHeure).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            {r.notes && <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 10 }}>{r.notes}</div>}
            {r.statut === 'CONFIRMEE' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => updateMut.mutate({ id: r.id, statut: 'HONOREE' })} className="btn btn-sm" style={{ background: '#EAF3DE', color: '#27500A', border: 'none', flex: 1 }}>Honorée</button>
                <button onClick={() => updateMut.mutate({ id: r.id, statut: 'ANNULEE' })} className="btn btn-sm" style={{ background: '#FCEBEB', color: '#A32D2D', border: 'none', flex: 1 }}>Annuler</button>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#ccc', fontSize: 13 }}><Calendar size={32} style={{ marginBottom: 8 }} /><br />Aucune réservation pour ce jour</div>}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouvelle réservation</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Table</label>
                <select className="input" value={form.tableId} onChange={e => setForm(f => ({ ...f, tableId: e.target.value }))}>
                  <option value="">Choisir une table</option>
                  {(tables || []).filter(t => t.statut === 'LIBRE').map(t => <option key={t.id} value={t.id}>Table {t.numero} — {t.zone} ({t.capacite} pers.)</option>)}
                </select>
              </div>
              <div><label className="label">Nom client</label><input className="input" value={form.nomClient} onChange={e => setForm(f => ({ ...f, nomClient: e.target.value }))} /></div>
              <div><label className="label">Téléphone</label><input className="input" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} /></div>
              <div><label className="label">Date & heure</label><input className="input" type="datetime-local" value={form.dateHeure} onChange={e => setForm(f => ({ ...f, dateHeure: e.target.value }))} /></div>
              <div><label className="label">Nb personnes</label><input className="input" type="number" min={1} value={form.nbPersonnes} onChange={e => setForm(f => ({ ...f, nbPersonnes: Number(e.target.value) }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#8B1A1A', color: 'white', border: 'none' }} onClick={() => createMut.mutate(form)}>Réserver</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
