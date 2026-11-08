import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Trash2, Plus, UserPlus } from 'lucide-react';
import { yakroAPI } from '../../lib/api';
import { useYakro } from '../../lib/useYakro';
import TablesPage from './TablesPage';
import RestaurantsPage from './RestaurantsPage';

const ROUGE = '#8B1A1A';
const msgErreur = (e) => e?.response?.data?.error || e?.message || 'Erreur';

function Bandeau({ ok, erreur }) {
  if (!ok && !erreur) return null;
  return <div style={{ margin: '10px 0', padding: '8px 12px', borderRadius: 8, fontSize: 12, background: erreur ? '#FCEBEB' : '#EAF3DE', color: erreur ? '#A32D2D' : '#27500A' }}>{erreur || ok}</div>;
}

function useRetour() {
  const [etat, setEtat] = useState({});
  return [etat, {
    ok: (m = 'Enregistré') => { setEtat({ ok: m }); setTimeout(() => setEtat({}), 2500); },
    erreur: (e) => setEtat({ erreur: msgErreur(e) }),
  }];
}

// ── Général ────────────────────────────────────────────────────────────────
function OngletGeneral({ r }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(r);
  const [etat, retour] = useRetour();
  useEffect(() => setForm(r), [r.id]);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const sauver = useMutation({
    mutationFn: () => yakroAPI.majRestaurant(r.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['yakro-moi'] }); qc.invalidateQueries({ queryKey: ['yakro-restaurants'] }); retour.ok(); },
    onError: retour.erreur,
  });
  return (
    <div className="card">
      <div className="form-grid">
        <div className="full"><label className="label">Nom du restaurant</label><input className="input" value={form.nom || ''} onChange={set('nom')} /></div>
        <div><label className="label">Ville</label><input className="input" value={form.ville || ''} onChange={set('ville')} /></div>
        <div><label className="label">Téléphone</label><input className="input" value={form.telephone || ''} onChange={set('telephone')} /></div>
        <div className="full"><label className="label">Adresse</label><input className="input" value={form.adresse || ''} onChange={set('adresse')} /></div>
        <div><label className="label">Ouverture</label><input className="input" type="time" value={form.ouverture || ''} onChange={set('ouverture')} /></div>
        <div><label className="label">Fermeture</label><input className="input" type="time" value={form.fermeture || ''} onChange={set('fermeture')} /></div>
        <div><label className="label">Devise</label><input className="input" value={form.devise || ''} onChange={set('devise')} /></div>
        <div><label className="label">TVA (%)</label><input className="input" type="number" min="0" value={form.tvaTaux ?? 0} onChange={set('tvaTaux')} /></div>
        <div className="full"><label className="label">En-tête du ticket / facture</label><input className="input" value={form.enteteTicket || ''} onChange={set('enteteTicket')} /></div>
        <div className="full"><label className="label">Pied du ticket / facture</label><input className="input" value={form.piedTicket || ''} onChange={set('piedTicket')} placeholder="Merci de votre visite !" /></div>
      </div>
      <Bandeau {...etat} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-sm" style={{ background: ROUGE, color: 'white', border: 'none' }} disabled={sauver.isPending} onClick={() => sauver.mutate()}><Save size={13} /> Enregistrer</button>
      </div>
    </div>
  );
}

// ── Prix ───────────────────────────────────────────────────────────────────
function OngletPrix({ r, restos, peutModifier }) {
  const qc = useQueryClient();
  const [edits, setEdits] = useState({});
  const [recherche, setRecherche] = useState('');
  const [cat, setCat] = useState('');
  const [src, setSrc] = useState('');
  const [pct, setPct] = useState(0);
  const [etat, retour] = useRetour();
  const { data: lignes = [], isLoading } = useQuery({ queryKey: ['yakro-prix', r.id], queryFn: () => yakroAPI.prixRestaurant(r.id) });
  useEffect(() => setEdits({}), [r.id]);

  const val = (l) => edits[l.menuId] ?? { prix: String(l.prix), disponible: l.disponible };
  const categories = useMemo(() => [...new Set(lignes.map(l => l.categorie))], [lignes]);
  const visibles = lignes.filter(l => (!cat || l.categorie === cat) && l.nom.toLowerCase().includes(recherche.toLowerCase()));
  const modifies = lignes.filter(l => { const e = edits[l.menuId]; return e && (Number(e.prix) !== l.prix || e.disponible !== l.disponible); });

  const maj = (l, patch) => setEdits(m => ({ ...m, [l.menuId]: { ...val(l), ...patch } }));
  const apres = () => { setEdits({}); qc.invalidateQueries({ queryKey: ['yakro-prix', r.id] }); qc.invalidateQueries({ queryKey: ['menu'] }); };

  const sauver = useMutation({
    mutationFn: () => yakroAPI.majPrix(r.id, modifies.map(l => {
      const e = edits[l.menuId];
      const prix = e.prix === '' || (Number(e.prix) === l.prixBase && e.disponible) ? null : Number(e.prix);
      return { menuId: l.menuId, prix, disponible: e.disponible };
    })),
    onSuccess: () => { apres(); retour.ok(`${modifies.length} prix enregistrés`); }, onError: retour.erreur,
  });
  const copier = useMutation({
    mutationFn: () => yakroAPI.copierPrix(r.id, { depuisId: src, pourcentage: Number(pct) || 0 }),
    onSuccess: (d) => { apres(); retour.ok(`${d.copies} prix copiés`); }, onError: retour.erreur,
  });

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '0.5px solid #e8e7e1' }}>
        <input className="input" style={{ flex: '1 1 160px', minWidth: 0 }} placeholder="Rechercher un plat…" value={recherche} onChange={e => setRecherche(e.target.value)} />
        <select className="input" style={{ flex: '0 1 180px' }} value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        {peutModifier && (
          <button className="btn btn-sm" style={{ background: ROUGE, color: 'white', border: 'none' }} disabled={!modifies.length || sauver.isPending} onClick={() => sauver.mutate()}>
            <Save size={13} /> Enregistrer{modifies.length ? ` (${modifies.length})` : ''}
          </button>
        )}
      </div>
      {peutModifier && restos.length > 1 && (
        <div style={{ padding: '8px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#FAFAF8', borderBottom: '0.5px solid #e8e7e1', fontSize: 12 }}>
          <span style={{ color: '#666' }}>Copier les prix de</span>
          <select className="input" style={{ width: 'auto' }} value={src} onChange={e => setSrc(e.target.value)}>
            <option value="">— choisir —</option>
            {restos.filter(x => x.id !== r.id).map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}
          </select>
          <span style={{ color: '#666' }}>ajustés de</span>
          <input className="input" type="number" style={{ width: 70 }} value={pct} onChange={e => setPct(e.target.value)} /> %
          <button className="btn btn-sm btn-ghost" disabled={!src || copier.isPending}
            onClick={() => window.confirm('Remplacer tous les prix de ce restaurant ?') && copier.mutate()}>Copier</button>
        </div>
      )}
      <div style={{ padding: '0 12px' }}><Bandeau {...etat} /></div>
      <div style={{ overflowX: 'auto' }}>
        {isLoading ? <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Chargement...</div> : (
          <table className="table-erp">
            <thead><tr><th>Plat</th><th>Prix commun</th><th>Prix {r.nom}</th><th>Dispo</th></tr></thead>
            <tbody>
              {visibles.map(l => {
                const v = val(l);
                const diff = Number(v.prix) !== l.prixBase;
                return (
                  <tr key={l.menuId}>
                    <td><div style={{ fontWeight: 500, fontSize: 13 }}>{l.nom}</div><div style={{ fontSize: 10, color: '#999' }}>{l.categorie.replace(/_/g, ' ')}</div></td>
                    <td style={{ color: '#888', fontSize: 12 }}>{l.prixBase.toLocaleString('fr')}</td>
                    <td>
                      <input className="input" type="number" min="0" style={{ width: 110, fontWeight: 600, color: diff ? ROUGE : undefined, borderColor: edits[l.menuId] ? ROUGE : undefined }}
                        value={v.prix} disabled={!peutModifier} onChange={e => maj(l, { prix: e.target.value })} />
                    </td>
                    <td><input type="checkbox" checked={v.disponible} disabled={!peutModifier} onChange={e => maj(l, { disponible: e.target.checked })} aria-label={`${l.nom} disponible`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Paramètres ─────────────────────────────────────────────────────────────
function OngletParametres({ r, peutModifier }) {
  const qc = useQueryClient();
  const [vals, setVals] = useState(null);
  const [etat, retour] = useRetour();
  const { data: cat } = useQuery({ queryKey: ['yakro-catalogue'], queryFn: yakroAPI.catalogue, staleTime: Infinity });
  const { data: actuels } = useQuery({ queryKey: ['yakro-params', r.id], queryFn: () => yakroAPI.parametres(r.id) });
  useEffect(() => { if (actuels) setVals(actuels); }, [actuels]);
  const sauver = useMutation({
    mutationFn: () => yakroAPI.majParametres(r.id, vals),
    onSuccess: (d) => { qc.setQueryData(['yakro-params', r.id], d); retour.ok(); }, onError: retour.erreur,
  });
  if (!cat || !vals) return <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Chargement...</div>;
  const groupes = cat.parametres.reduce((a, p) => ((a[p.groupe] ||= []).push(p), a), {});
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {Object.entries(groupes).map(([g, liste]) => (
        <div key={g} className="card">
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{g}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
            {liste.map(p => p.type === 'image' ? (
              <ChampQR key={p.cle} p={p} valeur={vals[p.cle]} disabled={!peutModifier} onChange={(v) => setVals(x => ({ ...x, [p.cle]: v }))} />
            ) : p.type === 'bool' ? (
              <label key={p.cle} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: peutModifier ? 'pointer' : 'default' }}>
                <input type="checkbox" checked={vals[p.cle] === '1'} disabled={!peutModifier} onChange={e => setVals(v => ({ ...v, [p.cle]: e.target.checked ? '1' : '0' }))} />
                {p.label}
              </label>
            ) : (
              <div key={p.cle}><label className="label">{p.label}</label>
                <input className="input" type={p.type === 'number' ? 'number' : 'text'} value={vals[p.cle] ?? ''} disabled={!peutModifier} onChange={e => setVals(v => ({ ...v, [p.cle]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Bandeau {...etat} />
      {peutModifier && <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-sm" style={{ background: ROUGE, color: 'white', border: 'none' }} disabled={sauver.isPending} onClick={() => sauver.mutate()}><Save size={13} /> Enregistrer</button>
      </div>}
    </div>
  );
}

// ── Équipe & profils ───────────────────────────────────────────────────────
function EditeurProfil({ profil, permissions, onSaved }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState(new Set(profil.permissions));
  const [etat, retour] = useRetour();
  const groupes = permissions.reduce((a, p) => ((a[p.groupe] ||= []).push(p), a), {});
  const sauver = useMutation({
    mutationFn: () => yakroAPI.majProfil(profil.id, { permissions: [...sel] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['yakro-profils'] }); qc.invalidateQueries({ queryKey: ['yakro-moi'] }); retour.ok(); onSaved?.(); }, onError: retour.erreur,
  });
  const supprimer = useMutation({
    mutationFn: () => yakroAPI.supprimerProfil(profil.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yakro-profils'] }), onError: retour.erreur,
  });
  const bascule = (c) => setSel(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  return (
    <div style={{ padding: 12, background: '#FAFAF8', borderTop: '0.5px solid #e8e7e1' }}>
      {Object.entries(groupes).map(([g, liste]) => (
        <div key={g} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>{g}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))', gap: 4 }}>
            {liste.map(p => <label key={p.cle} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}><input type="checkbox" checked={sel.has(p.cle)} onChange={() => bascule(p.cle)} />{p.label}</label>)}
          </div>
        </div>
      ))}
      <Bandeau {...etat} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {!profil.systeme && <button className="btn btn-sm btn-ghost" style={{ color: '#A32D2D' }} onClick={() => window.confirm(`Supprimer le profil ${profil.nom} ?`) && supprimer.mutate()}><Trash2 size={13} /> Supprimer</button>}
        <button className="btn btn-sm" style={{ background: ROUGE, color: 'white', border: 'none' }} disabled={sauver.isPending} onClick={() => sauver.mutate()}><Save size={13} /> Enregistrer le profil</button>
      </div>
    </div>
  );
}

function OngletEquipe({ r }) {
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState(null);
  const [ajout, setAjout] = useState({ utilisateurId: '', profilId: '' });
  const [nouveau, setNouveau] = useState('');
  const [etat, retour] = useRetour();
  const { data: equipe = [] } = useQuery({ queryKey: ['yakro-equipe', r.id], queryFn: () => yakroAPI.equipe(r.id) });
  const { data: profils = [] } = useQuery({ queryKey: ['yakro-profils'], queryFn: yakroAPI.profils });
  const { data: users = [] } = useQuery({ queryKey: ['yakro-users-dispos'], queryFn: yakroAPI.utilisateursDispos });
  const { data: cat } = useQuery({ queryKey: ['yakro-catalogue'], queryFn: yakroAPI.catalogue, staleTime: Infinity });
  const rafraichir = () => qc.invalidateQueries({ queryKey: ['yakro-equipe', r.id] });

  const affecter = useMutation({ mutationFn: (d) => yakroAPI.majEquipe(r.id, d), onSuccess: () => { rafraichir(); setAjout({ utilisateurId: '', profilId: '' }); }, onError: retour.erreur });
  const retirer = useMutation({ mutationFn: (uid) => yakroAPI.retirerEquipe(r.id, uid), onSuccess: rafraichir, onError: retour.erreur });
  const creerProfil = useMutation({
    mutationFn: () => yakroAPI.creerProfil({ nom: nouveau, permissions: ['menu.voir'] }),
    onSuccess: () => { setNouveau(''); qc.invalidateQueries({ queryKey: ['yakro-profils'] }); }, onError: retour.erreur,
  });
  const dejaAffectes = new Set(equipe.map(e => e.utilisateur?.id));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 12, fontWeight: 700, fontSize: 13 }}>Équipe de {r.nom}</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-erp">
            <thead><tr><th>Utilisateur</th><th>Profil</th><th></th></tr></thead>
            <tbody>
              {equipe.length === 0 && <tr><td colSpan={3} style={{ color: '#999', fontSize: 12 }}>Aucune affectation : les utilisateurs Yakro ont le profil lié à leur rôle dans tous les restaurants.</td></tr>}
              {equipe.map(e => (
                <tr key={e.id}>
                  <td><div style={{ fontWeight: 500, fontSize: 13 }}>{e.utilisateur?.prenom} {e.utilisateur?.nom}</div><div style={{ fontSize: 11, color: '#999' }}>{e.utilisateur?.email}</div></td>
                  <td>
                    <select className="input" style={{ width: 'auto' }} value={e.profil.id} onChange={ev => affecter.mutate({ utilisateurId: e.utilisateur.id, profilId: ev.target.value })}>
                      {profils.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                    </select>
                  </td>
                  <td><button className="btn btn-xs btn-ghost" style={{ color: '#A32D2D' }} onClick={() => retirer.mutate(e.utilisateur.id)} aria-label="Retirer"><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '0.5px solid #e8e7e1' }}>
          <select className="input" style={{ flex: '1 1 180px' }} value={ajout.utilisateurId} onChange={e => setAjout(a => ({ ...a, utilisateurId: e.target.value }))}>
            <option value="">Ajouter un utilisateur…</option>
            {users.filter(u => !dejaAffectes.has(u.id)).map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.role})</option>)}
          </select>
          <select className="input" style={{ flex: '1 1 140px' }} value={ajout.profilId} onChange={e => setAjout(a => ({ ...a, profilId: e.target.value }))}>
            <option value="">Profil…</option>
            {profils.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          <button className="btn btn-sm" style={{ background: ROUGE, color: 'white', border: 'none' }} disabled={!ajout.utilisateurId || !ajout.profilId} onClick={() => affecter.mutate(ajout)}><UserPlus size={13} /> Affecter</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 12, fontWeight: 700, fontSize: 13 }}>Profils et permissions</div>
        {profils.map(p => (
          <div key={p.id}>
            <button onClick={() => setOuvert(ouvert === p.id ? null : p.id)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 12px', border: 'none', borderTop: '0.5px solid #e8e7e1', background: 'white', cursor: 'pointer', textAlign: 'left' }}>
              <span><b style={{ fontSize: 13 }}>{p.nom}</b> {p.systeme && <span className="badge badge-gray">par défaut</span>}<div style={{ fontSize: 11, color: '#888' }}>{p.description || `${p.permissions.length} permission(s)`}</div></span>
              <span style={{ fontSize: 11, color: '#888' }}>{ouvert === p.id ? 'Fermer' : 'Modifier'}</span>
            </button>
            {ouvert === p.id && cat && <EditeurProfil key={p.id + p.permissions.join()} profil={p} permissions={cat.permissions} />}
          </div>
        ))}
        <div style={{ padding: 12, display: 'flex', gap: 8, borderTop: '0.5px solid #e8e7e1' }}>
          <input className="input" placeholder="Nouveau profil (ex : Chef de salle)" value={nouveau} onChange={e => setNouveau(e.target.value)} />
          <button className="btn btn-sm btn-ghost" disabled={!nouveau.trim() || creerProfil.isPending} onClick={() => creerProfil.mutate()}><Plus size={13} /> Créer</button>
        </div>
      </div>
      <Bandeau {...etat} />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ParametrageRestaurantPage() {
  const { courant, restaurants, peut, isLoading } = useYakro();
  const [onglet, setOnglet] = useState('general');
  const [vue, setVue] = useState(null);
  const enListe = (vue ?? (peut('restaurants.gerer') ? 'liste' : 'detail')) === 'liste';

  const onglets = [
    { id: 'general', label: 'Général', visible: peut('parametres.gerer') },
    { id: 'prix', label: 'Prix', visible: peut('prix.gerer') || peut('menu.voir') },
    { id: 'parametres', label: 'Paramètres', visible: peut('parametres.gerer') },
    { id: 'equipe', label: 'Équipe & profils', visible: peut('equipe.gerer') },
    { id: 'tables', label: 'Plan de salle', visible: peut('parametres.gerer') },
  ].filter(o => o.visible);
  const actif = onglets.find(o => o.id === onglet) || onglets[0];

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13 }}>Chargement...</div>;
  if (enListe) return <RestaurantsPage onParametrer={() => { setOnglet('general'); setVue('detail'); }} />;
  if (!courant) return <div className="card" style={{ fontSize: 13 }}>Aucun restaurant accessible.</div>;
  if (!actif) return <div className="card" style={{ fontSize: 13 }}>Vous n'avez pas accès au paramétrage de ce restaurant.</div>;

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 14 }}>
        {peut('restaurants.gerer') && <button className="btn btn-sm btn-ghost" style={{ marginBottom: 8 }} onClick={() => setVue('liste')}>← Mes restaurants</button>}
        <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Paramétrage — {courant.nom}</h1>
        <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>Votre profil ici : {courant.profil}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        {onglets.map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', background: actif.id === o.id ? ROUGE : '#F1EFE8', color: actif.id === o.id ? 'white' : '#666', fontWeight: actif.id === o.id ? 600 : 400 }}>{o.label}</button>
        ))}
      </div>
      {actif.id === 'general' && <OngletGeneral r={courant} />}
      {actif.id === 'prix' && <OngletPrix r={courant} restos={restaurants} peutModifier={peut('prix.gerer')} />}
      {actif.id === 'parametres' && <OngletParametres r={courant} peutModifier={peut('parametres.gerer')} />}
      {actif.id === 'equipe' && <OngletEquipe r={courant} />}
      {actif.id === 'tables' && <TablesPage />}
    </div>
  );
}


/** Téléversement d'un QR code : réduit côté navigateur (600 px max, PNG net) avant envoi. */
function ChampQR({ p, valeur, disabled, onChange }) {
  const [erreur, setErreur] = useState('');
  const choisir = (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErreur('Choisissez une image (PNG ou JPEG)');
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      setErreur(''); onChange(c.toDataURL('image/png'));
    };
    img.onerror = () => setErreur('Image illisible');
    img.src = URL.createObjectURL(f);
  };
  return (
    <div>
      <div className="label">{p.label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 88, height: 88, borderRadius: 10, background: '#F7F7F5', border: '1px dashed #d3d1c7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {valeur ? <img src={valeur} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 11, color: '#999' }}>Aucun</span>}
        </div>
        {!disabled && (
          <div style={{ display: 'grid', gap: 6 }}>
            <label className="btn btn-sm btn-ghost" style={{ cursor: 'pointer' }}>
              {valeur ? 'Remplacer' : 'Téléverser'}
              <input type="file" accept="image/*" onChange={choisir} style={{ display: 'none' }} />
            </label>
            {valeur && <button type="button" className="btn btn-sm btn-ghost" style={{ color: '#A32D2D' }} onClick={() => onChange('')}>Retirer</button>}
          </div>
        )}
      </div>
      {erreur && <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 4 }}>{erreur}</div>}
    </div>
  );
}
