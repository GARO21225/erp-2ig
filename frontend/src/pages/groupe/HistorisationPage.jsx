import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import FilterBar from '../../components/ui/FilterBar';
import ExportBar from '../../components/ui/ExportBar';
import { exportExcel } from '../../lib/export';

const ACTIONS_LABELS = {
  CREATE:'Création', UPDATE:'Modification', DELETE:'Suppression',
  VALIDATE:'Validation', REJECT:'Rejet', PAIEMENT:'Paiement',
  LOGIN:'Connexion', LOGOUT:'Déconnexion', LOGIN_FAILED:'Échec connexion',
  REMBOURSE:'Remboursement', ANNULATION:'Annulation', EXPORT:'Export',
  PASSWORD_CHANGE:'Changement MdP', FORCE_LOGOUT:'Déconnexion forcée',
};
const ENTITES_LABELS = {
  CommandeYakro:'Commande', Employe:'Employé', VenteFoncier:'Vente foncière',
  Livraison:'Livraison', Moto:'Moto', Lot:'Lot', Souscripteur:'Souscripteur',
  DepenseFoncier:'Dépense', Caisse:'Caisse', Document:'Document', Utilisateur:'Accès',
};
const ACTION_COLORS = {
  CREATE:'#27500A', UPDATE:'#1a3f6f', DELETE:'#A32D2D', VALIDATE:'#27500A',
  REJECT:'#A32D2D', PAIEMENT:'#E87722', LOGIN:'#888', LOGOUT:'#888',
  LOGIN_FAILED:'#A32D2D',
};
const FILIALES_F = {'GROUPE':'Groupe','YAKRO_GRILL':'Yakro Grill','TOPTELSIG':'TOPTELSIG','LIYA':'LiYA'};

export default function HistorisationPage() {
  const [periode, setPeriode] = useState('semaine');
  const [filiale, setFiliale] = useState('');
  const [action, setAction] = useState('');
  const [entite, setEntite] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', periode, filiale, action, entite, page],
    queryFn: () => api.get('/audit/logs', { params: { periode, filiale, action, entite, page, limit: 50 } }),
    staleTime: 10000,
  });

  const logs = data?.data || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / 50);

  const exportData = () => {
    const entetes = ['Date', 'Heure', 'Utilisateur', 'Filiale', 'Action', 'Entité', 'Détail', 'IP'];
    const lignes = logs.map(l => [
      new Date(l.createdAt).toLocaleDateString('fr'),
      new Date(l.createdAt).toLocaleTimeString('fr'),
      l.utilisateurNom, FILIALES_F[l.filiale] || l.filiale,
      ACTIONS_LABELS[l.action] || l.action,
      ENTITES_LABELS[l.entite] || l.entite,
      l.entiteLabel || '—', l.ip || '—',
    ]);
    exportExcel('historisation_erp', 'Journal', entetes, lignes);
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20 }}>📋 Journal d'activité</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            Historisation complète — toutes filiales — {total.toLocaleString('fr')} entrée(s)
          </p>
        </div>
        <ExportBar onExcelClick={exportData} count={logs.length} />
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        <FilterBar selected={periode} onChange={setPeriode} />
        <select className="input" style={{ width:130 }} value={filiale} onChange={e => { setFiliale(e.target.value); setPage(1); }}>
          <option value="">Toutes filiales</option>
          {Object.entries(FILIALES_F).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" style={{ width:150 }} value={action} onChange={e => { setAction(e.target.value); setPage(1); }}>
          <option value="">Toutes actions</option>
          {Object.entries(ACTIONS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" style={{ width:160 }} value={entite} onChange={e => { setEntite(e.target.value); setPage(1); }}>
          <option value="">Toutes entités</option>
          {Object.entries(ENTITES_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Tableau */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div className="table-container">
          <table className="table-erp">
            <thead>
              <tr>
                <th>Date / Heure</th><th>Utilisateur</th><th>Filiale</th>
                <th>Action</th><th>Entité</th><th>Détail</th><th>IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:24, color:'#888' }}>Chargement...</td></tr>
              )}
              {!isLoading && logs.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><p>Aucune entrée pour cette période</p></div></td></tr>
              )}
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize:11, whiteSpace:'nowrap' }}>
                    <div style={{ fontWeight:500 }}>{new Date(l.createdAt).toLocaleDateString('fr', { day:'2-digit', month:'short' })}</div>
                    <div style={{ color:'#888' }}>{new Date(l.createdAt).toLocaleTimeString('fr', { hour:'2-digit', minute:'2-digit' })}</div>
                  </td>
                  <td style={{ fontWeight:500, fontSize:12 }}>{l.utilisateurNom}</td>
                  <td><span className={`badge ${l.filiale==='YAKRO_GRILL'?'badge-yakro':l.filiale==='LIYA'?'badge-liya':l.filiale==='TOPTELSIG'?'badge-toptelsig':'badge-blue'}`}
                    style={{ fontSize:10 }}>{FILIALES_F[l.filiale]||l.filiale}</span></td>
                  <td>
                    <span className="badge" style={{ background:(ACTION_COLORS[l.action]||'#888')+'18', color: ACTION_COLORS[l.action]||'#888', fontSize:10 }}>
                      {ACTIONS_LABELS[l.action]||l.action}
                    </span>
                  </td>
                  <td style={{ fontSize:11, color:'#555' }}>{ENTITES_LABELS[l.entite]||l.entite}</td>
                  <td style={{ fontSize:11, maxWidth:280 }}>{l.entiteLabel||'—'}</td>
                  <td style={{ fontSize:10, color:'#aaa', fontFamily:'monospace' }}>{l.ip||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div style={{ display:'flex', justifyContent:'center', gap:8, padding:12, borderTop:'0.5px solid #e8e7e1' }}>
            <button className="btn btn-ghost btn-sm" disabled={page<=1} onClick={() => setPage(p=>p-1)}>← Précédent</button>
            <span style={{ fontSize:12, color:'#888', alignSelf:'center' }}>Page {page}/{pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page>=pages} onClick={() => setPage(p=>p+1)}>Suivant →</button>
          </div>
        )}
      </div>
    </div>
  );
}
