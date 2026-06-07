import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import { Plus, X, Download, Edit2 } from 'lucide-react';

export default function MenuPage() {
  const qc = useQueryClient();
  const [cat, setCat] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ nom: '', categorie: 'GARNITURE', prix: '', description: '', disponible: true });

  const { data: menu, isLoading } = useQuery({ queryKey: ['menu'], queryFn: () => yakroAPI.menu() });
  const seedMut = useMutation({ mutationFn: yakroAPI.seedMenu, onSuccess: () => qc.invalidateQueries(['menu']) });
  const createMut = useMutation({ mutationFn: yakroAPI.createMenu, onSuccess: () => { qc.invalidateQueries(['menu']); setShowCreate(false); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => yakroAPI.updateMenu(id, data), onSuccess: () => { qc.invalidateQueries(['menu']); setEditItem(null); } });
  const deleteMut = useMutation({ mutationFn: yakroAPI.deleteMenu, onSuccess: () => qc.invalidateQueries(['menu']) });

  const categories = Object.keys(menu?.grouped || {});
  const items = cat ? (menu?.grouped?.[cat] || []) : (menu?.items || []);

  const openEdit = (item) => { setEditItem(item); setForm({ nom: item.nom, categorie: item.categorie, prix: item.prix, description: item.description || '', disponible: item.disponible }); };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Menu & Carte</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{menu?.items?.length || 0} articles · Yakro Grill 2026</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(menu?.items?.length || 0) === 0 && (
            <button className="btn btn-sm btn-ghost" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
              <Download size={13} /> {seedMut.isPending ? 'Import...' : 'Importer menu PDF'}
            </button>
          )}
          <button className="btn btn-sm" style={{ background: '#8B1A1A', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}><Plus size={13} /> Article</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => setCat('')} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, background: !cat ? '#8B1A1A' : '#F1EFE8', color: !cat ? 'white' : '#666', fontWeight: !cat ? 600 : 400 }}>Tout</button>
        {categories.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, background: cat === c ? '#8B1A1A' : '#F1EFE8', color: cat === c ? 'white' : '#666', fontWeight: cat === c ? 600 : 400 }}>
            {c.replace(/_/g, ' ')} <span style={{ opacity: 0.6 }}>({menu?.grouped?.[c]?.length || 0})</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13 }}>Chargement...</div> : (
          <table className="table-erp">
            <thead><tr><th>Article</th><th>Catégorie</th><th>Prix</th><th>Disponible</th><th></th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{item.nom}</div>
                    {item.description && <div style={{ fontSize: 11, color: '#888' }}>{item.description}</div>}
                  </td>
                  <td><span style={{ fontSize: 11, background: '#FDF2F2', color: '#8B1A1A', padding: '2px 8px', borderRadius: 10 }}>{item.categorie.replace(/_/g, ' ')}</span></td>
                  <td style={{ fontWeight: 600, color: '#8B1A1A' }}>{item.prix?.toLocaleString('fr')} F</td>
                  <td>
                    <button onClick={() => updateMut.mutate({ id: item.id, data: { disponible: !item.disponible } })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <span className={`badge ${item.disponible ? 'badge-green' : 'badge-gray'}`}>{item.disponible ? 'Oui' : 'Non'}</span>
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><Edit2 size={13} /></button>
                      <button onClick={() => { if (window.confirm('Supprimer ?')) deleteMut.mutate(item.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D' }}><X size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#ccc', padding: 40, fontSize: 13 }}>Menu vide. Importez depuis le PDF ou créez des articles.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {(showCreate || editItem) && (
        <div className="modal-overlay" onClick={() => { setShowCreate(false); setEditItem(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>{editItem ? 'Modifier article' : 'Nouvel article'}</h3>
              <button onClick={() => { setShowCreate(false); setEditItem(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Nom</label><input className="input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} /></div>
              <div><label className="label">Catégorie</label>
                <select className="input" value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}>
                  {['GARNITURE', 'PLAT_EUROPEEN', 'VOLAILLE', 'VIANDE', 'BROCHETTE', 'PLATEAU', 'PIZZA', 'CHAWARMA', 'DESSERT', 'BIERE', 'COCKTAIL_SANS_ALCOOL', 'COCKTAIL_ALCOOLISE', 'VIN', 'CHAMPAGNE', 'SUCRERIE', 'TISANE'].map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Prix (FCFA)</label><input className="input" type="number" value={form.prix} onChange={e => setForm(f => ({ ...f, prix: e.target.value }))} /></div>
              <div><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowCreate(false); setEditItem(null); }}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#8B1A1A', color: 'white', border: 'none' }}
                onClick={() => editItem ? updateMut.mutate({ id: editItem.id, data: { ...form, prix: Number(form.prix) } }) : createMut.mutate({ ...form, prix: Number(form.prix) })}>
                {editItem ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
