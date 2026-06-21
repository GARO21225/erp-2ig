import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expertsAPI } from '../../lib/api';
import { Plus, X, Briefcase, Calendar, CheckCircle } from 'lucide-react';

const STATUTS = [
  ['EN_ATTENTE', 'En attente', '#888', '#F1EFE8'],
  ['EN_COURS',   'En cours',   '#5B21B6', '#EDE9FE'],
  ['TERMINEE',   'Terminée',   '#27500A', '#EAF3DE'],
  ['ANNULEE',    'Annulée',    '#A32D2D', '#FCEBEB'],
];

const FORM_INIT = { expertId: '', titre: '', projetNom: '', description: '', dateDebut: '', dateFin: '', montant: '', rapport: '' };

function ModalMission({ experts, onClose, onSave }) {
  const [form, setForm] = useState(FORM_INIT);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouvelle mission</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label className="label">Expert *</label>
            <select className="input" value={form.expertId} onChange={e => set('expertId', e.target.value)}>
              <option value="">— Sélectionner un expert —</option>
              {experts.filter(e => e.statut === 'ACTIF').map(e => (
                <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.specialite?.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Titre de la mission *</label><input className="input" value={form.titre} onChange={e => set('titre', e.target.value)} /></div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Projet associé</label><input className="input" value={form.projetNom} onChange={e => set('projetNom', e.target.value)} placeholder="Ex: Lotissement Cocody Nord" /></div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} style={{ resize: 'vertical' }} /></div>
          <div><label className="label">Date début</label><input className="input" type="date" value={form.dateDebut} onChange={e => set('dateDebut', e.target.value)} /></div>
          <div><label className="label">Date fin prévue</label><input className="input" type="date" value={form.dateFin} onChange={e => set('dateFin', e.target.value)} /></div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Montant honoraires (FCFA)</label><input className="input" type="number" value={form.montant} onChange={e => set('montant', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: '#5B21B6', color: 'white', border: 'none' }}
            onClick={() => onSave(form)} disabled={!form.expertId || !form.titre}>
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalRapport({ mission, onClose, onSave }) {
  const [statut, setStatut] = useState(mission.statut);
  const [rapport, setRapport] = useState(mission.rapport || '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 15 }}>Mise à jour mission</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#F7F7F5', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{mission.titre}</div>
          <div style={{ fontSize: 11, color: '#888' }}>👤 {mission.expert?.prenom} {mission.expert?.nom}</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Statut</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUTS.map(([k, v, c, bg]) => (
              <button key={k} type="button" onClick={() => setStatut(k)}
                style={{ padding: '5px 12px', borderRadius: 16, border: `1.5px solid ${statut === k ? c : '#e8e7e1'}`, background: statut === k ? bg : 'white', color: statut === k ? c : '#555', fontSize: 11, cursor: 'pointer', fontWeight: statut === k ? 600 : 400 }}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Rapport / Observations</label>
          <textarea className="input" rows={4} value={rapport} onChange={e => setRapport(e.target.value)} style={{ resize: 'vertical' }} placeholder="Résultats, observations, livrables…" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: '#5B21B6', color: 'white', border: 'none' }}
            onClick={() => onSave({ statut, rapport })}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MissionsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editMission, setEditMission] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, t = 'success') => { setToast({ msg, t }); setTimeout(() => setToast(null), 3500); };

  const { data: missions = [] } = useQuery({
    queryKey: ['missions-all', filtreStatut],
    queryFn: () => expertsAPI.missions({ statut: filtreStatut || undefined }),
    refetchInterval: 20000,
  });

  const { data: experts = [] } = useQuery({
    queryKey: ['experts', {}],
    queryFn: () => expertsAPI.list(),
  });

  const createMut = useMutation({
    mutationFn: ({ expertId, ...data }) => expertsAPI.createMission(expertId, data),
    onSuccess: () => { qc.invalidateQueries(['missions-all']); qc.invalidateQueries(['experts-stats']); setShowCreate(false); showToast('Mission créée ✓'); },
    onError: e => showToast(e?.error || 'Erreur', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => expertsAPI.updateMission(id, data),
    onSuccess: () => { qc.invalidateQueries(['missions-all']); qc.invalidateQueries(['experts-stats']); setEditMission(null); showToast('Mission mise à jour ✓'); },
    onError: e => showToast(e?.error || 'Erreur', 'error'),
  });

  const liste = Array.isArray(missions) ? missions : [];

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Missions</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{liste.length} mission(s)</div>
        </div>
        <button className="btn btn-sm" style={{ background: '#5B21B6', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}>
          <Plus size={13} /> Nouvelle mission
        </button>
      </div>

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['', 'Toutes'], ...STATUTS.map(([k, v]) => [k, v])].map(([k, v]) => (
          <button key={k} onClick={() => setFiltreStatut(k)}
            style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, background: filtreStatut === k ? '#5B21B6' : '#F1EFE8', color: filtreStatut === k ? 'white' : '#666', fontWeight: filtreStatut === k ? 600 : 400 }}>
            {v}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table-erp">
          <thead>
            <tr><th>Mission</th><th>Expert</th><th>Projet</th><th>Période</th><th>Montant</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {liste.map(m => {
              const [, label, color, bg] = STATUTS.find(([k]) => k === m.statut) || STATUTS[0];
              const enRetard = m.statut === 'EN_COURS' && m.dateFin && new Date(m.dateFin) < new Date();
              return (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.titre}</div>
                    {m.description && <div style={{ fontSize: 11, color: '#888', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</div>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 500 }}>{m.expert?.prenom} {m.expert?.nom}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{m.expert?.specialite?.replace('_', '-')}</div>
                  </td>
                  <td style={{ fontSize: 12, color: '#555' }}>{m.projetNom || <span style={{ color: '#ccc' }}>—</span>}</td>
                  <td style={{ fontSize: 11 }}>
                    {m.dateDebut && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: enRetard ? '#A32D2D' : '#555' }}>
                        <Calendar size={10} />
                        {new Date(m.dateDebut).toLocaleDateString('fr')}
                        {m.dateFin && <> → {new Date(m.dateFin).toLocaleDateString('fr')}</>}
                        {enRetard && <span style={{ color: '#A32D2D', fontWeight: 700 }}> ⚠</span>}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 600, color: '#5B21B6', fontSize: 12 }}>{m.montant ? m.montant.toLocaleString('fr') + ' F' : '—'}</td>
                  <td><span style={{ fontSize: 10, fontWeight: 600, color, background: bg, borderRadius: 10, padding: '2px 8px' }}>{label}</span></td>
                  <td>
                    <button onClick={() => setEditMission(m)} className="btn btn-sm" style={{ background: '#EDE9FE', color: '#5B21B6', border: 'none', fontSize: 10 }}>
                      <CheckCircle size={10} /> Suivi
                    </button>
                  </td>
                </tr>
              );
            })}
            {liste.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#ccc', padding: 40, fontSize: 13 }}>
                <Briefcase size={28} style={{ marginBottom: 8 }} /><br />Aucune mission
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <ModalMission experts={Array.isArray(experts) ? experts : []} onClose={() => setShowCreate(false)} onSave={d => createMut.mutate(d)} />}
      {editMission && <ModalRapport mission={editMission} onClose={() => setEditMission(null)} onSave={d => updateMut.mutate({ id: editMission.id, data: d })} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: toast.t === 'error' ? '#A32D2D' : '#27500A', color: 'white', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
