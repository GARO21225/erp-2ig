import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { stocksAPI } from '../../lib/api';
import { exportExcel } from '../../lib/export';

const TYPES = { ENTREE: { l: 'Entrée', c: '#27500A', bg: '#EAF3DE', s: '+' }, SORTIE: { l: 'Sortie / vente', c: '#1a3f6f', bg: '#EEF3FB', s: '−' }, PERTE: { l: 'Perte', c: '#A32D2D', bg: '#FCEBEB', s: '−' }, INVENTAIRE: { l: 'Inventaire', c: '#5F5E5A', bg: '#F1EFE8', s: '=' }, TRANSFERT: { l: 'Transfert', c: '#BA7517', bg: '#FAEEDA', s: '→' } };
const iso = (d) => d.toISOString().slice(0, 10);

/** Historique de la gestion des stocks : entrées, ventes, pertes, inventaires. */
function Mouvements() {
  const [du, setDu] = useState(iso(new Date(Date.now() - 29 * 86400000)));
  const [au, setAu] = useState(iso(new Date()));
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['histo-stocks', du, au, type, q],
    queryFn: () => stocksAPI.mouvements({ filiale: 'YAKRO_GRILL', du, au, type: type || undefined, q: q || undefined, limit: 1000 }),
    staleTime: 15000,
  });
  const liste = Array.isArray(data) ? data : [];
  const total = (t) => liste.filter(m => m.type === t).length;
  const exporter = () => exportExcel('historique_stock', 'Mouvements', ['Date', 'Heure', 'Article', 'Référence', 'Type', 'Quantité', 'Unité', 'Motif', 'Opérateur'],
    liste.map(m => [new Date(m.createdAt).toLocaleDateString('fr'), new Date(m.createdAt).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }), m.produit?.nom || '', m.produit?.reference || '', TYPES[m.type]?.l || m.type, m.quantite, m.produit?.unite || '', m.motif || m.typeMotif || '', m.operateur || '']));

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }}>
        <div><label className="label">Du</label><input className="input" type="date" value={du} onChange={e => setDu(e.target.value)} /></div>
        <div><label className="label">Au</label><input className="input" type="date" value={au} onChange={e => setAu(e.target.value)} /></div>
        <label className="yk-search" style={{ flex: '1 1 200px' }}><Search size={16} /><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un article" aria-label="Chercher un article" /></label>
        <button className="btn btn-ghost btn-sm" onClick={exporter} disabled={!liste.length}><Download size={13} /> Exporter Excel</button>
      </div>
      <div className="yk-chips" style={{ marginBottom: 12 }}>
        <button className="yk-chip" aria-pressed={!type} onClick={() => setType('')}>Tous<small>{liste.length}</small></button>
        {Object.entries(TYPES).filter(([k]) => k !== 'TRANSFERT').map(([k, t]) => (
          <button key={k} className="yk-chip" aria-pressed={type === k} onClick={() => setType(type === k ? '' : k)}>{t.l}{!type && <small>{total(k)}</small>}</button>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {isLoading ? <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Chargement…</div>
          : isError ? <div role="alert" style={{ padding: 30, textAlign: 'center', color: '#A32D2D', fontSize: 13 }}>Impossible de charger l'historique du stock.</div>
          : (
            <table className="table-erp">
              <thead><tr><th>Date</th><th>Article</th><th>Type</th><th style={{ textAlign: 'right' }}>Quantité</th><th>Motif</th><th>Opérateur</th></tr></thead>
              <tbody>
                {liste.map(m => {
                  const t = TYPES[m.type] || { l: m.type, c: '#555', bg: '#F1EFE8', s: '' };
                  return (
                    <tr key={m.id}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(m.createdAt).toLocaleDateString('fr')}<div style={{ fontSize: 10, color: '#888' }}>{new Date(m.createdAt).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}</div></td>
                      <td><div style={{ fontWeight: 600, fontSize: 13 }}>{m.produit?.nom || '—'}</div><div style={{ fontSize: 10, color: '#888' }}>{m.produit?.reference}</div></td>
                      <td><span style={{ fontSize: 11, fontWeight: 600, background: t.bg, color: t.c, borderRadius: 10, padding: '2px 9px' }}>{t.l}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'Syne', fontWeight: 800, color: t.c }}>{t.s}{m.quantite} <span style={{ fontSize: 10, fontWeight: 400 }}>{m.produit?.unite}</span></td>
                      <td style={{ fontSize: 12, color: '#555', maxWidth: 260 }}>{m.motif || m.typeMotif || '—'}</td>
                      <td style={{ fontSize: 12 }}>{m.operateur}</td>
                    </tr>
                  );
                })}
                {liste.length === 0 && <tr><td colSpan={6}><div className="empty-state" style={{ padding: 24 }}><p>Aucun mouvement de stock sur cette période</p></div></td></tr>}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}

const n = (v) => (v == null ? '—' : Number.isInteger(v) ? v : Math.round(v * 100) / 100);
const jr = (d) => new Date(d).toLocaleDateString('fr', { day: '2-digit', month: 'short' });

/** Bilan par article + fiche détaillée : acheté quand, vendu quand, reste combien. */
function Bilan() {
  const [du, setDu] = useState(iso(new Date(Date.now() - 29 * 86400000)));
  const [au, setAu] = useState(iso(new Date()));
  const [q, setQ] = useState('');
  const [choisi, setChoisi] = useState(null);
  const { data, isLoading, isError } = useQuery({ queryKey: ['bilan-stock', du, au], queryFn: () => stocksAPI.bilan({ filiale: 'YAKRO_GRILL', du, au }), staleTime: 15000 });
  const { data: fiche } = useQuery({ queryKey: ['fiche-stock', choisi, du, au], queryFn: () => stocksAPI.bilan({ filiale: 'YAKRO_GRILL', du, au, produitId: choisi }), enabled: !!choisi, staleTime: 15000 });
  const lignes = (data?.lignes || []).filter(l => !q || l.nom.toLowerCase().includes(q.toLowerCase()));
  const f = fiche?.lignes?.[0];
  const exporter = () => exportExcel('bilan_stock', 'Bilan', ['Article', 'Réf.', 'Stock début', 'Achats / entrées', 'Retours', 'Ventes', 'Pertes', 'Stock fin', 'Stock actuel'],
    lignes.map(l => [l.nom, l.reference || '', l.stockDebut ?? '', l.entrees, l.retours, l.ventes, l.pertes, l.stockFin, l.stockActuel]));
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }}>
        <div><label className="label">Du</label><input className="input" type="date" value={du} onChange={e => setDu(e.target.value)} /></div>
        <div><label className="label">Au</label><input className="input" type="date" value={au} onChange={e => setAu(e.target.value)} /></div>
        <label className="yk-search" style={{ flex: '1 1 200px' }}><Search size={16} /><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un article (ex. Beaufort)" aria-label="Chercher un article" /></label>
        <button className="btn btn-ghost btn-sm" onClick={exporter} disabled={!lignes.length}><Download size={13} /> Exporter Excel</button>
      </div>

      {f && (
        <div className="card" style={{ marginBottom: 14, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 16, color: '#8B1A1A' }}>{f.nom}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setChoisi(null)}>Fermer</button>
          </div>
          <p style={{ fontSize: 13, margin: '8px 0 12px', lineHeight: 1.6 }}>
            Du <b>{jr(fiche.du)}</b> au <b>{jr(fiche.au)}</b> : <b>{n(f.entrees)}</b> acheté(s), <b>{n(f.ventes)}</b> vendu(s), <b>{n(f.pertes)}</b> perdu(s){f.retours ? <>, <b>{n(f.retours)}</b> remis en stock</> : null}.
            {' '}Il en reste <b>{n(f.stockActuel)}</b> {f.unite}{f.stockDebut == null ? <span style={{ color: '#888' }}> (stock de début inconnu : un inventaire a eu lieu depuis)</span> : null}.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8, marginBottom: 12 }}>
            {[['Stock début', f.stockDebut, '#5F5E5A'], ['Achats', f.entrees, '#27500A'], ['Ventes', f.ventes, '#1a3f6f'], ['Pertes', f.pertes, '#A32D2D'], ['Stock fin', f.stockFin, '#8B1A1A'], ['Actuel', f.stockActuel, '#0F6E56']].map(([l, v, c]) => (
              <div key={l} className="kpi" style={{ borderTop: `3px solid ${c}` }}><div className="kpi-label">{l}</div><div className="kpi-value" style={{ fontSize: 18, color: c }}>{n(v)}</div></div>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-erp">
              <thead><tr><th>Jour</th><th style={{ textAlign: 'right' }}>Acheté</th><th style={{ textAlign: 'right' }}>Vendu</th><th style={{ textAlign: 'right' }}>Perdu</th><th style={{ textAlign: 'right' }}>Retour</th><th style={{ textAlign: 'right' }}>Inventaire</th><th style={{ textAlign: 'right' }}>Reste fin de jour</th></tr></thead>
              <tbody>
                {(f.jours || []).map(j => (
                  <tr key={j.date}><td>{jr(j.date)}</td><td style={{ textAlign: 'right', color: '#27500A' }}>{j.entrees || ''}</td><td style={{ textAlign: 'right', color: '#1a3f6f' }}>{j.ventes || ''}</td><td style={{ textAlign: 'right', color: '#A32D2D' }}>{j.pertes || ''}</td><td style={{ textAlign: 'right' }}>{j.retours || ''}</td><td style={{ textAlign: 'right' }}>{j.inventaire ?? ''}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{n(j.stockFin)}</td></tr>
                ))}
                {!(f.jours || []).length && <tr><td colSpan={7}><div className="empty-state" style={{ padding: 16 }}><p>Aucun mouvement sur la période</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {isLoading ? <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Chargement…</div>
          : isError ? <div role="alert" style={{ padding: 30, textAlign: 'center', color: '#A32D2D', fontSize: 13 }}>Impossible de charger le bilan.</div>
          : (
            <table className="table-erp">
              <thead><tr><th>Article</th><th style={{ textAlign: 'right' }}>Début</th><th style={{ textAlign: 'right' }}>Achats</th><th style={{ textAlign: 'right' }}>Ventes</th><th style={{ textAlign: 'right' }}>Pertes</th><th style={{ textAlign: 'right' }}>Fin</th><th style={{ textAlign: 'right' }}>Actuel</th></tr></thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l.id} onClick={() => setChoisi(l.id)} style={{ cursor: 'pointer', background: choisi === l.id ? '#FAF6F0' : undefined }}>
                    <td><div style={{ fontWeight: 600, fontSize: 13 }}>{l.nom}</div><div style={{ fontSize: 10, color: '#888' }}>{l.reference}</div></td>
                    <td style={{ textAlign: 'right' }}>{n(l.stockDebut)}</td><td style={{ textAlign: 'right', color: '#27500A' }}>{n(l.entrees)}</td>
                    <td style={{ textAlign: 'right', color: '#1a3f6f' }}>{n(l.ventes)}</td><td style={{ textAlign: 'right', color: '#A32D2D' }}>{n(l.pertes)}</td>
                    <td style={{ textAlign: 'right' }}>{n(l.stockFin)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{n(l.stockActuel)}</td>
                  </tr>
                ))}
                {!lignes.length && <tr><td colSpan={7}><div className="empty-state" style={{ padding: 24 }}><p>Aucun article</p></div></td></tr>}
              </tbody>
            </table>
          )}
      </div>
      <p style={{ fontSize: 11, color: '#888', marginTop: 8 }}>Cliquez sur un article pour voir sa fiche jour par jour.</p>
    </div>
  );
}

export default function HistoriqueStocks() {
  const [vue, setVue] = useState('bilan');
  return (
    <div>
      <div className="yk-chips" style={{ marginBottom: 12 }}>
        <button className="yk-chip" aria-pressed={vue === 'bilan'} onClick={() => setVue('bilan')}>Bilan par article</button>
        <button className="yk-chip" aria-pressed={vue === 'mvts'} onClick={() => setVue('mvts')}>Tous les mouvements</button>
      </div>
      {vue === 'bilan' ? <Bilan /> : <Mouvements />}
    </div>
  );
}
