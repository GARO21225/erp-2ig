import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Settings, ArrowLeft, Maximize } from 'lucide-react';
import { yakroAPI, API_URL } from '../../lib/api';

const ROUGE = '#8B1A1A';
const CLE = 'yakro_ecran';
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch { return {}; } };
const STATUT = { EN_ATTENTE: ['En attente', '#BA7517'], EN_CUISINE: ['En préparation', '#BA7517'], PRET: ['Prêt', '#2E8B3D'], SERVI: ['Servi', '#777'] };
const minutes = (d, now) => Math.max(0, Math.floor((now - new Date(d)) / 60000));

/** Liens YouTube → { liste } (playlist list=PL…) ou { ids } (vidéos lues à la suite). Les « mix » (RD…) ne sont pas intégrables. */
function lireYoutube(texte) {
  const lignes = String(texte || '').split(/\s+/).filter(Boolean);
  const liste = lignes.map(l => l.match(/[?&]list=((?:PL|OL|UU|FL)[\w-]+)/)?.[1]).find(Boolean);
  const ids = [...new Set(lignes.map(l => l.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/)?.[1]).filter(Boolean))];
  return { liste, ids };
}
let apiYT;
const chargerYT = () => apiYT || (apiYT = new Promise((ok) => {
  if (window.YT?.Player) return ok(window.YT);
  const avant = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { avant?.(); ok(window.YT); };
  const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(sc);
}));

/** Lecteur YouTube piloté : enchaîne les vidéos en boucle, saute celles que YouTube refuse, prévient si aucune n'est lisible. */
function LecteurYoutube({ texte, son, onBloque }) {
  const ref = useRef(null);
  useEffect(() => {
    const { liste, ids } = lireYoutube(texte);
    if (!liste && !ids.length) { onBloque('Lien YouTube non reconnu'); return undefined; }
    let player, mort = false, refus = 0;
    chargerYT().then((YT) => {
      if (mort || !ref.current) return;
      const cible = document.createElement('div'); ref.current.replaceChildren(cible);
      player = new YT.Player(cible, {
        width: '100%', height: '100%', videoId: liste ? undefined : ids[0],
        playerVars: { autoplay: 1, mute: son ? 0 : 1, rel: 0, loop: 1, playsinline: 1, ...(liste ? { listType: 'playlist', list: liste } : { playlist: (ids.length > 1 ? ids.slice(1) : ids).join(',') }) },
        events: {
          onReady: (e) => { if (!son) e.target.mute(); e.target.playVideo(); },
          onStateChange: (e) => { if (e.data === YT.PlayerState.PLAYING) refus = 0; },
          // 100 = introuvable, 101/150 = le propriétaire interdit la lecture hors de YouTube
          onError: () => { refus += 1; const n = liste ? 50 : ids.length; if (refus >= n) onBloque("YouTube refuse la lecture de cette vidéo hors de son site (choix du propriétaire, fréquent pour la musique)"); else e_next(); },
        },
      });
      const e_next = () => { try { player.nextVideo(); } catch { /* ignore */ } };
    });
    return () => { mort = true; try { player?.destroy(); } catch { /* ignore */ } };
  }, [texte, son]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', background: '#000' }} />;
}

/** Vidéos de l'écran : fichiers envoyés (lus à la suite, en boucle) ou YouTube (un lien, plusieurs liens ou une playlist) */
function Video({ cfg, videos }) {
  const [i, setI] = useState(0);
  const [bloque, setBloque] = useState(null); // YouTube illisible → on passe aux vidéos envoyées
  const style = { width: '100%', height: '100%', border: 0, borderRadius: 12, background: '#000', objectFit: 'contain' };
  const vide = (t) => <div style={{ color: '#888', fontSize: 14, textAlign: 'center', padding: 20 }}>{t}</div>;
  if ((cfg.source || (cfg.video ? 'YOUTUBE' : 'FICHIERS')) === 'YOUTUBE') {
    if (!bloque || bloque.pour !== cfg.video) return <LecteurYoutube texte={cfg.video} son={cfg.son} onBloque={(m) => setBloque({ pour: cfg.video, m })} />;
    if (!videos.length) return vide(`${bloque.m}. Mettez un autre lien, ou envoyez la vidéo dans « Mes vidéos » (bouton ⚙).`);
  }
  if (!videos.length) return vide('Aucune vidéo : ajoutez-en avec le bouton ⚙ en haut à droite');
  const v = videos[i % videos.length];
  const suivante = () => setI(n => (n + 1) % videos.length);
  return <video key={v.fichier} style={style} src={API_URL + v.url} autoPlay muted={!cfg.son} playsInline loop={videos.length === 1} onEnded={suivante} onError={suivante} />;
}

function Zone({ titre, station, commandes, now }) {
  const liste = commandes.map(c => ({ ...c, l: c.lignes.filter(x => x.station === station && x.statut !== 'SERVI') })).filter(c => c.l.length);
  return (
    <section style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#1c1c1c', borderRadius: 14, padding: 12 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', justifyContent: 'space-between' }}>{titre}<span style={{ color: '#F5B041' }}>{liste.length}</span></h2>
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, alignContent: 'start' }}>
        {liste.length === 0 && <div style={{ color: '#777', fontSize: 14 }}>Aucune commande en cours</div>}
        {liste.map(c => {
          const pret = c.l.every(x => x.statut === 'PRET'), m = minutes(c.createdAt, now);
          return (
            <div key={c.id} style={{ background: '#fff', borderRadius: 10, padding: 10, borderLeft: `6px solid ${pret ? '#2E8B3D' : m >= 20 ? '#A32D2D' : '#BA7517'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <b style={{ fontFamily: 'Syne', fontSize: 22, color: '#1a1a1a' }}>{c.table}</b><span style={{ fontSize: 12, color: m >= 20 ? '#A32D2D' : '#666', fontWeight: 700 }}>{m} min</span>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{c.serveurNom}</div>
              {c.l.map(x => (
                <div key={x.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0', color: '#1a1a1a' }}>
                  <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 22, minWidth: 36, color: ROUGE }}>{x.quantite}×</span>
                  <span style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>{x.nom}{x.notes && <span style={{ display: 'block', fontSize: 13, fontWeight: 400, color: '#BA7517', fontStyle: 'italic' }}>⚠ {x.notes}</span>}</span>
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
  const qc = useQueryClient();
  const { data: videos = [] } = useQuery({ queryKey: ['ecran-videos'], queryFn: () => yakroAPI.videosEcran().then(r => (Array.isArray(r) ? r : [])), refetchInterval: 60000 });
  const [envoi, setEnvoi] = useState(null); // { pct } | { erreur }
  const majVideos = (l) => qc.setQueryData(['ecran-videos'], Array.isArray(l) ? l : []);
  const envoyer = async (fichiers) => {
    for (const f of fichiers) {
      try { setEnvoi({ pct: 0, nom: f.name }); majVideos(await yakroAPI.envoyerVideoEcran(f, (pct) => setEnvoi({ pct, nom: f.name }))); setEnvoi(null); }
      catch (e) { setEnvoi({ erreur: e?.response?.data?.error || e?.error || "Envoi impossible : vérifiez la connexion et la taille de la vidéo" }); return; }
    }
  };
  const supprimer = (f) => yakroAPI.supprimerVideoEcran(f).then(majVideos).catch(() => {});
  const source = cfg.source || (cfg.video ? 'YOUTUBE' : 'FICHIERS');
  const sauver = (c) => { setCfg(c); try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* ignore */ } };
  const d = new Date(now), k = data?.kpi || {}, agents = data?.agents || [], commandes = data?.commandes || [];
  const kpis = [['Commandes du jour', k.commandesJour], ['En cours', k.enCours], ['Articles à préparer', k.aPreparer], ['Articles prêts', k.prets], ['Payées', k.payees],
    ...(cfg.ca && k.caJour != null ? [['Ventes du jour', `${Math.round(k.caJour).toLocaleString('fr')} F`]] : [])];
  const bouton = { background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 6, display: 'flex' };

  return (
    <div className="yk-ecran" style={{ position: 'fixed', inset: 0, background: '#0f0f0f', color: '#fff', display: 'flex', gap: 12, padding: 12, fontFamily: 'inherit' }}>
      <style>{'@keyframes yk-defile{from{transform:translateX(0)}to{transform:translateX(-100%)}} @media (max-width:900px){.yk-ecran{flex-direction:column-reverse!important;overflow:auto}.yk-ecran>div{flex:none!important}.yk-ecran section{min-height:220px}}'}</style>
      {/* Gauche : commandes par table — bar en haut, restaurant en bas */}
      <div style={{ flex: 3, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Zone titre="🍹 Bar" station="BAR" commandes={commandes} now={now} />
        <Zone titre="🍽 Restaurant" station="CUISINE" commandes={commandes} now={now} />
      </div>
      {/* Droite : date-heure | restaurant, indicateurs, vidéo */}
      <div className="yk-ecran-d" style={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: ROUGE, borderRadius: 14, padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logos/yakro.svg" alt="Yakro Grill" style={{ height: 52, width: 52, objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 3, flexShrink: 0 }} />
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{d.toLocaleTimeString('fr')}</div>
              <div style={{ fontSize: 12, opacity: .85 }}>{d.toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <div style={{ borderLeft: '1px solid #ffffff55', paddingLeft: 10, fontSize: 18, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data?.restaurant || 'Yakro Grill'}</div>
            <button style={{ ...bouton, color: '#fff' }} aria-label="Plein écran" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize size={16} /></button>
            <button style={{ ...bouton, color: '#fff' }} aria-label="Réglages" onClick={() => setReglages(!reglages)}><Settings size={16} /></button>
            <button style={{ ...bouton, color: '#fff' }} aria-label="Quitter l'écran" onClick={() => navigate('/yakro/cuisine')}><ArrowLeft size={16} /></button>
          </div>
          <div style={{ overflow: 'hidden', marginTop: 8, borderTop: '1px solid #ffffff33', paddingTop: 6 }}>
            <div style={{ display: 'inline-block', whiteSpace: 'nowrap', paddingLeft: '100%', fontSize: 14, animation: 'yk-defile 25s linear infinite' }}>
              {agents.length} agent(s) en service{agents.length ? ` : ${agents.join(' · ')}` : ''}{cfg.message ? ` — ${cfg.message}` : ''}
            </div>
          </div>
        </div>
        {reglages && (
          <div style={{ background: '#1c1c1c', borderRadius: 14, padding: 12, display: 'grid', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['FICHIERS', 'Mes vidéos'], ['YOUTUBE', 'YouTube']].map(([k, l]) => <button key={k} className={`btn btn-sm ${source === k ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={source === k} onClick={() => sauver({ ...cfg, source: k })}>{l}</button>)}
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}><input type="checkbox" checked={!!cfg.son} onChange={e => sauver({ ...cfg, son: e.target.checked })} />Avec le son</label>
            </div>
            {source === 'YOUTUBE' ? (
              <label>Liens YouTube : un par ligne (lus à la suite) ou le lien d'une playlist
                <textarea className="input" rows={3} value={cfg.video || ''} onChange={e => sauver({ ...cfg, video: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" /></label>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {videos.map(v => (
                  <div key={v.fichier} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nom}</span>
                    <span style={{ color: '#888' }}>{Math.round(v.taille / 1048576)} Mo</span>
                    <button className="btn btn-sm btn-ghost" onClick={() => supprimer(v.fichier)}>Supprimer</button>
                  </div>
                ))}
                {videos.length === 0 && <span style={{ color: '#888' }}>Aucune vidéo envoyée</span>}
                <label className="btn btn-sm btn-primary" style={{ justifySelf: 'start', cursor: 'pointer' }}>+ Ajouter des vidéos
                  <input type="file" accept="video/mp4,video/webm,video/quicktime" multiple hidden disabled={envoi?.pct != null} onChange={e => { envoyer([...e.target.files]); e.target.value = ''; }} /></label>
                {envoi?.pct != null && <span>Envoi de {envoi.nom} : {envoi.pct} %</span>}
                {envoi?.erreur && <span style={{ color: '#ff8a80' }}>{envoi.erreur}</span>}
                <span style={{ color: '#888', fontSize: 11 }}>MP4, WebM ou MOV · 300 Mo maximum par vidéo · lues à la suite, en boucle</span>
              </div>
            )}
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
        <div style={{ flex: 1, minHeight: 0, background: '#1c1c1c', borderRadius: 14, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Video cfg={cfg} videos={videos} /></div>
      </div>
    </div>
  );
}
