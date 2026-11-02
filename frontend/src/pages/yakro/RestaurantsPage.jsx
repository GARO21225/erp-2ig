import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Store, MapPin, Phone, Settings, ShoppingBag } from 'lucide-react';
import { yakroAPI } from '../../lib/api';
import { useRestoStore } from '../../store';
import { useYakro } from '../../lib/useYakro';

const VIDE = { nom: '', ville: '', adresse: '', telephone: '', nbTables: 10, copierPrixDe: '', pourcentage: 0, gerantId: '' };

export default function RestaurantsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setRestaurant = useRestoStore(s => s.setRestaurant);
  const { peut } = useYakro();
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState(VIDE);
  const [erreur, setErreur] = useState('');

  const { data: restaurants = [], isLoading } = useQuery({ queryKey: ['yakro-restaurants'], queryFn: yakroAPI.restaurants });
  const { data: users = [] } = useQuery({ queryKey: ['yakro-users-dispos'], queryFn: yakroAPI.utilisateursDispos, enabled: ouvert });

  const rafraichir = () => { qc.invalidateQueries({ queryKey: ['yakro-restaurants'] }); qc.invalidateQueries({ queryKey: ['yakro-moi'] }); };
  const creer = useMutation({
    mutationFn: () => yakroAPI.creerRestaurant({ ...form, nbTables: Number(form.nbTables) || 0, pourcentage: Number(form.pourcentage) || 0, copierPrixDe: form.copierPrixDe || undefined, gerantId: form.gerantId || undefined }),
    onSuccess: () => { rafraichir(); setOuvert(false); setForm(VIDE); setErreur(''); },
    onError: (e) => setErreur(e?.response?.data?.error || e.message),
  });
  const desactiver = useMutation({ mutationFn: yakroAPI.desactiverRestaurant, onSuccess: rafraichir, onError: (e) => alert(e?.response?.data?.error || e.message) });

  const aller = (r, chemin) => {
    setRestaurant(r.id);
    qc.invalidateQueries({ predicate: q => q.queryKey[0] !== 'yakro-moi' });
    navigate(chemin);
  };
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Mes restaurants</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>Même menu, prix, tables, caisse et équipe propres à chaque restaurant</div>
        </div>
        {peut('restaurants.gerer') && (
          <button className="btn btn-sm" style={{ background: '#8B1A1A', color: 'white', border: 'none' }} onClick={() => setOuvert(true)}>
            <Plus size={13} /> Nouveau restaurant
          </button>
        )}
      </div>

      {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13 }}>Chargement...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
          {restaurants.map(r => (
            <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FDF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Store size={18} color="#8B1A1A" /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nom}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{r.code}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#666', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(r.ville || r.adresse) && <span style={{ display: 'flex', gap: 6 }}><MapPin size={12} style={{ marginTop: 2, flexShrink: 0 }} />{[r.adresse, r.ville].filter(Boolean).join(', ')}</span>}
                {r.telephone && <span style={{ display: 'flex', gap: 6 }}><Phone size={12} style={{ marginTop: 2 }} />{r.telephone}</span>}
                <span>{r.ouverture} – {r.fermeture} · {r.nbTables} table(s) · {r.commandesJour} commande(s) aujourd'hui</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
                <button className="btn btn-sm" style={{ background: '#8B1A1A', color: 'white', border: 'none' }} onClick={() => aller(r, '/yakro/pos')}><ShoppingBag size={13} /> Ouvrir</button>
                <button className="btn btn-sm btn-ghost" onClick={() => aller(r, '/yakro/parametrage')}><Settings size={13} /> Paramétrer</button>
                {peut('restaurants.gerer') && restaurants.length > 1 && (
                  <button className="btn btn-sm btn-ghost" style={{ color: '#A32D2D' }}
                    onClick={() => window.confirm(`Désactiver ${r.nom} ? L'historique est conservé.`) && desactiver.mutate(r.id)}>Désactiver</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {ouvert && (
        <div className="modal-overlay" onClick={() => setOuvert(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne' }}>Nouveau restaurant</h3>
              <button onClick={() => setOuvert(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div className="form-grid">
              <div className="full"><label className="label">Nom *</label><input className="input" value={form.nom} onChange={set('nom')} placeholder="Yakro Grill Cocody" /></div>
              <div><label className="label">Ville</label><input className="input" value={form.ville} onChange={set('ville')} /></div>
              <div><label className="label">Téléphone</label><input className="input" value={form.telephone} onChange={set('telephone')} /></div>
              <div className="full"><label className="label">Adresse</label><input className="input" value={form.adresse} onChange={set('adresse')} /></div>
              <div><label className="label">Nombre de tables</label><input className="input" type="number" min="0" max="200" value={form.nbTables} onChange={set('nbTables')} /></div>
              <div><label className="label">Gérant</label>
                <select className="input" value={form.gerantId} onChange={set('gerantId')}>
                  <option value="">— à définir plus tard —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.role})</option>)}
                </select>
              </div>
              <div><label className="label">Prix : copier depuis</label>
                <select className="input" value={form.copierPrixDe} onChange={set('copierPrixDe')}>
                  <option value="">Prix du menu commun</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
                </select>
              </div>
              <div><label className="label">Ajustement des prix (%)</label><input className="input" type="number" value={form.pourcentage} onChange={set('pourcentage')} disabled={!form.copierPrixDe} /></div>
            </div>
            {erreur && <div style={{ marginTop: 10, padding: '8px 12px', background: '#FCEBEB', color: '#A32D2D', borderRadius: 8, fontSize: 12 }}>{erreur}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setOuvert(false)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#8B1A1A', color: 'white', border: 'none' }}
                disabled={!form.nom.trim() || creer.isPending} onClick={() => creer.mutate()}>
                {creer.isPending ? 'Création...' : 'Créer le restaurant'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 10 }}>Une caisse et les tables sont créées automatiquement. Prix, paramètres et équipe se règlent ensuite dans « Paramétrage ».</div>
          </div>
        </div>
      )}
    </div>
  );
}
