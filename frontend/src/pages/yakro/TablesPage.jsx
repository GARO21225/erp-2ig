import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

const ZONES = ['Salle', 'Terrasse', 'VIP', 'Bar', 'Extérieur'];

function ModalTable({ table, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    numero: table?.numero || '',
    nom: table?.nom || '',
    capacite: table?.capacite || 4,
    zone: table?.zone || 'Salle',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>
            {table ? `Modifier Table ${table.numero}` : 'Nouvelle Table'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="form-grid">
          <div>
            <label className="label">Numéro *</label>
            <input className="input" type="number" value={form.numero} onChange={e => set('numero', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Capacité (pers.)</label>
            <input className="input" type="number" min={1} max={20} value={form.capacite} onChange={e => set('capacite', Number(e.target.value))} />
          </div>
          <div className="full">
            <label className="label">Nom / Label (optionnel)</label>
            <input className="input" placeholder="Ex: Table VIP, Terrasse 1..." value={form.nom} onChange={e => set('nom', e.target.value)} />
          </div>
          <div className="full">
            <label className="label">Zone</label>
            <select className="input" value={form.zone} onChange={e => set('zone', e.target.value)}>
              {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={loading || !form.numero} onClick={() => onSave(form)}
            style={{ background: '#8B1A1A', border: 'none' }}>
            {loading ? 'Enregistrement...' : table ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TablesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editTable, setEditTable] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const { data: tables = [] } = useQuery({ queryKey: ['tables'], queryFn: yakroAPI.tables });

  const createMut = useMutation({
    mutationFn: (data) => yakroAPI.createTable(data).then ? yakroAPI.createTable(data) : yakroAPI.createTable(data),
    onSuccess: () => { qc.invalidateQueries(['tables']); setShowCreate(false); showToast('Table créée'); },
    onError: (e) => showToast(e?.response?.data?.error || 'Erreur', 'error'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => yakroAPI.updateTableFull(id, data),
    onSuccess: () => { qc.invalidateQueries(['tables']); setEditTable(null); showToast('Table modifiée'); },
    onError: (e) => showToast(e?.response?.data?.error || 'Erreur', 'error'),
  });
  const deleteMut = useMutation({
    mutationFn: yakroAPI.deleteTable,
    onSuccess: () => { qc.invalidateQueries(['tables']); showToast('Table supprimée'); },
    onError: (e) => showToast(e?.response?.data?.error || 'Erreur', 'error'),
  });

  const zones = [...new Set(tables.map(t => t.zone))];

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Syne', fontWeight: 800, fontSize: 20 }}>Plan de salle — Configuration</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{tables.length} table(s) · {zones.join(' · ')}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}
          style={{ background: '#8B1A1A', border: 'none' }}>
          <Plus size={13} /> Nouvelle table
        </button>
      </div>

      {zones.map(zone => (
        <div key={zone} style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'Syne', fontSize: 14, color: '#888', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>{zone}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {tables.filter(t => t.zone === zone).sort((a,b) => a.numero - b.numero).map(t => (
              <div key={t.id} style={{ border: '1.5px solid #e8e7e1', borderRadius: 10, padding: 12, background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: '#8B1A1A' }}>T{t.numero}</div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button onClick={() => setEditTable(t)} style={{ background: '#EEF3FB', border: 'none', borderRadius: 5, padding: '3px 5px', cursor: 'pointer' }}>
                      <Edit2 size={10} color="#1a3f6f" />
                    </button>
                    <button onClick={() => { if(confirm(`Supprimer Table ${t.numero} ?`)) deleteMut.mutate(t.id); }}
                      style={{ background: '#FCEBEB', border: 'none', borderRadius: 5, padding: '3px 5px', cursor: 'pointer' }}>
                      <Trash2 size={10} color="#A32D2D" />
                    </button>
                  </div>
                </div>
                {t.nom && <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{t.nom}</div>}
                <div style={{ fontSize: 11, color: '#888' }}>{t.capacite} pers.</div>
                <span className={`badge ${t.statut === 'LIBRE' ? 'badge-green' : t.statut === 'OCCUPEE' ? 'badge-red' : 'badge-amber'}`}
                  style={{ fontSize: 10, marginTop: 6 }}>{t.statut}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showCreate && <ModalTable onClose={() => setShowCreate(false)} onSave={(d) => createMut.mutate(d)} loading={createMut.isPending} />}
      {editTable && <ModalTable table={editTable} onClose={() => setEditTable(null)} onSave={(d) => updateMut.mutate({ id: editTable.id, data: d })} loading={updateMut.isPending} />}
      {toast && <div style={{ position:'fixed', bottom:20, right:16, background: toast.type==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>{toast.msg}</div>}
    </div>
  );
}
