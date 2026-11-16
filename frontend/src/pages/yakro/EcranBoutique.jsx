import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Settings, ArrowLeft, Maximize } from 'lucide-react';
import { yakroAPI } from '../../lib/api';

const ROUGE = '#8B1A1A';
const CLE = 'yakro_ecran';
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch { return {}; } };
const STATUT = { EN_ATTENTE: ['En attente', '#BA7517'], EN_CUISINE: ['En préparation', '#BA7517'], PRET: ['Prêt', '#2E8B3D'], SERVI: ['Servi', '#777'] };
const minutes = (d, now) => Math.max(0, Math.floor((now - new Date(d)) / 60000));

/** Lien YouTube → lecteur intégré (muet, en boucle) ; sinon fichier vidéo direct */
function Video({ url }) {
  if (!url) return <div style={{ color: '#888', fontSize: 14, textAlign: 'center', padding: 20 }}>Aucune vidéo : ajoutez un lien avec le bouton ⚙ en haut à droite</div>;
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  const style = { width: '100%', height: '100%', border: 0, borderRadius: 12, background: '#000', objectFit: 'cover' };
  return yt
    ? <iframe title="Vidéo" style={style} allow="autoplay; encrypted-media" src={`https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0`} />
    : <video style={style} src={url} autoPlay muted loop playsInline />;
}

function Zone({ titre, station, commandes, now }) {
  const liste = commandes.map(c => ({ ...c, l: c.lignes.filter(x => x.station === station && x.statut !== 'SERVI') })).filter(c => c.l.length);
  return (
    <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#1c1c1c', borderRadius: 14, padding: 12 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', justifyContent: 'space-between' }}>{titre}<span style={{ color: '#F5B041' }}>{liste.length}</span></h2>
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10, alignContent: 'start' }}>
        {liste.length === 0 && <div style={{ color: '#777', fontSize: 14 }}>Aucune commande en cours</div>}
        {liste.map(c => {
          const pret = c.l.every(x => x.statut === 'PRET'), m = minutes(c.createdAt, now);
          return (
            <div key={c.id} style={{ background: '#fff', borderRadius: 10, padding: 10, borderLeft: `6px solid ${pret ? '#2E8B3D' : m >= 20 ? '#A32D2D' : '#BA7517'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <b style={{ fontSize: 18, color: ROUGE }}>{c.table}</b><span style={{ fontSize: 12, color: m >= 20 ? '#A32D2D' : '#666', fontWeight: 700 }}>{m} min</span>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{c.serveurNom}</div>
              {c.l.map(x => (
                <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 14, padding: '2px 0' }}>
                  <span><b>{x.quantite}×</b> {x.nom}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: (STATUT[x.statut] || STATUT.EN_ATTENTE)[1], whiteSpace: 'nowrap' }}>{(STATUT[x.statut] || STATUT.EN_ATTENTE)[0]}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Écran boutique (TV) : suivi des commandes en temps réel, rafraîchi toutes les 5 secondes. */
export default function EcranBoutique() {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [cfg, setCfg] = useState(lire);
  const [reglages, setReglages] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const { data, isError } = useQuery({ queryKey: ['ecran-yakro'], queryFn: yakroAPI.ecran, refetchInterval: 5000, refetchIntervalInBackground: true });
  const sauver = (c) => { setCfg(c); try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* ignore */ } };
  const d = new Date(now), k = data?.kpi || {}, agents = data?.agents || [], commandes = data?.commandes || [];
  const kpis = [['Commandes du jour', k.commandesJour], ['En cours', k.enCours], ['Articles à préparer', k.aPreparer], ['Articles prêts', k.prets], ['Payées', k.payees],
    ...(cfg.ca && k.caJour != null ? [['Ventes du jour', `${Math.round(k.caJour).toLocaleString('fr')} F`]] : [])];
  const bouton = { background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 6, display: 'flex' };

  return (
    <div className="yk-ecran" style={{ position: 'fixed', inset: 0, background: '#0f0f0f', color: '#fff', display: 'flex', gap: 12, padding: 12, fontFamily: 'inherit' }}>
      <style>{'@keyframes yk-defile{from{transform:translateX(100%)}to{transform:translateX(-100%)}} @media (max-width:900px){.yk-ecran{flex-direction:column-reverse!important;overflow:auto}.yk-ecran>div{flex:none!important}.yk-ecran section{min-height:220px}}'}</style>
      {/* Gauche : commandes par table — bar en haut, restaurant en bas */}
      <div style={{ flex: 3, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Zone titre="🍹 Bar" station="BAR" commandes={commandes} now={now} />
        <Zone titre="🍽 Restaurant" station="CUISINE" commandes={commandes} now={now} />
      </div>
      {/* Droite : date-heure | restaurant, indicateurs, vidéo */}
      <div className="yk-ecran-d" style={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: ROUGE, borderRadius: 14, padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{d.toLocaleTimeString('fr')}</div>
              <div style={{ fontSize: 12, opacity: .85 }}>{d.toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <div style={{ borderLeft: '1px solid #ffffff55', paddingLeft: 10, fontSize: 18, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data?.restaurant || 'Yakro Grill'}</div>
            <button style={{ ...bouton, color: '#fff' }} aria-label="Plein écran" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize size={16} /></button>
            <button style={{ ...bouton, color: '#fff' }} aria-label="Réglages" onClick={() => setReglages(!reglages)}><Settings size={16} /></button>
            <button style={{ ...bouton, color: '#fff' }} aria-label="Quitter l'écran" onClick={() => navigate('/yakro/dashboard')}><ArrowLeft size={16} /></button>
          </div>
          <div style={{ overflow: 'hidden', marginTop: 8, borderTop: '1px solid #ffffff33', paddingTop: 6 }}>
            <div style={{ whiteSpace: 'nowrap', fontSize: 14, animation: 'yk-defile 25s linear infinite' }}>
              {agents.length} agent(s) en service{agents.length ? ` : ${agents.join(' · ')}` : ''}{cfg.message ? ` — ${cfg.message}` : ''}
            </div>
          </div>
        </div>
        {reglages && (
          <div style={{ background: '#1c1c1c', borderRadius: 14, padding: 12, display: 'grid', gap: 8, fontSize: 13 }}>
            <label>Lien de la vidéo (YouTube ou fichier .mp4)<input className="input" value={cfg.video || ''} onChange={e => sauver({ ...cfg, video: e.target.value.trim() })} placeholder="https://…" /></label>
            <label>Message défilant (facultatif)<input className="input" value={cfg.message || ''} onChange={e => sauver({ ...cfg, message: e.target.value })} /></label>
            {k.caJour != null && <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!cfg.ca} onChange={e => sauver({ ...cfg, ca: e.target.checked })} />Afficher les ventes du jour</label>}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {kpis.map(([l, v]) => (
            <div key={l} style={{ background: '#1c1c1c', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#F5B041', fontVariantNumeric: 'tabular-nums' }}>{v ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#bbb' }}>{l}</div>
            </div>
          ))}
        </div>
        {isError && <div style={{ color: '#ff8a80', fontSize: 13 }}>Connexion perdue : nouvel essai dans 5 secondes…</div>}
        <div style={{ flex: 1, minHeight: 0, background: '#1c1c1c', borderRadius: 14, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Video url={cfg.video} /></div>
      </div>
    </div>
  );
}
