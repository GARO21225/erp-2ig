import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Clock, Users, QrCode, History, Plus, X, AlertTriangle } from 'lucide-react';
import { yakroAPI } from '../../lib/api';
import { useYakro } from '../../lib/useYakro';
import { duree } from './PointerPage';
import ScanneurQR from './ScanneurQR';
import { useNavigate } from 'react-router-dom';

const heure = (d) => new Date(d).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });
const jour = (d) => new Date(d).toLocaleDateString('fr', { weekday: 'short', day: 'numeric', month: 'short' });
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const ROUGE = '#8B1A1A';
// datetime-local attend l'heure locale (Côte d'Ivoire = UTC)
const versLocal = (d = new Date()) => new Date(d).toISOString().slice(0, 16);

function Ligne({ s, onCorriger, peutCorriger }) {
  return (
    <tr style={{ background: s.oubli ? '#FBF1DD' : undefined }}>
      <td><b>{s.nom}</b>{s.modeEntree === 'MANUEL' && <span title={s.note || 'Saisie manuelle'} style={{ marginLeft: 6, fontSize: 10, background: '#E8F0F8', color: '#2F5D8A', borderRadius: 8, padding: '1px 6px' }}>manuel</span>}</td>
      <td>{jour(s.entreeLe)}</td>
      <td>{heure(s.entreeLe)}</td>
      <td>{s.sortieLe ? heure(s.sortieLe) : s.oubli ? <span style={{ color: '#B97A18', fontWeight: 600 }}>⚠ non pointée</span> : <span style={{ color: '#3C7A37', fontWeight: 600 }}>● en service</span>}</td>
      <td style={{ textAlign: 'right' }}>{s.oubli ? '—' : duree(s.dureeMin)}</td>
      <td style={{ textAlign: 'right' }}>{s.activite.commandes} · {s.activite.ca.toLocaleString('fr')} F</td>
      {peutCorriger && <td>{!s.sortieLe && <button className="btn btn-sm btn-ghost" onClick={() => onCorriger(s)}>Clôturer</button>}</td>}
    </tr>
  );
}

function Tableau({ sessions, peutCorriger, onCorriger }) {
  if (!sessions.length) return <div style={{ padding: 30, textAlign: 'center', color: '#8F8379', fontSize: 13 }}>Aucun pointage</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table-erp">
        <thead><tr><th>Agent</th><th>Jour</th><th>Arrivée</th><th>Départ</th><th style={{ textAlign: 'right' }}>Présence</th><th style={{ textAlign: 'right' }}>Commandes · CA</th>{peutCorriger && <th />}</tr></thead>
        <tbody>{sessions.map(s => <Ligne key={s.id} s={s} peutCorriger={peutCorriger} onCorriger={onCorriger} />)}</tbody>
      </table>
    </div>
  );
}

/** QR code qui change toutes les minutes : à afficher sur la tablette / l'écran du restaurant. */
function Borne() {
  const [img, setImg] = useState('');
  const { data, refetch } = useQuery({ queryKey: ['pointage-borne'], queryFn: yakroAPI.pointageBorne, refetchInterval: 20000, refetchOnWindowFocus: true, gcTime: 0 });
  const [reste, setReste] = useState(0);
  useEffect(() => {
    if (!data) return;
    QRCode.toDataURL(`${window.location.origin}/yakro/pointer?r=${data.restaurantId}&t=${data.jeton}`, { width: 420, margin: 1, color: { dark: '#201915', light: '#ffffff' } }).then(setImg);
    setReste(data.expireDans);
  }, [data?.jeton]);
  useEffect(() => { const t = setInterval(() => setReste(r => { if (r <= 1) { refetch(); return 0; } return r - 1; }), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="card" style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18 }}>{data?.restaurant}</div>
      <div style={{ color: '#6B5F57', fontSize: 13, margin: '4px 0 14px' }}>Les agents scannent ce QR code avec leur téléphone, à l'arrivée puis au départ.</div>
      {img ? <img src={img} alt="QR code de pointage" style={{ width: '100%', maxWidth: 360, aspectRatio: '1', borderRadius: 12 }} /> : <div style={{ padding: 60, color: '#8F8379' }}>Chargement…</div>}
      <div style={{ fontSize: 12, color: '#8F8379', marginTop: 10 }}>Se renouvelle automatiquement · prochain changement dans {reste} s</div>
      <div style={{ fontSize: 12, color: '#6B5F57', marginTop: 8 }}>Laissez cet écran ouvert au restaurant : un QR photographié ne fonctionne plus après quelques minutes.</div>
    </div>
  );
}

function ModalManuel({ restaurantId, cible, onClose, onDone }) {
  const [form, setForm] = useState({ utilisateurId: '', entreeLe: versLocal(new Date(Date.now() - 8 * 3600000)), sortieLe: versLocal(), note: '' });
  const [erreur, setErreur] = useState('');
  const { data: equipe = [] } = useQuery({ queryKey: ['yakro-equipe-pointage', restaurantId], queryFn: () => yakroAPI.equipe(restaurantId), enabled: !cible && !!restaurantId });
  const m = useMutation({
    mutationFn: () => cible ? yakroAPI.pointageSortie(cible.id, { sortieLe: new Date(form.sortieLe).toISOString(), note: form.note })
      : yakroAPI.pointageManuel({ ...form, entreeLe: new Date(form.entreeLe).toISOString(), sortieLe: form.sortieLe ? new Date(form.sortieLe).toISOString() : null }),
    onSuccess: onDone, onError: e => setErreur(e?.error || e?.response?.data?.error || e.message),
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne' }}>{cible ? `Clôturer — ${cible.nom}` : 'Pointage manuel'}</h3>
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {!cible && <div><label className="label">Agent</label>
            <select className="input" value={form.utilisateurId} onChange={set('utilisateurId')}>
              <option value="">— choisir —</option>{equipe.map(a => <option key={a.utilisateur.id} value={a.utilisateur.id}>{a.utilisateur.prenom} {a.utilisateur.nom}</option>)}
            </select></div>}
          {!cible && <div><label className="label">Arrivée</label><input className="input" type="datetime-local" value={form.entreeLe} onChange={set('entreeLe')} /></div>}
          <div><label className="label">Départ{cible ? '' : ' (vide = encore en service)'}</label><input className="input" type="datetime-local" value={form.sortieLe} onChange={set('sortieLe')} /></div>
          <div><label className="label">Motif</label><input className="input" placeholder="Téléphone oublié, sortie non pointée…" value={form.note} onChange={set('note')} /></div>
        </div>
        {erreur && <div role="alert" style={{ marginTop: 10, padding: '8px 12px', background: '#FCEBEB', color: '#A32D2D', borderRadius: 8, fontSize: 12 }}>{erreur}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: ROUGE, color: 'white', border: 'none' }} disabled={m.isPending || (!cible && !form.utilisateurId)} onClick={() => m.mutate()}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

export default function PointagePage() {
  const qc = useQueryClient();
  const { courant, peut } = useYakro();
  const voir = peut('pointage.voir'), gerer = peut('pointage.gerer');
  const [onglet, setOnglet] = useState(voir ? 'presences' : 'moi');
  const [du, setDu] = useState(new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const [au, setAu] = useState(aujourdhui());
  const [modal, setModal] = useState(null); // { cible? }
  const rafraichir = () => { qc.invalidateQueries({ queryKey: ['pointage'] }); setModal(null); };

  const navigate = useNavigate();
  const [scan, setScan] = useState(false);
  const moi = useQuery({ queryKey: ['pointage', 'moi'], queryFn: yakroAPI.pointageMoi, enabled: onglet === 'moi', refetchInterval: 30000 });
  const pres = useQuery({ queryKey: ['pointage', 'presences', courant?.id], queryFn: yakroAPI.pointagePresences, enabled: voir && onglet === 'presences', refetchInterval: 30000 });
  const hist = useQuery({ queryKey: ['pointage', 'hist', courant?.id, du, au], queryFn: () => yakroAPI.pointageHistorique({ du, au }), enabled: voir && onglet === 'historique' });

  const onglets = [['moi', 'Mon pointage', Clock], ...(voir ? [['presences', 'En service', Users], ['historique', 'Historique', History]] : []), ...(gerer ? [['borne', 'QR du restaurant', QrCode]] : [])];

  return (
    <div className="page-enter">
      <div className="yk-head">
        <div><h1 className="yk-title">Pointage du personnel</h1><div className="yk-sub">{courant?.nom} · arrivée et départ par QR code</div></div>
        {gerer && <button className="btn btn-sm" style={{ background: ROUGE, color: 'white', border: 'none' }} onClick={() => setModal({})}><Plus size={13} /> Pointage manuel</button>}
      </div>

      <div className="yk-chips" role="tablist" style={{ marginBottom: 14 }}>
        {onglets.map(([k, l, Icon]) => <button key={k} role="tab" className="yk-chip" aria-pressed={onglet === k} onClick={() => setOnglet(k)}><Icon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{l}</button>)}
      </div>

      {onglet === 'moi' && (
        <div className="card">
          {moi.data?.enService ? (
            <div style={{ background: '#EDF5E7', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <b style={{ color: '#3C7A37' }}>● Vous êtes en service</b> depuis {heure(moi.data.enService.entreeLe)} ({duree(moi.data.enService.dureeMin)}). Scannez le QR du restaurant pour pointer votre départ.
            </div>
          ) : <div style={{ background: '#FAF6F0', borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 13 }}>Vous n'êtes pas en service. Scannez le QR code affiché au restaurant pour pointer votre arrivée.</div>}
          <button onClick={() => setScan(true)} style={{ width: '100%', minHeight: 56, marginBottom: 14, border: 0, borderRadius: 14, background: ROUGE, color: 'white', fontFamily: 'Syne', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            <QrCode size={18} style={{ verticalAlign: -3, marginRight: 8 }} />{moi.data?.enService ? 'Scanner pour pointer ma sortie' : 'Scanner pour pointer mon arrivée'}
          </button>
          {scan && <ScanneurQR onClose={() => setScan(false)} onCode={(t) => { setScan(false); try { const u = new URL(t); if (u.pathname === '/yakro/pointer') return navigate('/yakro/pointer' + u.search); } catch { /* pas un lien */ } alert('Ce QR code n’est pas celui du pointage Yakro Grill.'); }} />}
          <Tableau sessions={moi.data?.historique || []} />
        </div>
      )}

      {onglet === 'presences' && (
        <>
          <div className="yk-stats" style={{ marginBottom: 12 }}>
            <div className="yk-stat" style={{ '--c': 'var(--yk-leaf)' }}><b>{pres.data?.enService.length ?? 0}</b><span>en service</span></div>
            <div className="yk-stat"><b>{pres.data?.aujourdhui.length ?? 0}</b><span>terminé(s) aujourd'hui</span></div>
            {!!pres.data?.oublis.length && <div className="yk-stat" style={{ '--c': 'var(--yk-gold)' }}><b>{pres.data.oublis.length}</b><span>sortie(s) non pointée(s)</span></div>}
          </div>
          {!!pres.data?.oublis.length && <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid #B97A18' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> Sorties non pointées — à corriger</div>
            <Tableau sessions={pres.data.oublis} peutCorriger={gerer} onCorriger={(s) => setModal({ cible: s })} />
          </div>}
          <div className="card"><div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>En service maintenant</div>
            <Tableau sessions={pres.data?.enService || []} peutCorriger={gerer} onCorriger={(s) => setModal({ cible: s })} /></div>
          <div className="card" style={{ marginTop: 12 }}><div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Terminés aujourd'hui</div>
            <Tableau sessions={pres.data?.aujourdhui || []} /></div>
        </>
      )}

      {onglet === 'historique' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }}>
            <div><label className="label">Du</label><input className="input" type="date" value={du} onChange={e => setDu(e.target.value)} /></div>
            <div><label className="label">Au</label><input className="input" type="date" value={au} onChange={e => setAu(e.target.value)} /></div>
          </div>
          {!!hist.data?.resume.length && <div className="card" style={{ marginBottom: 12, overflowX: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Synthèse par agent</div>
            <table className="table-erp"><thead><tr><th>Agent</th><th style={{ textAlign: 'right' }}>Jours</th><th style={{ textAlign: 'right' }}>Heures</th><th style={{ textAlign: 'right' }}>Commandes</th><th style={{ textAlign: 'right' }}>CA</th><th style={{ textAlign: 'right' }}>Oublis</th></tr></thead>
              <tbody>{hist.data.resume.map(a => <tr key={a.utilisateurId}><td><b>{a.nom}</b></td><td style={{ textAlign: 'right' }}>{a.jours}</td><td style={{ textAlign: 'right' }}>{duree(a.minutes)}</td><td style={{ textAlign: 'right' }}>{a.commandes}</td><td style={{ textAlign: 'right' }}>{a.ca.toLocaleString('fr')} F</td><td style={{ textAlign: 'right' }}>{a.oublis || '—'}</td></tr>)}</tbody></table>
          </div>}
          <div className="card"><Tableau sessions={hist.data?.sessions || []} peutCorriger={gerer} onCorriger={(s) => setModal({ cible: s })} /></div>
        </>
      )}

      {onglet === 'borne' && <Borne />}
      {modal && <ModalManuel restaurantId={courant?.id} cible={modal.cible} onClose={() => setModal(null)} onDone={rafraichir} />}
    </div>
  );
}
