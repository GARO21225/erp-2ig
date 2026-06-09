import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { liyaAPI } from '../../lib/api';
import { Package, Plus, X, TrendingUp, Archive, CheckCircle } from 'lucide-react';
import ExportBar from '../../components/ui/ExportBar';
import TemplateButton from '../../components/ui/TemplateButton';
import { exportExcel } from '../../lib/export';

const STATUTS = { EN_STOCK: 'badge-green', SORTI: 'badge-gray', EN_TRANSIT: 'badge-amber', LITIGE: 'badge-red' };

export default function Stock3PLPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('EN_STOCK');
  const [form, setForm] = useState({ clientNom:'', clientTel:'', article:'', quantite:'', unite:'unité', notes:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const { data: stocks = [], isLoading } = useQuery({
    queryKey: ['stock3pl', statutFilter],
    queryFn: () => liyaAPI.stock3pl({ statut: statutFilter || undefined }),
  });

  const createMut = useMutation({
    mutationFn: liyaAPI.createStock3pl,
    onSuccess: () => { qc.invalidateQueries(['stock3pl']); setShowCreate(false); setForm({ clientNom:'', clientTel:'', article:'', quantite:'', unite:'unité', notes:'' }); }
  });

  const sortirMut = useMutation({
    mutationFn: (id) => liyaAPI.sortirStock3pl(id),
    onSuccess: () => qc.invalidateQueries(['stock3pl']),
  });

  const filtered = stocks.filter(s =>
    !search || `${s.clientNom} ${s.article}`.toLowerCase().includes(search.toLowerCase())
  );

  // KPI
  const enStock = stocks.filter(s => s.statut === 'EN_STOCK').length;
  const clients = [...new Set(stocks.filter(s => s.statut === 'EN_STOCK').map(s => s.clientNom))].length;
  const articles = [...new Set(stocks.filter(s => s.statut === 'EN_STOCK').map(s => s.article))].length;

  const exportData = () => {
    const entetes = ['Client','Téléphone','Article','Quantité','Unité','Statut','Date entrée','Notes'];
    const lignes = filtered.map(s => [s.clientNom, s.clientTel, s.article, s.quantite, s.unite, s.statut, new Date(s.dateEntree).toLocaleDateString('fr'), s.notes || '']);
    exportExcel('stock_clients_3pl', 'Stock 3PL', entetes, lignes);
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#E85D04' }}>📦 Stock Clients 3PL</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Entreposage pour compte de tiers</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <ExportBar onExcelClick={exportData} count={filtered.length} />
          <button className="btn btn-primary btn-sm" style={{ background:'#E85D04', border:'none' }} onClick={() => setShowCreate(true)}>
            <Plus size={13} /> Nouvelle entrée
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid-kpi" style={{ marginBottom:16 }}>
        <div className="kpi">
          <div className="kpi-label">Articles en stock</div>
          <div className="kpi-value" style={{ color:'#E85D04' }}>{enStock}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Clients actifs</div>
          <div className="kpi-value" style={{ color:'#1a3f6f' }}>{clients}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Références</div>
          <div className="kpi-value">{articles}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total entrées</div>
          <div className="kpi-value">{stocks.length}</div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input className="input" style={{ width:200 }} placeholder="Rechercher client, article..." value={search} onChange={e => setSearch(e.target.value)} />
        {['','EN_STOCK','SORTI','EN_TRANSIT','LITIGE'].map(s => (
          <button key={s} onClick={() => setStatutFilter(s)}
            className={`filter-btn ${statutFilter === s ? 'active' : ''}`}>
            {s || 'Tous'}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div className="table-container">
          <table className="table-erp">
            <thead><tr><th>Client</th><th>Téléphone</th><th>Article</th><th>Qté</th><th>Unité</th><th>Statut</th><th>Entrée</th><th>Actions</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} style={{ textAlign:'center', padding:20, color:'#888' }}>Chargement...</td></tr>}
              {filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight:500 }}>{s.clientNom}</td>
                  <td style={{ fontSize:11, color:'#888' }}>{s.clientTel}</td>
                  <td>{s.article}</td>
                  <td style={{ fontWeight:600 }}>{s.quantite}</td>
                  <td style={{ fontSize:11, color:'#888' }}>{s.unite}</td>
                  <td><span className={`badge ${STATUTS[s.statut] || 'badge-gray'}`} style={{ fontSize:10 }}>{s.statut}</span></td>
                  <td style={{ fontSize:11 }}>{new Date(s.dateEntree).toLocaleDateString('fr')}</td>
                  <td>
                    {s.statut === 'EN_STOCK' && (
                      <button className="btn btn-ghost btn-xs" style={{ color:'#27500A' }}
                        onClick={() => sortirMut.mutate(s.id)} title="Sortir du stock">
                        <CheckCircle size={11} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state"><Package size={32} /><p>Aucun article en stock</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth:460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ margin:0, fontFamily:'Syne' }}>Nouvelle entrée stock 3PL</h3>
              <button onClick={() => setShowCreate(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <div><label className="label">Client *</label><input className="input" value={form.clientNom} onChange={e => set('clientNom',e.target.value)} /></div>
              <div><label className="label">Téléphone *</label><input className="input" value={form.clientTel} onChange={e => set('clientTel',e.target.value)} /></div>
              <div><label className="label">Article *</label><input className="input" value={form.article} onChange={e => set('article',e.target.value)} /></div>
              <div><label className="label">Quantité *</label><input className="input" type="number" value={form.quantite} onChange={e => set('quantite',e.target.value)} /></div>
              <div><label className="label">Unité</label><input className="input" value={form.unite} onChange={e => set('unite',e.target.value)} placeholder="unité, kg, carton..." /></div>
              <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => set('notes',e.target.value)} /></div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-primary" style={{ background:'#E85D04', border:'none' }}
                disabled={!form.clientNom||!form.article||!form.quantite||createMut.isPending}
                onClick={() => createMut.mutate({ ...form, quantite: Number(form.quantite) })}>
                {createMut.isPending ? 'Enregistrement...' : 'Ajouter au stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
