import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expertsAPI } from '../../lib/api';
import { Plus, X, Users, Phone, Mail, Edit2, Briefcase } from 'lucide-react';

const SPECIALITES = [
  ['GEOMETRE_EXPERT', 'Géomètre-Expert'],
  ['NOTAIRE', 'Notaire'],
  ['ARCHITECTE', 'Architecte'],
  ['EVALUATEUR', 'Évaluateur immobilier'],
  ['JURISTE', 'Juriste / Avocat'],
  ['TOPOGRAPHE', 'Topographe'],
  ['AUTRE', 'Autre'],
];

const SPEC_COLOR = {
  GEOMETRE_EXPERT: '#5B21B6', NOTAIRE: '#1a3f6f', ARCHITECTE: '#27500A',
  EVALUATEUR: '#BA7517', JURISTE: '#8B1A1A', TOPOGRAPHE: '#0F766E', AUTRE: '#888',
};

const FORM_INIT = { nom: '', prenom: '', specialite: 'GEOMETRE_EXPERT', cabinet: '', telephone: '', email: '', numAgrement: '', tarifJour: '', notes: '' };

function ModalExpert({ expert, onClose, onSave }) {
  const [form, setForm] = useState(expert ? {
    nom: expert.nom, prenom: expert.prenom, specialite: expert.specialite,
    cabinet: expert.cabinet || '', telephone: expert.telephone || '',
    email: expert.email || '', numAgrement: expert.numAgrement || '',
    tarifJour: expert.tarifJour || '', notes: expert.notes || '',
  } : FORM_INIT);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>{expert ? 'Modifier l\'expert' : 'Nouvel expert'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label className="label">Nom *</label><input className="input" value={form.nom} onChange={e => set('nom', e.target.value)} /></div>
          <div><label className="label">Prénom *</label><input className="input" value={form.prenom} onChange={e => set('prenom', e.target.value)} /></div>
          <div style={{ gridColumn: '1/-1' }}>
            <label className="label">Spécialité</label>
            <select className="input" value={form.specialite} onChange={e => set('specialite', e.target.value)}>
              {SPECIALITES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Cabinet / Entreprise</label><input className="input" value={form.cabinet} onChange={e => set('cabinet', e.target.value)} /></div>
          <div><label className="label">Téléphone</label><input className="input" value={form.telephone} onChange={e => set('telephone', e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label className="label">N° Agrément / Ordre</label><input className="input" value={form.numAgrement} onChange={e => set('numAgrement', e.target.value)} /></div>
          <div><label className="label">Tarif journalier (FCFA)</label><input className="input" type="number" value={form.tarifJour} onChange={e => set('tarifJour', e.target.value)} /></div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: '#5B21B6', color: 'white', border: 'none' }}
            onClick={() => onSave(form)} disabled={!form.nom || !form.prenom}>
            {expert ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExpertsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editExpert, setEditExpert] = useState(null);
  const [filtreSpec, setFiltreSpec] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('ACTIF');
  const [toast, setToast] = useState(null);

  const showToast = (msg, t = 'success') => { setToast({ msg, t }); setTimeout(() => setToast(null), 3500); };

  const { data: experts = [], isLoading } = useQuery({
    queryKey: ['experts', { specialite: filtreSpec, statut: filtreStatut }],
    queryFn: () => expertsAPI.list({ specialite: filtreSpec || undefined, statut: filtreStatut || undefined }),
  });

  const createMut = useMutation({
    mutationFn: expertsAPI.create,
    onSuccess: () => { qc.invalidateQueries(['experts']); qc.invalidateQueries(['experts-stats']); setShowModal(false); showToast('Expert créé ✓'); },
    onError: e => showToast(e?.error || 'Erreur', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => expertsAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['experts']); setEditExpert(null); showToast('Expert mis à jour ✓'); },
    onError: e => showToast(e?.error || 'Erreur', 'error'),
  });

  const toggleStatut = useMutation({
    mutationFn: ({ id, statut }) => expertsAPI.update(id, { statut }),
    onSuccess: () => qc.invalidateQueries(['experts']),
  });

  const liste = Array.isArray(experts) ? experts : [];

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Répertoire des experts</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{liste.length} expert(s)</div>
        </div>
        <button className="btn btn-sm" style={{ background: '#5B21B6', color: 'white', border: 'none' }} onClick={() => setShowModal(true)}>
          <Plus size={13} /> Nouvel expert
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['', 'Toutes spécialités'], ...SPECIALITES].map(([k, v]) => (
          <button key={k} onClick={() => setFiltreSpec(k)}
            style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, background: filtreSpec === k ? '#5B21B6' : '#F1EFE8', color: filtreSpec === k ? 'white' : '#666', fontWeight: filtreSpec === k ? 600 : 400 }}>
            {v}
          </button>
        ))}
        <div style={{ width: 1, background: '#e8e7e1', margin: '0 4px' }} />
        {[['ACTIF', 'Actifs'], ['INACTIF', 'Inactifs'], ['', 'Tous']].map(([k, v]) => (
          <button key={k} onClick={() => setFiltreStatut(k)}
            style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, background: filtreStatut === k ? '#1a3f6f' : '#F1EFE8', color: filtreStatut === k ? 'white' : '#666', fontWeight: filtreStatut === k ? 600 : 400 }}>
            {v}
          </button>
        ))}
      </div>

      {/* Grille experts */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#ccc' }}>Chargement…</div>
      ) : liste.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#ccc', fontSize: 13 }}>
          <Users size={32} style={{ marginBottom: 10 }} /><br />Aucun expert trouvé
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {liste.map(e => {
            const specColor = SPEC_COLOR[e.specialite] || '#888';
            const specLabel = SPECIALITES.find(([k]) => k === e.specialite)?.[1] || e.specialite;
            const missionsActives = e.missions?.length || 0;
            return (
              <div key={e.id} className="card" style={{ position: 'relative', opacity: e.statut === 'INACTIF' ? 0.65 : 1 }}>
                {/* Badge spécialité */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: specColor, background: `${specColor}15`, borderRadius: 10, padding: '2px 8px' }}>{specLabel}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {e.statut === 'INACTIF' && <span style={{ fontSize: 10, color: '#888', background: '#F1EFE8', borderRadius: 10, padding: '2px 8px' }}>Inactif</span>}
                    <button onClick={() => setEditExpert(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 2 }}><Edit2 size={13} /></button>
                  </div>
                </div>

                {/* Avatar + nom */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${specColor}15`, border: `2px solid ${specColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: specColor, flexShrink: 0 }}>
                    {e.prenom[0]}{e.nom[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{e.prenom} {e.nom}</div>
                    {e.cabinet && <div style={{ fontSize: 11, color: '#888' }}>{e.cabinet}</div>}
                  </div>
                </div>

                {/* Infos contact */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#555', marginBottom: 10 }}>
                  {e.telephone && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Phone size={11} color="#aaa" />{e.telephone}</div>}
                  {e.email && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Mail size={11} color="#aaa" />{e.email}</div>}
                  {e.numAgrement && <div style={{ fontSize: 11, color: '#888' }}>N° {e.numAgrement}</div>}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1EFE8', paddingTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#5B21B6' }}>
                    <Briefcase size={11} />
                    <span>{missionsActives} mission(s) active(s)</span>
                  </div>
                  {e.tarifJour && <span style={{ fontSize: 11, color: '#888' }}>{e.tarifJour.toLocaleString('fr')} F/j</span>}
                </div>

                {/* Toggle actif/inactif */}
                <button
                  onClick={() => toggleStatut.mutate({ id: e.id, statut: e.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF' })}
                  style={{ position: 'absolute', bottom: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#ccc' }}>
                  {e.statut === 'ACTIF' ? '⏸ Désactiver' : '▶ Activer'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <ModalExpert onClose={() => setShowModal(false)} onSave={d => createMut.mutate(d)} />}
      {editExpert && <ModalExpert expert={editExpert} onClose={() => setEditExpert(null)} onSave={d => updateMut.mutate({ id: editExpert.id, data: d })} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: toast.t === 'error' ? '#A32D2D' : '#27500A', color: 'white', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
