// StocksPage.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stocksAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { Plus, AlertTriangle, X } from 'lucide-react';

export default function StocksPage() {
  const { filiale } = useAuthStore();
  const qc = useQueryClient();
  const [filialeFilter, setFilialeFilter] = useState(filiale === 'GROUPE' ? '' : filiale);
  const [showCreate, setShowCreate] = useState(false);
  const [showMvt, setShowMvt] = useState(null);
  const [form, setForm] = useState({ nom: '', categorie: '', unite: 'unité', prixAchat: '', prixVente: '', stockAlert: 5, filiale: filiale === 'GROUPE' ? 'YAKRO_GRILL' : filiale });
  const [mvtForm, setMvtForm] = useState({ type: 'ENTREE', quantite: '', motif: '', typeMotif: '' });

  const { data: produits, isLoading } = useQuery({ queryKey: ['produits', filialeFilter], queryFn: () => stocksAPI.produits({ filiale: filialeFilter || undefined }) });
  const createMut = useMutation({ mutationFn: stocksAPI.createProduit, onSuccess: () => { qc.invalidateQueries(['produits']); setShowCreate(false); } });
  const mvtMut = useMutation({
    mutationFn: (data) => {
      if (data.type === 'PERTE' && (!data.motif || data.motif.trim() === '')) {
        return Promise.reject({ message: 'Le motif est obligatoire pour une perte de stock' });
      }
      return stocksAPI.addMouvement(data);
    },
    onSuccess: () => { qc.invalidateQueries(['produits']); setShowMvt(null); },
    onError: (err) => alert(err.message || 'Erreur lors du mouvement de stock'),
  });

  const list = Array.isArray(produits) ? produits : [];
  const enAlerte = list.filter(p => p.enAlerte).length;

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Stocks & Approvisionnements</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
            {list.length} produits
            {enAlerte > 0 && <span style={{ color: '#A32D2D', marginLeft: 8 }}>⚠ {enAlerte} en alerte</span>}
          </div>
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}><Plus size={13} /> Produit</button>
      </div>

      {filiale === 'GROUPE' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[['', 'Toutes'], ['YAKRO_GRILL', 'Yakro Grill'], ['TOPTELSIG', 'TOPTELSIG'], ['LIYA', 'LiYA']].map(([k, v]) => (
            <button key={k} onClick={() => setFilialeFilter(k)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, background: filialeFilter === k ? '#1a3f6f' : '#F1EFE8', color: filialeFilter === k ? 'white' : '#666' }}>{v}</button>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13 }}>Chargement...</div> : (
          <table className="table-erp">
            <thead><tr><th>Produit</th><th>Catégorie</th><th>Stock actuel</th><th>Alerte à</th><th>Prix achat</th><th>Prix vente</th><th></th></tr></thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{p.nom}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{p.reference}</div>
                  </td>
                  <td><span className="badge badge-gray">{p.categorie}</span></td>
                  <td>
                    <span style={{ fontWeight: 600, color: p.enAlerte ? '#A32D2D' : '#27500A', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {p.enAlerte && <AlertTriangle size={12} />}
                      {p.stockTotal} {p.unite}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#888' }}>{p.stockAlert} {p.unite}</td>
                  <td style={{ fontSize: 13 }}>{p.prixAchat?.toLocaleString('fr')} F</td>
                  <td style={{ fontSize: 13 }}>{p.prixVente?.toLocaleString('fr')} F</td>
                  <td>
                    <button onClick={() => setShowMvt(p)} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}>Mouvement</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#ccc', padding: 40, fontSize: 13 }}>Aucun produit en stock</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouveau produit</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Nom</label><input className="input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} /></div>
              <div><label className="label">Catégorie</label><input className="input" value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))} /></div>
              <div><label className="label">Unité</label><input className="input" value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} /></div>
              <div><label className="label">Prix achat (F)</label><input className="input" type="number" value={form.prixAchat} onChange={e => setForm(f => ({ ...f, prixAchat: e.target.value }))} /></div>
              <div><label className="label">Prix vente (F)</label><input className="input" type="number" value={form.prixVente} onChange={e => setForm(f => ({ ...f, prixVente: e.target.value }))} /></div>
              <div><label className="label">Seuil d'alerte</label><input className="input" type="number" value={form.stockAlert} onChange={e => setForm(f => ({ ...f, stockAlert: Number(e.target.value) }))} /></div>
              {filiale === 'GROUPE' && (
                <div><label className="label">Filiale</label>
                  <select className="input" value={form.filiale} onChange={e => setForm(f => ({ ...f, filiale: e.target.value }))}>
                    {['YAKRO_GRILL', 'TOPTELSIG', 'LIYA'].map(k => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" onClick={() => createMut.mutate({ ...form, prixAchat: Number(form.prixAchat), prixVente: Number(form.prixVente) })}>Créer</button>
            </div>
          </div>
        </div>
      )}

      {showMvt && (
        <div className="modal-overlay" onClick={() => setShowMvt(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Mouvement stock — {showMvt.nom}</h3>
              <button onClick={() => setShowMvt(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label className="label">Type</label>
                <select className="input" value={mvtForm.type} onChange={e => setMvtForm(f => ({ ...f, type: e.target.value, typeMotif: '' }))}>
                  {['ENTREE', 'SORTIE', 'PERTE', 'INVENTAIRE'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="label">Quantité</label>
                <input className="input" type="number" value={mvtForm.quantite} onChange={e => setMvtForm(f => ({ ...f, quantite: e.target.value }))} />
              </div>
              {mvtForm.type === 'PERTE' ? (
                <>
                  <div>
                    <label className="label">Type de perte <span style={{ color: '#A32D2D' }}>* obligatoire</span></label>
                    <select className="input" value={mvtForm.typeMotif} onChange={e => setMvtForm(f => ({ ...f, typeMotif: e.target.value }))}>
                      <option value="">Sélectionner un motif</option>
                      <option value="PEREMPTION">Péremption</option>
                      <option value="CASSE">Casse</option>
                      <option value="VOL">Vol</option>
                      <option value="CONSO_INTERNE">Consommation interne (staff)</option>
                      <option value="OFFERT_CLIENT">Offert au client</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Description <span style={{ color: '#A32D2D' }}>* obligatoire</span></label>
                    <input className="input" value={mvtForm.motif} onChange={e => setMvtForm(f => ({ ...f, motif: e.target.value }))} placeholder="Ex: Bouteilles cassées lors de la livraison" />
                  </div>
                </>
              ) : (
                <div><label className="label">Motif</label>
                  <input className="input" value={mvtForm.motif} onChange={e => setMvtForm(f => ({ ...f, motif: e.target.value }))} />
                </div>
              )}
            </div>
            {mvtForm.type === 'PERTE' && (!mvtForm.motif || !mvtForm.typeMotif) && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#FCEBEB', borderRadius: 8, fontSize: 12, color: '#A32D2D' }}>
                ⚠ Type de perte et description obligatoires
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMvt(null)}>Annuler</button>
              <button className="btn btn-primary btn-sm"
                disabled={mvtForm.type === 'PERTE' && (!mvtForm.motif || !mvtForm.typeMotif)}
                onClick={() => mvtMut.mutate({ produitId: showMvt.id, filiale: showMvt.filiale, ...mvtForm, quantite: Number(mvtForm.quantite) })}>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
