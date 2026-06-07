import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { prescripteursAPI } from '../../lib/api';
import { Plus, X, Search, Phone, TrendingUp } from 'lucide-react';

export default function PrescripteursPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '', email: '', typePersonne: 'PHYSIQUE', raisonSociale: '', tauxCommission: 3, ribOuMobile: '' });

  const { data } = useQuery({ queryKey: ['prescripteurs', search], queryFn: () => prescripteursAPI.list({ search: search || undefined, limit: 50 }) });
  const createMut = useMutation({ mutationFn: prescripteursAPI.create, onSuccess: () => { qc.invalidateQueries(['prescripteurs']); setShowCreate(false); } });
  const desactiverMut = useMutation({ mutationFn: prescripteursAPI.desactiver, onSuccess: () => qc.invalidateQueries(['prescripteurs']) });

  const list = data?.data || [];

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Prescripteurs</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{data?.total || 0} prescripteurs · Apporteurs d'affaires fonciers</div>
        </div>
        <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}>
          <Plus size={13} /> Nouveau prescripteur
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 8, padding: '6px 12px', marginBottom: 14 }}>
        <Search size={14} color="#888" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, téléphone, code..." style={{ border: 'none', outline: 'none', fontSize: 13, flex: 1 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {list.map(p => (
          <div key={p.id} className="card" style={{ borderTop: `2px solid ${p.actif ? '#1a3f6f' : '#ccc'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>{p.prenom} {p.nom}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{p.typePersonne === 'MORALE' ? p.raisonSociale : p.telephone} · {p.code}</div>
              </div>
              <span className={`badge ${p.actif ? 'badge-toptelsig' : 'badge-gray'}`}>{p.actif ? 'Actif' : 'Inactif'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ background: '#F7F7F5', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Syne', color: '#1a3f6f' }}>{p._count?.souscripteurs || 0}</div>
                <div style={{ fontSize: 10, color: '#888' }}>Souscripteurs</div>
              </div>
              <div style={{ background: '#EEF3FB', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Syne', color: '#BA7517' }}>{(p.totalCommissionsAttente / 1000 || 0).toFixed(0)}k</div>
                <div style={{ fontSize: 10, color: '#888' }}>Dues (F)</div>
              </div>
              <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Syne', color: '#27500A' }}>{p.tauxCommission}%</div>
                <div style={{ fontSize: 10, color: '#888' }}>Taux</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <a href={`tel:${p.telephone}`} className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', fontSize: 11 }}>📞 Appeler</a>
              <a href={`https://wa.me/${(p.telephone || '').replace(/[\s\-\+]/g, '').replace(/^0/, '225')}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', fontSize: 11 }}>📱 WhatsApp</a>
              {p.actif && (
                <button onClick={() => { if (window.confirm('Désactiver ?')) desactiverMut.mutate(p.id); }} className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#A32D2D' }}>Désactiver</button>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#ccc', fontSize: 13 }}>Aucun prescripteur enregistré</div>}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouveau prescripteur</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['PHYSIQUE', 'MORALE'].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, typePersonne: t }))}
                      style={{ flex: 1, padding: '8px', border: `1.5px solid ${form.typePersonne === t ? '#1a3f6f' : '#e8e7e1'}`, borderRadius: 8, background: form.typePersonne === t ? '#EEF3FB' : 'white', cursor: 'pointer', fontSize: 13, fontWeight: form.typePersonne === t ? 600 : 400, color: form.typePersonne === t ? '#1a3f6f' : '#555' }}>
                      {t === 'PHYSIQUE' ? '👤 Personne physique' : '🏢 Personne morale'}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="label">Nom</label><input className="input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} /></div>
              <div><label className="label">Prénom</label><input className="input" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} /></div>
              {form.typePersonne === 'MORALE' && (
                <div style={{ gridColumn: '1/-1' }}><label className="label">Raison sociale</label><input className="input" value={form.raisonSociale} onChange={e => setForm(f => ({ ...f, raisonSociale: e.target.value }))} /></div>
              )}
              <div><label className="label">Téléphone</label><input className="input" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} /></div>
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><label className="label">Taux commission (%)</label><input className="input" type="number" step="0.5" min="0" max="20" value={form.tauxCommission} onChange={e => setForm(f => ({ ...f, tauxCommission: Number(e.target.value) }))} /></div>
              <div><label className="label">RIB ou Mobile Money</label><input className="input" value={form.ribOuMobile} onChange={e => setForm(f => ({ ...f, ribOuMobile: e.target.value }))} placeholder="Pour virement commissions" /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={() => createMut.mutate(form)}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
