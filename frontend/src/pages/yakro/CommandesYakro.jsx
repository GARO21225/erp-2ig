import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import { ChefHat, CheckCircle, Eye, X, Printer } from 'lucide-react';
import FilterBar from '../../components/ui/FilterBar';
import ExportBar from '../../components/ui/ExportBar';
import { exportTicketYakro, exportPDF } from '../../lib/export';
import { exportExcel } from '../../lib/export';

const STATUT_MAP = {
  EN_COURS: { label: 'En cours',    badge: 'badge-blue',  next: 'CUISINE',  nextLabel: 'Envoyer cuisine', color: '#1a3f6f' },
  CUISINE:  { label: 'En cuisine',  badge: 'badge-amber', next: 'PRETE',    nextLabel: '✓ Prête', color: '#BA7517' },
  PRETE:    { label: 'Prête',       badge: 'badge-green', next: 'SERVIE',   nextLabel: 'Servie', color: '#27500A' },
  SERVIE:   { label: 'Servie',      badge: 'badge-gray',  next: null,       nextLabel: null, color: '#888' },
  PAYEE:    { label: 'Payée ✓',     badge: 'badge-green', next: null,       nextLabel: null, color: '#27500A' },
  ANNULEE:  { label: 'Annulée',     badge: 'badge-red',   next: null,       nextLabel: null, color: '#A32D2D' },
};

function DetailCommande({ commande, onClose, onUpdateStatut }) {
  if (!commande) return null;
  const cfg = STATUT_MAP[commande.statut] || STATUT_MAP.EN_COURS;
  const dureeMin = Math.floor((Date.now() - new Date(commande.createdAt)) / 60000);

  const imprimerTicket = () => {
    const lignes = commande.lignes?.map(l => [
      `${l.quantite}×`, l.produit?.nom || `Article #${l.id.slice(-4)}`,
      `${l.prixUnitaire?.toLocaleString('fr')} F`,
      `${(l.prixUnitaire * l.quantite)?.toLocaleString('fr')} F`,
    ]) || [];
    exportTicketYakro(commande);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 16, color: '#8B1A1A' }}>{commande.numero}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Table {commande.table?.numero || 'Emporter'} · {commande.nbCouverts} couvert(s) · {commande.type?.replace('_', ' ')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Clock size={11} color="#888" />
              <span style={{ fontSize: 11, color: dureeMin > 30 ? '#A32D2D' : '#888' }}>{dureeMin}min depuis la commande</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
            <button onClick={onClose} style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={18} /></button>
          </div>
        </div>

        {/* Lignes commande */}
        <div style={{ marginBottom: 16 }}>
          {commande.lignes?.map(l => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #f0efe9' }}>
              <div>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{l.quantite}×</span>
                <span style={{ fontSize: 13, marginLeft: 6 }}>{l.produit?.nom || `Article ${l.prixUnitaire}F`}</span>
                {l.notes && <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>{l.notes}</div>}
              </div>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#8B1A1A' }}>{(l.prixUnitaire * l.quantite).toLocaleString('fr')} F</span>
            </div>
          ))}
        </div>

        {/* Notes cuisine */}
        {commande.notes && (
          <div style={{ background: '#FDF2F2', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#8B1A1A' }}>
            📝 {commande.notes}
          </div>
        )}

        {/* Total + paiements */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #e8e7e1' }}>
          <span style={{ fontSize: 14, color: '#888' }}>Total</span>
          <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 22, color: '#8B1A1A' }}>{commande.total?.toLocaleString('fr')} F</span>
        </div>
        {commande.paiements?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {commande.paiements.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', padding: '2px 0' }}>
                <span>{p.type?.replace('_', ' ')}{p.reference ? ` · Réf: ${p.reference}` : ''}</span>
                <span style={{ color: '#27500A', fontWeight: 600 }}>{p.montant?.toLocaleString('fr')} F</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions statut */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {cfg.next && (
            <button onClick={() => { onUpdateStatut(commande.id, cfg.next); onClose(); }}
              style={{ flex: 1, padding: '10px', background: '#8B1A1A', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'Syne', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {cfg.nextLabel}
            </button>
          )}
          {commande.statut === 'PAYEE' && (
            <button onClick={imprimerTicket}
              style={{ padding: '10px 16px', background: '#F1EFE8', color: '#555', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Printer size={14} /> Ticket PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommandesYakro() {
  const qc = useQueryClient();
  const [statut, setStatut] = useState('');
  const [selected, setSelected] = useState(null);
  const [filtreDates, setFiltreDates] = useState(null);

  const { data } = useQuery({
    queryKey: ['commandes', statut, filtreDates],
    queryFn: () => yakroAPI.commandes({
      statut: statut || undefined,
      dateDebut: filtreDates?.debut?.toISOString(),
      dateFin: filtreDates?.fin?.toISOString(),
      limit: 100,
    }),
    refetchInterval: 10000,
  });

  const updateStatut = useMutation({
    mutationFn: ({ id, s }) => yakroAPI.updateStatut(id, s),
    onSuccess: () => qc.invalidateQueries(['commandes'])
  });

  const commandes = data?.data || [];
  const total = data?.total || 0;

  // Stats rapides
  const enCuisine = commandes.filter(c => c.statut === 'CUISINE').length;
  const pretes = commandes.filter(c => c.statut === 'PRETE').length;
  const caJour = commandes.filter(c => c.statut === 'PAYEE').reduce((s, c) => s + c.total, 0);

  const handleExport = () => {
    const entetes = ['N° Commande', 'Table', 'Type', 'Couverts', 'Statut', 'Total (F)', 'Nb articles', 'Date'];
    const lignes = commandes.map(c => [
      c.numero, `T${c.table?.numero || 'Emporter'}`, c.type?.replace('_', ' '),
      c.nbCouverts, c.statut, c.total?.toLocaleString('fr'),
      c.lignes?.length || 0, new Date(c.createdAt).toLocaleDateString('fr')
    ]);
    exportExcel('commandes_yakro', 'Commandes', entetes, lignes);
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Commandes</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{total} commande(s)</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <FilterBar onChange={setFiltreDates} defaultPreset="today" color="#8B1A1A" />
          <ExportBar onExcelClick={handleExport} count={commandes.length} />
        </div>
      </div>

      {/* KPIs rapides */}
      <div style={{ display: 'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'En cuisine 🍳', value: enCuisine, color: '#BA7517' },
          { label: 'Prêtes 🔔', value: pretes, color: '#27500A' },
          { label: 'CA période', value: (caJour / 1000).toFixed(0) + 'k F', color: '#8B1A1A' },
          { label: 'Payées', value: commandes.filter(c => c.statut === 'PAYEE').length, color: '#27500A' },
        ].map(k => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 20, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['', 'Toutes'], ['EN_COURS', 'En cours'], ['CUISINE', 'Cuisine'], ['PRETE', 'Prêtes'], ['SERVIE', 'Servies'], ['PAYEE', 'Payées']].map(([k, v]) => (
          <button key={k} onClick={() => setStatut(k)}
            style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
              background: statut === k ? '#8B1A1A' : '#F1EFE8',
              color: statut === k ? 'white' : '#666',
              fontWeight: statut === k ? 600 : 400 }}>
            {v}
          </button>
        ))}
      </div>

      {/* Grille commandes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {commandes.map(cmd => {
          const cfg = STATUT_MAP[cmd.statut] || STATUT_MAP.EN_COURS;
          const duree = Math.floor((Date.now() - new Date(cmd.createdAt)) / 60000);
          return (
            <div key={cmd.id} className="card"
              style={{ cursor: 'pointer', borderTop: `2px solid ${cfg.color}`, borderLeft: cmd.statut === 'PRETE' ? '3px solid #27500A' : undefined }}
              onClick={() => setSelected(cmd)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#8B1A1A' }}>{cmd.numero}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>T{cmd.table?.numero || 'Emporter'} · {cmd.nbCouverts} couv.</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                  <div style={{ fontSize: 10, color: duree > 30 ? '#A32D2D' : '#aaa', marginTop: 3 }}>⏱ {duree}min</div>
                </div>
              </div>

              {/* Articles */}
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                {cmd.lignes?.slice(0, 3).map(l => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{l.quantite}× {l.produit?.nom || '—'}</span>
                    <span style={{ color: '#888' }}>{(l.prixUnitaire * l.quantite).toLocaleString('fr')} F</span>
                  </div>
                ))}
                {(cmd.lignes?.length || 0) > 3 && (
                  <div style={{ color: '#aaa', fontSize: 11 }}>+{cmd.lignes.length - 3} autres articles</div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: '#8B1A1A' }}>{cmd.total?.toLocaleString('fr')} F</span>
                {cfg.next && (
                  <button onClick={(e) => { e.stopPropagation(); updateStatut.mutate({ id: cmd.id, s: cfg.next }); }}
                    style={{ padding: '4px 10px', fontSize: 11, border: 'none', borderRadius: 6, background: cfg.color + '20', color: cfg.color, cursor: 'pointer', fontWeight: 600 }}>
                    {cfg.nextLabel}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {commandes.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#ccc', fontSize: 13 }}>
            <ChefHat size={32} style={{ marginBottom: 8 }} /><br />
            Aucune commande {statut ? `"${statut}"` : ''}
          </div>
        )}
      </div>

      {selected && (
        <DetailCommande
          commande={selected}
          onClose={() => setSelected(null)}
          onUpdateStatut={(id, s) => updateStatut.mutate({ id, s })}
        />
      )}
    </div>
  );
}
