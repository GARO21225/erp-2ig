import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { yakroAPI } from './api';

const CLE_SON = 'notif_son';
const cleVus = (uid) => `notif_vus_${uid}`;
let ctx;

/** Bip à deux tons (WebAudio : aucun fichier). Le navigateur exige une première interaction pour autoriser le son. */
function bip() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    [[880, 0], [1175, 0.18], [880, 0.4]].forEach(([f, t]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const d = ctx.currentTime + t;
      g.gain.setValueAtTime(0.0001, d); g.gain.exponentialRampToValueAtTime(0.35, d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, d + 0.16);
      o.start(d); o.stop(d + 0.18);
    });
  } catch { /* son indisponible */ }
}
const vibrer = () => { try { navigator.vibrate?.([250, 120, 250, 120, 450]); } catch { /* non supporté */ } };

export const sonActif = () => { try { return localStorage.getItem(CLE_SON) !== '0'; } catch { return true; } };
export function reglerSon(on) {
  try { localStorage.setItem(CLE_SON, on ? '1' : '0'); } catch { /* ignore */ }
  if (on) { bip(); vibrer(); try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* ignore */ } }
}

/** Notifications personnelles Yakro : sonne, vibre et notifie pour chaque nouvel élément assigné à l'utilisateur. */
export function useNotifs({ actif, userId, restaurantId }) {
  const [son, setSon] = useState(sonActif);
  const deja = useRef(null); // ids déjà connus (null = première lecture : pas de sonnerie)
  const { data } = useQuery({
    queryKey: ['notifs-yakro', userId, restaurantId],
    queryFn: yakroAPI.notifications,
    enabled: !!actif && !!userId,
    refetchInterval: 20000, refetchIntervalInBackground: true, staleTime: 10000,
  });
  const items = data?.items || [];

  // Débloque l'audio dès la première interaction
  useEffect(() => {
    const debloquer = () => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.(); } catch { /* ignore */ } };
    window.addEventListener('pointerdown', debloquer, { once: true });
    return () => window.removeEventListener('pointerdown', debloquer);
  }, []);

  useEffect(() => {
    if (!data) return;
    const ids = items.map(i => i.id);
    if (deja.current === null) {
      let vus = []; try { vus = JSON.parse(localStorage.getItem(cleVus(userId)) || '[]'); } catch { /* ignore */ }
      deja.current = new Set(vus);
    }
    const nouveaux = items.filter(i => !deja.current.has(i.id));
    if (nouveaux.length && sonActif()) {
      bip(); vibrer();
      try {
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          const n = nouveaux[0];
          new Notification(n.titre, { body: nouveaux.length > 1 ? `${n.detail} (+${nouveaux.length - 1} autre(s))` : n.detail, tag: 'yakro-notif' });
        }
      } catch { /* ignore */ }
    }
    ids.forEach(i => deja.current.add(i));
    try { localStorage.setItem(cleVus(userId), JSON.stringify(ids.slice(0, 200))); } catch { /* ignore */ }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const basculer = useCallback(() => { const v = !sonActif(); reglerSon(v); setSon(v); }, []);
  return { items, son, basculer };
}
