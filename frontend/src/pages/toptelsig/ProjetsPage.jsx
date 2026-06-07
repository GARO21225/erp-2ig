import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI } from '../../lib/api';
import { Plus, X, MapPin, Upload, Download } from 'lucide-react';
import ImportButton from '../../components/ui/ImportButton';
import ExportBar from '../../components/ui/ExportBar';
import { exportExcel, exportPDF, exportLots } from '../../lib/export';

const STATUT_COLORS = { EN_COURS: 'badge-blue', TERMINE: 'badge-green', SUSPENDU: 'badge-amber' };

function ModalImportLots({ projetId, projetNom, onClose }) {
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const TEMPLATE_COLS = ['numero', 'superficie', 'prix', 'ilot', 'latitude', 'longitude'];

  const handleData = ({ entetes, lignes, nomFichier }) => {
    const headersLow = entetes.map(h => h.toLowerCase().replace(/ \*.*$/, '').trim());
    const erreurs = [];
    const lotsPreview = [];
    
    lignes.slice(0, 5).forEach((row, i) => {
      const obj = {};
      headersLow.forEach((h, idx) => { obj[h] = row[idx]; });
      lotsPreview.push(obj);
    });
    setPreview({ entetes, lignes, nomFichier, headersLow, preview: lotsPreview });
  };

  const confirmerImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('projetId', projetId);
      
      // Recréer le fichier Excel depuis les données parsées
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet([preview.entetes, ...preview.lignes]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Lots');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      formData.append('fichier', blob, 'lots.xlsx');
      
      const token = JSON.parse(localStorage.getItem('2ig-auth') || '{}')?.state?.token;
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/toptelsig/lots/import`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ erreur: e.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Import lots — {projetNom}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {!result && (
          <>
            <div style={{ background: '#EEF3FB', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1a3f6f' }}>
              Colonnes attendues : <strong>numero *, superficie *, prix *, ilot, latitude, longitude</strong><br />
              Maximum 500 lots par fichier.
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <ImportButton onData={handleData} label="Sélectionner le fichier Excel" color="#1a3f6f" />
              <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/toptelsig/lots/template?projetId=${projetId}`}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, background: '#F1EFE8', color: '#555', textDecoration: 'none', fontSize: 12 }}>
                <Download size={12} /> Télécharger template
              </a>
            </div>

            {preview && (
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                  Aperçu — {preview.lignes.length} ligne(s) détectée(s) dans "{preview.nomFichier}"
                </div>
                <div style={{ overflow: 'auto', maxHeight: 200, border: '0.5px solid #e8e7e1', borderRadius: 8 }}>
                  <table className="table-erp" style={{ fontSize: 11 }}>
                    <thead><tr>{preview.entetes.slice(0, 6).map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{preview.preview.map((row, i) => (
                      <tr key={i}>{preview.entetes.slice(0, 6).map(h => <td key={h}>{String(row[h.toLowerCase().replace(/ \*.*$/,'').trim()] || '—')}</td>)}</tr>
                    ))}</tbody>
                  </table>
                </div>
                {preview.lignes.length > 5 && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>...et {preview.lignes.length - 5} autres lignes</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>Changer de fichier</button>
                  <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={confirmerImport} disabled={importing}>
                    {importing ? 'Import en cours...' : `Importer ${preview.lignes.length} lots`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {result && (
          <div>
            <div style={{ padding: '14px', background: result.erreur ? '#FCEBEB' : '#EAF3DE', borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: result.erreur ? '#A32D2D' : '#27500A', marginBottom: 6 }}>
                {result.erreur ? '❌ Erreur' : `✅ ${result.importes} lot(s) importé(s)`}
              </div>
              {result.message && <div style={{ fontSize: 13 }}>{result.message}</div>}
            </div>
            {result.erreurs?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#A32D2D' }}>Lignes en erreur :</div>
                <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
                  {result.erreurs.map((e, i) => <div key={i} style={{ padding: '3px 0', color: '#666' }}>• {e}</div>)}
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={onClose}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjetsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showImportLots, setShowImportLots] = useState(null); // { id, nom }
  const [form, setForm] = useState({ code: '', nom: '', localisation: '', ville: 'Abidjan', superficie: '', nombreLots: '', prixLotMin: '', prixLotMax: '', description: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: projets, isLoading } = useQuery({ queryKey: ['projets'], queryFn: toptelsigAPI.projets });
  const createMut = useMutation({ mutationFn: toptelsigAPI.createProjet, onSuccess: () => { qc.invalidateQueries(['projets']); setShowCreate(false); } });

  const list = Array.isArray(projets) ? projets : [];

  const handleExportLots = async (projet) => {
    const lots = await toptelsigAPI.lots({ projetId: projet.id, limit: 1000 });
    const { entetes, lignes } = exportLots(Array.isArray(lots) ? lots : []);
    exportExcel(`lots_${projet.code}`, `Lots ${projet.nom}`, entetes, lignes);
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Projets Fonciers</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{list.length} projets</div>
        </div>
        <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}>
          <Plus size={13} /> Nouveau projet
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Projets actifs', value: list.filter(p => p.statut === 'EN_COURS').length },
          { label: 'Total lots', value: list.reduce((s, p) => s + (p._count?.lots || 0), 0) },
          { label: 'Lots vendus', value: list.reduce((s, p) => s + (p.statsLots?.VENDU || 0), 0) },
          { label: 'Lots disponibles', value: list.reduce((s, p) => s + (p.statsLots?.DISPONIBLE || 0), 0) },
        ].map(k => (
          <div key={k.label} className="kpi"><div className="kpi-label">{k.label}</div><div className="kpi-value" style={{ color: '#1a3f6f' }}>{k.value}</div></div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888', fontSize: 13 }}>Chargement...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {list.map(p => {
            const total = p._count?.lots || 0;
            const vendus = p.statsLots?.VENDU || 0;
            const disponibles = p.statsLots?.DISPONIBLE || 0;
            const reserves = p.statsLots?.RESERVE || 0;
            const pct = total > 0 ? Math.round((vendus / total) * 100) : 0;
            return (
              <div key={p.id} className="card" style={{ borderTop: '3px solid #1a3f6f' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>{p.nom}</div>
                    <div style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <MapPin size={11} /> {p.ville} · {p.code}
                    </div>
                  </div>
                  <span className={`badge ${STATUT_COLORS[p.statut] || 'badge-gray'}`}>{p.statut}</span>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                    <span>Avancement ventes</span><span style={{ fontWeight: 600, color: '#1a3f6f' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, background: '#EEF3FB', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#1a3f6f', borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  {[['Disponibles', disponibles, '#639922'], ['Réservés', reserves, '#BA7517'], ['Vendus', vendus, '#1a3f6f']].map(([label, val, color]) => (
                    <div key={label} style={{ background: '#F7F7F5', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Syne', color }}>{val}</div>
                      <div style={{ fontSize: 10, color: '#888' }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 10 }}>
                  <span>{(p.superficie / 10000).toFixed(2)} ha</span>
                  <span>{p.prixLotMin?.toLocaleString('fr')} — {p.prixLotMax?.toLocaleString('fr')} F/lot</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setShowImportLots({ id: p.id, nom: p.nom })} className="btn btn-sm btn-ghost" style={{ flex: 1, fontSize: 11, justifyContent: 'center' }}>
                    <Upload size={11} /> Importer lots
                  </button>
                  <button onClick={() => handleExportLots(p)} className="btn btn-sm" style={{ flex: 1, fontSize: 11, background: '#EAF3DE', color: '#27500A', border: 'none', justifyContent: 'center' }}>
                    <Download size={11} /> Export lots
                  </button>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#ccc', fontSize: 13 }}>Aucun projet foncier.</div>}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouveau projet foncier</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['Code', 'code'], ['Nom', 'nom'], ['Localisation', 'localisation'], ['Ville', 'ville']].map(([label, key]) => (
                <div key={key}><label className="label">{label}</label><input className="input" value={form[key]} onChange={e => set(key, e.target.value)} /></div>
              ))}
              <div><label className="label">Superficie (m²)</label><input className="input" type="number" value={form.superficie} onChange={e => set('superficie', e.target.value)} /></div>
              <div><label className="label">Nombre de lots</label><input className="input" type="number" value={form.nombreLots} onChange={e => set('nombreLots', e.target.value)} /></div>
              <div><label className="label">Prix lot min (FCFA)</label><input className="input" type="number" value={form.prixLotMin} onChange={e => set('prixLotMin', e.target.value)} /></div>
              <div><label className="label">Prix lot max (FCFA)</label><input className="input" type="number" value={form.prixLotMax} onChange={e => set('prixLotMax', e.target.value)} /></div>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Description</label><input className="input" value={form.description} onChange={e => set('description', e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={() => createMut.mutate({ ...form, superficie: Number(form.superficie), nombreLots: Number(form.nombreLots), prixLotMin: Number(form.prixLotMin), prixLotMax: Number(form.prixLotMax) })}>Créer</button>
            </div>
          </div>
        </div>
      )}

      {showImportLots && (
        <ModalImportLots projetId={showImportLots.id} projetNom={showImportLots.nom} onClose={() => { setShowImportLots(null); qc.invalidateQueries(['projets']); }} />
      )}
    </div>
  );
}
