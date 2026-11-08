import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { stocksAPI } from '../../lib/api';
import { exportExcel } from '../../lib/export';

const TYPES = { ENTREE: { l: 'Entrée', c: '#27500A', bg: '#EAF3DE', s: '+' }, SORTIE: { l: 'Sortie / vente', c: '#1a3f6f', bg: '#EEF3FB', s: '−' }, PERTE: { l: 'Perte', c: '#A32D2D', bg: '#FCEBEB', s: '−' }, INVENTAIRE: { l: 'Inventaire', c: '#5F5E5A', bg: '#F1EFE8', s: '=' }, TRANSFERT: { l: 'Transfert', c: '#BA7517', bg: '#FAEEDA', s: '→' } };
const iso = (d) => d.toISOString().slice(0, 10);

/** Historique de la gestion des stocks : entrées, ventes, pertes, inventaires. */
export default function HistoriqueStocks() {
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
