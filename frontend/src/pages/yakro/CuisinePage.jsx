import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Flame, GlassWater, UtensilsCrossed } from 'lucide-react';
import { yakroAPI } from '../../lib/api';
import { useYakro } from '../../lib/useYakro';

const ROUGE = '#8B1A1A';
const minutes = (d, now) => Math.max(0, Math.floor((now - new Date(d)) / 60000));
const couleur = (m) => (m >= 20 ? { c: '#A32D2D', bg: '#FCEBEB' } : m >= 10 ? { c: '#BA7517', bg: '#FAEEDA' } : { c: '#27500A', bg: '#EAF3DE' });
const STATIONS = [['TOUT', 'Tout', UtensilsCrossed], ['CUISINE', 'Cuisine', Flame], ['BAR', 'Bar', GlassWater]];

/** Écran cuisine / bar : les commandes arrivent, on marque « prêt » et le serveur est prévenu (son + vibration). */
export default function CuisinePage() {
  const qc = useQueryClient();
  const { courant } = useYakro();
  const [station, setStation] = useState('TOUT');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['cuisine', courant?.id], queryFn: yakroAPI.cuisine, enabled: !!courant, refetchInterval: 8000, refetchIntervalInBackground: true });
  const maj = () => { qc.invalidateQueries({ queryKey: ['cuisine'] }); qc.invalidateQueries({ queryKey: ['notifs-yakro'] }); qc.invalidateQueries({ queryKey: ['tables'] }); };
  const pret = useMutation({ mutationFn: ({ id, st }) => yakroAPI.pret(id, st), onSuccess: maj });
  const servi = useMutation({ mutationFn: (id) => yakroAPI.servi(id), onSuccess: maj });

  const dansStation = (l) => station === 'TOUT' || l.station === station;
  const tickets = data.map(t => ({ ...t, aPreparer: t.lignes.filter(l => ['EN_ATTENTE', 'EN_CUISINE'].includes(l.statut) && dansStation(l)), prets: t.lignes.filter(l => l.statut === 'PRET' && dansStation(l)) }));
  const preparer = tickets.filter(t => t.aPreparer.length);
  const recuperer = tickets.filter(t => t.prets.length);

  const Ligne = ({ l, fait }) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '4px 0', opacity: fait ? .85 : 1 }}>
      <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, minWidth: 34, color: ROUGE }}>{l.quantite}×</span>
      <div><div style={{ fontSize: 16, fontWeight: 600 }}>{l.nom}</div>
        {l.notes && <div style={{ fontSize: 12, color: '#BA7517', fontStyle: 'italic' }}>⚠ {l.notes}</div>}</div>
      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#888', whiteSpace: 'nowrap' }}>{l.station === 'BAR' ? '🍹 Bar' : '🍳 Cuisine'}</span>
    </div>
  );
  const Carte = ({ t, lignes, fait }) => {
    const m = minutes(t.createdAt, now), k = couleur(m);
    return (
      <div style={{ background: 'white', border: `2px solid ${fait ? '#27500A' : k.c}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div><div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20 }}>{t.table}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{t.numero} · 👤 {t.serveurNom}{t.zone ? ` · ${t.zone}` : ''}</div></div>
          {!fait && <span style={{ background: k.bg, color: k.c, fontWeight: 800, fontSize: 14, borderRadius: 20, padding: '4px 12px', whiteSpace: 'nowrap' }}>{m} min</span>}
        </div>
        <div style={{ borderTop: '1px dashed #e0ddd2', borderBottom: '1px dashed #e0ddd2', padding: '4px 0' }}>{lignes.map(l => <Ligne key={l.id} l={l} fait={fait} />)}</div>
        {t.notes && <div style={{ fontSize: 12, color: '#6B5F57' }}>📝 {t.notes}</div>}
        {fait
          ? <button className="btn" style={{ minHeight: 48, background: '#27500A', color: 'white', border: 'none', fontWeight: 700, fontSize: 15 }} disabled={servi.isPending} onClick={() => servi.mutate(t.id)}><CheckCircle size={16} /> Récupéré / servi</button>
          : <button className="btn" style={{ minHeight: 52, background: ROUGE, color: 'white', border: 'none', fontWeight: 700, fontSize: 15 }} disabled={pret.isPending} onClick={() => pret.mutate({ id: t.id, st: station })}><CheckCircle size={16} /> Prêt — prévenir {t.serveurNom !== '—' ? t.serveurNom.split(' ')[0] : 'le serveur'}</button>}
      </div>
    );
  };

  return (
    <div className="page-enter">
      <div className="yk-head"><div><h1 className="yk-title">Cuisine & Bar</h1><div className="yk-sub">{courant?.nom} · {preparer.length} à préparer · {recuperer.length} à récupérer</div></div></div>
      <div className="yk-chips" style={{ marginBottom: 14 }}>
        {STATIONS.map(([k, l, Icon]) => <button key={k} className="yk-chip" aria-pressed={station === k} onClick={() => setStation(k)}><Icon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{l}</button>)}
      </div>
      {isError && <div role="alert" style={{ background: '#FDF2F2', color: '#A32D2D', borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 10 }}>Impossible de charger les commandes. Nouvel essai automatique…</div>}
      {isLoading ? <div style={{ padding: 30, textAlign: 'center', color: '#888' }}>Chargement…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 18, alignItems: 'start' }}>
          <section aria-label="À préparer">
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 14, marginBottom: 8, color: ROUGE }}>🔥 À PRÉPARER ({preparer.length})</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {preparer.map(t => <Carte key={t.id} t={t} lignes={t.aPreparer} />)}
              {!preparer.length && <div className="empty-state" style={{ padding: 24 }}><p>Aucune commande en attente</p></div>}
            </div>
          </section>
          <section aria-label="Prêts à récupérer">
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 14, marginBottom: 8, color: '#27500A' }}>✅ PRÊTS À RÉCUPÉRER ({recuperer.length})</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {recuperer.map(t => <Carte key={t.id} t={t} lignes={t.prets} fait />)}
              {!recuperer.length && <div className="empty-state" style={{ padding: 24 }}><p>Rien à récupérer</p></div>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
