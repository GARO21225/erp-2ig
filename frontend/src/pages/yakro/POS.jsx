import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import { Plus, X, Minus, ShoppingBag, Banknote, Smartphone, CreditCard, CheckCircle } from 'lucide-react';

const STATUT_TABLE = {
  LIBRE:    { label: 'Libre',    color: '#639922', bg: '#F4FAE8', border: '#C0DD97' },
  OCCUPEE:  { label: 'Occupée', color: '#A32D2D', bg: '#FEF6F6', border: '#F7C1C1' },
  RESERVEE: { label: 'Réservée',color: '#BA7517', bg: '#FEFAF0', border: '#FAC775' },
  NETTOYAGE:{ label: 'Nettoyage',color:'#1a3f6f',bg: '#EEF3FB', border: '#B5D4F4' },
};

const ZONES = ['Salle', 'Terrasse', 'VIP', 'Bar'];

const MOYENS_PMT = [
  { key: 'ESPECES',      label: 'Espèces',      icon: Banknote,    color: '#27500A' },
  { key: 'ORANGE_MONEY', label: 'Orange Money', icon: Smartphone,  color: '#E87722' },
  { key: 'MTN_MONEY',    label: 'MTN Money',    icon: Smartphone,  color: '#FFCC00', textColor: '#1a1a1a' },
  { key: 'MOOV_MONEY',   label: 'Moov Money',   icon: Smartphone,  color: '#0066CC' },
  { key: 'WAVE',         label: 'Wave',         icon: Smartphone,  color: '#1A73E8' },
  { key: 'BANQUE',       label: 'Banque/TPE',   icon: CreditCard,  color: '#5F5E5A' },
];

// ─── Panel commande (sélection articles + création commande)
function PanelCommande({ table, menu, onClose, onSave, loading }) {
  const [lignes, setLignes] = useState([]);
  const [notes, setNotes] = useState('');
  const [nbCouverts, setNbCouverts] = useState(table?.capacite || 2);
  const [cat, setCat] = useState(Object.keys(menu?.grouped || {})[0] || '');

  const addArticle = (item) => setLignes(prev => {
    const ex = prev.find(l => l.menuId === item.id);
    if (ex) return prev.map(l => l.menuId === item.id ? { ...l, quantite: l.quantite + 1 } : l);
    return [...prev, { menuId: item.id, nom: item.nom, prixUnitaire: item.prix, quantite: 1 }];
  });

  const removeArticle = (menuId) => setLignes(prev =>
    prev.map(l => l.menuId === menuId ? { ...l, quantite: Math.max(0, l.quantite - 1) } : l).filter(l => l.quantite > 0)
  );

  const total = lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex' }}>
      {/* Carte menu */}
      <div style={{ width: '55%', background: '#F7F7F5', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: '#8B1A1A', padding: '14px 20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>Table {table?.numero} — Nouvelle commande</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>{table?.zone} · {table?.capacite} places</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto', background: 'white', borderBottom: '0.5px solid #e8e7e1' }}>
          {Object.keys(menu?.grouped || {}).map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{ padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
                background: cat === c ? '#8B1A1A' : '#F1EFE8', color: cat === c ? 'white' : '#666' }}>
              {c.replace(/_/g, ' ')} ({menu?.grouped?.[c]?.length || 0})
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, alignContent: 'start' }}>
          {(menu?.grouped?.[cat] || []).filter(i => i.disponible).map(item => {
            const qte = lignes.find(l => l.menuId === item.id)?.quantite || 0;
            return (
              <div key={item.id} onClick={() => addArticle(item)}
                style={{ background: 'white', border: qte > 0 ? '1.5px solid #8B1A1A' : '0.5px solid #e8e7e1', borderRadius: 10, padding: 10, cursor: 'pointer', position: 'relative' }}>
                {qte > 0 && (
                  <div style={{ position: 'absolute', top: -7, right: -7, width: 21, height: 21, borderRadius: '50%', background: '#8B1A1A', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{qte}</div>
                )}
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, lineHeight: 1.2 }}>{item.nom}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#8B1A1A' }}>{item.prix.toLocaleString('fr')} F</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Récapitulatif */}
      <div style={{ width: '45%', background: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #e8e7e1' }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Commande</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: '#888' }}>Couverts :</span>
            <button onClick={() => setNbCouverts(Math.max(1, nbCouverts - 1))} style={{ background: '#F1EFE8', border: 'none', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={12} /></button>
            <span style={{ fontWeight: 600, width: 20, textAlign: 'center' }}>{nbCouverts}</span>
            <button onClick={() => setNbCouverts(nbCouverts + 1)} style={{ background: '#F1EFE8', border: 'none', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={12} /></button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {lignes.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#ccc', fontSize: 13 }}>
              <ShoppingBag size={28} style={{ display: 'block', margin: '0 auto 8px' }} />
              Sélectionnez des articles
            </div>
          ) : (
            lignes.map(l => (
              <div key={l.menuId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderBottom: '0.5px solid #f0efe9' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{l.nom}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{l.prixUnitaire.toLocaleString('fr')} F × {l.quantite}</div>
                </div>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#8B1A1A', marginRight: 6 }}>{(l.prixUnitaire * l.quantite).toLocaleString('fr')} F</span>
                <button onClick={() => removeArticle(l.menuId)} style={{ background: '#F1EFE8', border: 'none', width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={10} /></button>
                <button onClick={() => addArticle({ id: l.menuId, nom: l.nom, prix: l.prixUnitaire })} style={{ background: '#FDF2F2', border: 'none', width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', color: '#8B1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={10} /></button>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '8px 18px', borderTop: '0.5px solid #f0efe9' }}>
          <input className="input" style={{ fontSize: 12 }} placeholder="Notes cuisine..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div style={{ padding: '14px 18px', borderTop: '0.5px solid #e8e7e1', background: '#FAFAF8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#888' }}>Total</span>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 22, color: '#8B1A1A' }}>{total.toLocaleString('fr')} F</span>
          </div>
          <button disabled={lignes.length === 0 || loading}
            onClick={() => onSave({ tableId: table.id, lignes, notes, nbCouverts })}
            style={{ width: '100%', padding: 12, background: lignes.length === 0 ? '#ddd' : '#8B1A1A', color: 'white', border: 'none', borderRadius: 10, fontFamily: 'Syne', fontWeight: 700, fontSize: 15, cursor: lignes.length === 0 ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Envoi...' : 'Envoyer en cuisine'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fix 2 : Modal Paiement Mixte complet ─────────────────────────────────────
function ModalPaiement({ commande, onClose, onPay, loading }) {
  const [lignesPmt, setLignesPmt] = useState([{ typePaiement: 'ESPECES', montant: commande.total, reference: '' }]);
  const [especesRecues, setEspecesRecues] = useState('');

  const total = commande.total || 0;
  const totalSaisi = lignesPmt.reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const resteASaisir = total - totalSaisi;
  const monnaieRendue = lignesPmt.some(p => p.typePaiement === 'ESPECES') && especesRecues
    ? Math.max(0, Number(especesRecues) - lignesPmt.filter(p => p.typePaiement === 'ESPECES').reduce((s, p) => s + Number(p.montant || 0), 0))
    : 0;

  const addLigne = () => {
    if (resteASaisir <= 0) return;
    setLignesPmt(prev => [...prev, { typePaiement: 'ORANGE_MONEY', montant: resteASaisir.toFixed(0), reference: '' }]);
  };

  const removeLigne = (i) => setLignesPmt(prev => prev.filter((_, idx) => idx !== i));

  const updateLigne = (i, field, value) => {
    setLignesPmt(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const canPay = Math.abs(resteASaisir) < 2; // tolérance 1 FCFA

  const handlePay = () => {
    onPay({
      paiements: lignesPmt.map(p => ({ ...p, montant: Number(p.montant) })),
      especesRecues: Number(especesRecues) || 0,
      monnaieRendue,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Paiement — {commande.numero}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Total à encaisser */}
        <div style={{ background: '#FDF2F2', borderRadius: 10, padding: 14, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888' }}>Total à encaisser</div>
          <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 30, color: '#8B1A1A' }}>{total.toLocaleString('fr')} F</div>
        </div>

        {/* Lignes de paiement */}
        {lignesPmt.map((ligne, i) => {
          const moyen = MOYENS_PMT.find(m => m.key === ligne.typePaiement);
          const needRef = ligne.typePaiement !== 'ESPECES';
          return (
            <div key={i} style={{ background: '#F7F7F5', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: needRef ? 8 : 0 }}>
                <select className="input" style={{ flex: 2, fontSize: 12 }} value={ligne.typePaiement}
                  onChange={e => updateLigne(i, 'typePaiement', e.target.value)}>
                  {MOYENS_PMT.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                <input className="input" style={{ flex: 1, fontSize: 13, fontWeight: 600 }} type="number"
                  value={ligne.montant} onChange={e => updateLigne(i, 'montant', e.target.value)} placeholder="Montant" />
                {lignesPmt.length > 1 && (
                  <button onClick={() => removeLigne(i)} style={{ background: '#FCEBEB', border: 'none', borderRadius: 6, padding: '0 8px', cursor: 'pointer', color: '#A32D2D' }}><X size={12} /></button>
                )}
              </div>
              {needRef && (
                <input className="input" style={{ fontSize: 12 }} placeholder={`Réf. transaction ${moyen?.label} *obligatoire*`}
                  value={ligne.reference} onChange={e => updateLigne(i, 'reference', e.target.value)} />
              )}
              {ligne.typePaiement === 'ESPECES' && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" style={{ fontSize: 12 }} type="number" placeholder="Espèces remises par le client"
                    value={especesRecues} onChange={e => setEspecesRecues(e.target.value)} />
                  {especesRecues && Number(especesRecues) >= Number(ligne.montant) && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#27500A', whiteSpace: 'nowrap' }}>
                      Monnaie : {monnaieRendue.toLocaleString('fr')} F
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Ajouter un moyen de paiement */}
        {resteASaisir > 1 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#A32D2D', marginBottom: 6, fontWeight: 500 }}>
              Reste à couvrir : {resteASaisir.toLocaleString('fr')} F
            </div>
            <button onClick={addLigne} style={{ fontSize: 12, border: '1px dashed #d3d1c7', background: 'white', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#666', width: '100%' }}>
              + Ajouter un autre moyen de paiement
            </button>
          </div>
        )}

        {/* Indicateur de cohérence */}
        {Math.abs(resteASaisir) < 2 && (
          <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#27500A' }}>
            <CheckCircle size={14} /> Montants cohérents — prêt à encaisser
          </div>
        )}

        <button disabled={!canPay || loading} onClick={handlePay}
          style={{ width: '100%', padding: 13, background: canPay ? '#8B1A1A' : '#ddd', color: 'white', border: 'none', borderRadius: 10, fontFamily: 'Syne', fontWeight: 700, fontSize: 15, cursor: canPay ? 'pointer' : 'not-allowed' }}>
          {loading ? 'Traitement...' : `Encaisser ${total.toLocaleString('fr')} F`}
        </button>
      </div>
    </div>
  );
}

// ─── POS Principal ────────────────────────────────────────────────────────────
export default function POS() {
  const qc = useQueryClient();
  const [zone, setZone] = useState('Salle');
  const [selectedTable, setSelectedTable] = useState(null);
  const [paiementCommande, setPaiementCommande] = useState(null);

  const { data: tables } = useQuery({ queryKey: ['tables'], queryFn: yakroAPI.tables, refetchInterval: 15000 });
  const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: () => yakroAPI.menu({ disponible: 'true' }) });

  const createCmd = useMutation({ mutationFn: yakroAPI.createCommande, onSuccess: () => { qc.invalidateQueries(['tables']); setSelectedTable(null); } });
  const updateStatut = useMutation({ mutationFn: ({ id, statut }) => yakroAPI.updateStatut(id, statut), onSuccess: () => qc.invalidateQueries(['tables']) });
  const payerCmd = useMutation({
    mutationFn: ({ id, data }) => yakroAPI.payer(id, data),
    onSuccess: () => { qc.invalidateQueries(['tables']); setPaiementCommande(null); }
  });

  const tablesFiltrees = (tables || []).filter(t => t.zone === zone);
  const occupees = (tables || []).filter(t => t.statut === 'OCCUPEE').length;

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Plan de Salle — POS</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
            <span style={{ color: '#A32D2D', fontWeight: 500 }}>{occupees}</span> table(s) occupée(s) · {(tables?.length || 0) - occupees} libre(s)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#888' }}>
          {Object.entries(STATUT_TABLE).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: v.bg, border: `1.5px solid ${v.border}` }} />
              {v.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {ZONES.map(z => (
          <button key={z} onClick={() => setZone(z)}
            style={{ padding: '5px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: zone === z ? '#8B1A1A' : '#F1EFE8', color: zone === z ? 'white' : '#666' }}>
            {z}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {tablesFiltrees.map(t => {
          const s = STATUT_TABLE[t.statut] || STATUT_TABLE.LIBRE;
          const commande = t.commandes?.[0];
          const resa = t.reservations?.[0];
          return (
            <div key={t.id}
              onClick={() => t.statut === 'LIBRE' && setSelectedTable(t)}
              style={{ border: `1.5px solid ${s.border}`, background: s.bg, borderRadius: 12, padding: 14, cursor: t.statut === 'LIBRE' ? 'pointer' : 'default', minHeight: 120 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: s.color }}>T{t.numero}</div>
                <span style={{ fontSize: 10, fontWeight: 500, color: s.color, background: s.border + '40', padding: '2px 6px', borderRadius: 8 }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{t.zone} · {t.capacite} pers.</div>

              {commande && (
                <div>
                  <div style={{ fontSize: 11, color: '#888' }}>{commande.lignes?.length || 0} article(s)</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#8B1A1A', marginBottom: 6 }}>{commande.total?.toLocaleString('fr')} F</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={(e) => { e.stopPropagation(); updateStatut.mutate({ id: commande.id, statut: 'CUISINE' }); }}
                      style={{ flex: 1, padding: '3px 0', fontSize: 10, border: 'none', borderRadius: 5, background: '#FAEEDA', color: '#412402', cursor: 'pointer' }}>Cuisine</button>
                    <button onClick={(e) => { e.stopPropagation(); setPaiementCommande(commande); }}
                      style={{ flex: 1, padding: '3px 0', fontSize: 10, border: 'none', borderRadius: 5, background: '#EAF3DE', color: '#27500A', cursor: 'pointer' }}>Payer</button>
                  </div>
                </div>
              )}

              {resa && !commande && (
                <div style={{ fontSize: 11, color: '#BA7517' }}>
                  Réservé — {resa.nomClient}
                  <div style={{ fontSize: 10, color: '#888' }}>{new Date(resa.dateHeure).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              )}

              {t.statut === 'LIBRE' && !resa && (
                <div style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Plus size={11} /> Nouvelle commande
                </div>
              )}
            </div>
          );
        })}
        {tablesFiltrees.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#ccc', fontSize: 13 }}>Aucune table dans cette zone</div>
        )}
      </div>

      {selectedTable && menu && (
        <PanelCommande
          table={selectedTable} menu={menu}
          loading={createCmd.isPending}
          onClose={() => setSelectedTable(null)}
          onSave={data => createCmd.mutate(data)}
        />
      )}

      {paiementCommande && (
        <ModalPaiement
          commande={paiementCommande}
          loading={payerCmd.isPending}
          onClose={() => setPaiementCommande(null)}
          onPay={data => payerCmd.mutate({ id: paiementCommande.id, data })}
        />
      )}
    </div>
  );
}
