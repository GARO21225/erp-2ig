/**
 * TOPTELSIG — Projets Fonciers
 * Centre de pilotage par projet : accordéon + onglets complets
 * Conserve tout l'existant, enrichit l'affichage
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Plus, ChevronDown, ChevronRight, X, Upload, Download, Edit2, Trash2,
  Building2, FileText, Users, Wallet, Target, CheckCircle, AlertTriangle,
  RefreshCw, Search, Eye
} from 'lucide-react';
import TemplateButton from '../../components/ui/TemplateButton';
import DocumentViewer from '../../components/ui/DocumentViewer';
import { facturationAPI } from '../../lib/api';
import GEDPanel from '../../components/ui/GEDPanel';
import ImportButton from '../../components/ui/ImportButton';

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtF = n => { if (!n && n !== 0) return '0 F'; const abs = Math.abs(n); const s = n < 0 ? '-' : ''; if (abs >= 1000000) return `${s}${(abs/1000000).toFixed(2)}M F`; return `${s}${Math.round(abs/1000)}k F`; };
const fmtPct = n => `${n || 0}%`;

const STATUT_LOT = {
  DISPONIBLE: { color: '#27500A', bg: '#EAF3DE', label: 'Disponible' },
  RESERVE:    { color: '#BA7517', bg: '#FAEEDA', label: 'Réservé' },
  VENDU:      { color: '#A32D2D', bg: '#FCEBEB', label: 'Vendu' },
  LITIGE:     { color: '#888',    bg: '#F7F7F5', label: 'Litige' },
};
const STATUT_PHASE = {
  A_FAIRE: { color: '#888', bg: '#F7F7F5', label: 'À faire' },
  EN_COURS: { color: '#1a3f6f', bg: '#EEF3FB', label: 'En cours' },
  BLOQUE:   { color: '#A32D2D', bg: '#FCEBEB', label: 'Bloqué' },
  TERMINE:  { color: '#27500A', bg: '#EAF3DE', label: 'Terminé' },
};
const STATUT_LIV = {
  A_PRODUIRE: '#888', EN_COURS: '#1a3f6f', SOUMIS: '#BA7517',
  A_VALIDER: '#E87722', VALIDE: '#27500A', REFUSE: '#A32D2D', ARCHIVE: '#888'
};
const VILLES_CI = ['Abidjan','Yamoussoukro','Bouaké','Daloa','San-Pédro','Korhogo','Man','Gagnoa','Abengourou','Agboville','Divo','Soubré','Bondoukou','Grand-Bassam','Assinie','Bingerville','Toumodi','Sassandra'];
const LOCALISATIONS_CI = { Abidjan:['Cocody','Plateau','Adjamé','Yopougon','Abobo','Marcory','Koumassi','Port-Bouët','Treichville','Attécoubé','Bingerville','Anyama','Songon'], Yamoussoukro:['Centre-ville','Dioulakro','Habitat','N\'Gokro','Morofé','Kôkô'], Bouaké:['Air France','Commerce','Koko','Nimbo'], 'Grand-Bassam':['Centre','Quartier France','Azuretti'] };
const PIE_COLORS = ['#27500A','#BA7517','#A32D2D','#1a3f6f'];

function genCode(nom, ville) {
  const n = (nom || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'PRJ';
  const v = (ville || 'CI').slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'X');
  return `${v}-${n}-${new Date().getFullYear().toString().slice(2)}`;
}

// ── KPI Box ──────────────────────────────────────────────────────────────────
function KBox({ label, value, color = '#1a3f6f', sub }) {
  return (
    <div style={{ background: '#F7F7F5', borderRadius: 8, padding: '8px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 16, color }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: '#aaa', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ── Barre progression ────────────────────────────────────────────────────────
function Prog({ value, color = '#1a3f6f', h = 5 }) {
  return (
    <div style={{ height: h, background: '#e8e7e1', borderRadius: h }}>
      <div style={{ height: '100%', width: `${Math.min(value || 0, 100)}%`, background: color, borderRadius: h, transition: 'width 0.5s' }} />
    </div>
  );
}

// ── Onglet RÉSUMÉ ─────────────────────────────────────────────────────────────
function OngletResume({ data, projet }) {
  if (!data) return <div style={{ padding: 20, color: '#888', fontSize: 12 }}>Chargement...</div>;
  const { kpi, graphiques } = data;
  const pieData = [
    { name: 'Disponibles', value: kpi.commercial.lotsDispos },
    { name: 'Réservés',    value: kpi.commercial.lotsReserves },
    { name: 'Vendus',      value: kpi.commercial.lotsVendus },
  ].filter(d => d.value > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Infos générales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          ['Ville', projet.ville], ['Localisation', projet.localisation],
          ['Statut', projet.statut], ['Priorité', projet.priorite || 'NORMALE'],
          ['Responsable', projet.responsableNom || '—'], ['Avancement', `${projet.avancement || 0}%`],
          ['Date début', projet.dateDebut ? new Date(projet.dateDebut).toLocaleDateString('fr') : '—'],
          ['Date fin prévue', projet.dateFin ? new Date(projet.dateFin).toLocaleDateString('fr') : '—'],
          ['Superficie', `${(projet.superficie || 0).toLocaleString('fr')} m²`],
        ].map(([label, val], i) => (
          <div key={i} style={{ background: '#F7F7F5', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: '#888' }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* KPI en 4 groupes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Commercial */}
        <div style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: 14, borderTop: '3px solid #1a3f6f' }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#1a3f6f' }}>🏘 Commercial</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <KBox label="Total lots"     value={kpi.commercial.totalLots} />
            <KBox label="Disponibles"    value={kpi.commercial.lotsDispos}   color="#27500A" />
            <KBox label="Réservés"       value={kpi.commercial.lotsReserves} color="#BA7517" />
            <KBox label="Vendus"         value={kpi.commercial.lotsVendus}   color="#A32D2D" />
            <KBox label="Taux comm."     value={fmtPct(kpi.commercial.tauxComm)} color="#1a3f6f" />
          </div>
          {pieData.length > 0 && (
            <ResponsiveContainer width="100%" height={120} style={{ marginTop: 10 }}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={45} innerRadius={22} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={v => [v + ' lots', '']} />
                <Legend formatter={v => <span style={{ fontSize: 10 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Finances */}
        <div style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: 14, borderTop: '3px solid #27500A' }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#27500A' }}>💰 Finances</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'CA prévisionnel', value: fmtF(kpi.finances.caPrevu), color: '#1a3f6f' },
              { label: 'Encaissé', value: fmtF(kpi.finances.caEnc), color: '#27500A' },
              { label: 'Reste à enc.', value: fmtF(kpi.finances.resteAEncaisser), color: '#BA7517' },
              { label: 'Dépenses payées', value: fmtF(kpi.finances.depPayees), color: '#A32D2D' },
              { label: 'Résultat brut', value: fmtF(kpi.finances.resultatBrut), color: kpi.finances.resultatBrut >= 0 ? '#27500A' : '#A32D2D' },
              { label: 'Marge', value: fmtPct(kpi.finances.marge), color: kpi.finances.marge >= 0 ? '#27500A' : '#A32D2D' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#555' }}>{item.label}</span>
                <span style={{ fontFamily: 'Syne', fontWeight: 700, color: item.color }}>{item.value}</span>
              </div>
            ))}
            {kpi.finances.caPrevu > 0 && (
              <div style={{ marginTop: 4 }}>
                <Prog value={kpi.finances.caPrevu > 0 ? kpi.finances.caEnc / kpi.finances.caPrevu * 100 : 0} color="#27500A" />
                <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>
                  {kpi.finances.caPrevu > 0 ? Math.round(kpi.finances.caEnc / kpi.finances.caPrevu * 100) : 0}% du CA encaissé
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CRM */}
        <div style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: 14, borderTop: '3px solid #BA7517' }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#BA7517' }}>🎯 CRM</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <KBox label="Prospects"     value={kpi.crm.nbProspects}     color="#888" />
            <KBox label="Souscripteurs" value={kpi.crm.nbSouscripteurs} color="#1a3f6f" />
            <KBox label="Clients"       value={kpi.crm.nbClients}       color="#27500A" />
            <KBox label="Relances"      value={kpi.crm.nbRelances}      color="#BA7517" />
            <KBox label="Taux conv."    value={fmtPct(kpi.crm.tauxConv)} color="#27500A" sub={kpi.crm.tauxConv > 0 ? 'Bonne conversion' : ''} />
          </div>
        </div>

        {/* Projet */}
        <div style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: 14, borderTop: '3px solid #E87722' }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#E87722' }}>📋 Gestion Projet</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <KBox label="Phases"       value={kpi.projet.nbPhases}    color="#1a3f6f" />
            <KBox label="Activités"    value={kpi.projet.nbActivites} color="#1a3f6f" />
            <KBox label="Tâches"       value={kpi.projet.nbTaches}    color="#1a3f6f" />
            <KBox label="Livrables"    value={kpi.projet.nbLivrables} color="#888" />
            <KBox label="Validés"      value={kpi.projet.nbLivValides} color="#27500A" />
            {kpi.projet.nbLivRetard > 0 && <KBox label="En retard" value={kpi.projet.nbLivRetard} color="#A32D2D" />}
          </div>
          {kpi.retardsEch > 0 && (
            <div style={{ marginTop: 8, background: '#FCEBEB', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#A32D2D' }}>
              ⚠ {kpi.retardsEch} échéance(s) en retard
            </div>
          )}
        </div>
      </div>

      {/* Graphique encaissements mensuels */}
      {graphiques?.encMensuels?.some(m => m.montant > 0) && (
        <div style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: 14 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>📈 Encaissements mensuels</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={graphiques.encMensuels}>
              <defs><linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1a3f6f" stopOpacity={0.15}/><stop offset="95%" stopColor="#1a3f6f" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9"/>
              <XAxis dataKey="mois" tick={{ fontSize: 9 }}/>
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${Math.round(v/1000)}k`}/>
              <Tooltip formatter={v => [fmtF(v), 'Encaissements']}/>
              <Area type="monotone" dataKey="montant" name="Encaissements" fill="url(#gE)" stroke="#1a3f6f" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Onglet LOTS ───────────────────────────────────────────────────────────────
function OngletLots({ lots = [], projetId, onRefresh }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [selectedLot, setSelectedLot] = useState(null);
  const [lotEdit, setLotEdit] = useState(null);

  const deleteLotMut = useMutation({
    mutationFn: (id) => toptelsigAPI.deleteLot(id),
    onSuccess: () => {
      qc.invalidateQueries(['projet-complet', projetId]);
      onRefresh?.();
    },
    onError: e => alert('Erreur: ' + (e?.response?.data?.error || e.message)),
  });

  const filtered = lots.filter(l =>
    (!statutFilter || l.statut === statutFilter) &&
    (!search || `${l.numero} ${l.ilot || ''} ${l.vente?.souscripteur?.nom || ''} ${l.vente?.souscripteur?.telephone || ''}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" style={{ width: 180 }} placeholder="🔍 Lot, client, téléphone..." value={search} onChange={e => setSearch(e.target.value)} />
        {['', 'DISPONIBLE', 'RESERVE', 'VENDU', 'LITIGE'].map(s => (
          <button key={s} onClick={() => setStatutFilter(s)} className={`filter-btn ${statutFilter === s ? 'active' : ''}`}>
            {s || 'Tous'} {s && `(${lots.filter(l => l.statut === s).length})`}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }}
            onClick={async () => {
              try {
                const token = JSON.parse(localStorage.getItem('2ig-auth')||'{}')?.state?.token||'';
                const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
                const r = await fetch(`${base}/toptelsig/lots/template?projetId=${projetId}`,
                  { headers: { Authorization: `Bearer ${token}` } });
                const blob = await r.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href=url; a.download=`template_lots.xlsx`; a.click();
                URL.revokeObjectURL(url);
              } catch(e) { alert('Erreur téléchargement template: '+e.message); }
            }}>📥 Template lots</button>
          <label style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', background:'#1a3f6f', color:'white', borderRadius:8, fontSize:11, fontWeight:500, cursor:'pointer' }}>
            📤 Importer
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const r = await toptelsigAPI.importLots(projetId, file);
                  alert(`✅ Import terminé : ${r?.importes || r?.resultats?.importes || 0} lot(s) importé(s)`);
                } catch (err) {
                  alert('Erreur import : ' + (err?.response?.data?.error || err.message));
                }
                e.target.value = '';
              }} />
          </label>
        </div>
      </div>

      <div className="table-container">
        <table className="table-erp">
          <thead>
            <tr>
              <th>N° Lot</th><th>Îlot</th><th>Superficie</th><th>Prix</th>
              <th>Statut</th><th>Client</th><th>Téléphone</th>
              <th>Total payé</th><th>Restant</th><th>Progression</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const st = STATUT_LOT[l.statut] || STATUT_LOT.DISPONIBLE;
              const vente = l.vente;
              const totalPaye = vente?.paiements?.reduce((s, p) => s + p.montant, 0) || 0;
              const restant = vente ? vente.prixVente - totalPaye : 0;
              const pct = vente && vente.prixVente > 0 ? Math.round(totalPaye / vente.prixVente * 100) : 0;
              const retard = vente?.echeanciers?.some(e => e.statut === 'RETARD');
              return (
                <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedLot(l)}>
                  <td style={{ fontWeight: 600 }}>{l.numero}</td>
                  <td style={{ color: '#888', fontSize: 11 }}>{l.ilot || '—'}</td>
                  <td>{(l.superficie || 0).toLocaleString('fr')} m²</td>
                  <td style={{ fontWeight: 600, color: '#1a3f6f' }}>{fmtF(l.prix)}</td>
                  <td><span style={{ fontSize: 10, background: st.bg, color: st.color, borderRadius: 10, padding: '2px 8px', fontWeight: 500 }}>{st.label}</span></td>
                  <td style={{ fontSize: 12 }}>{vente?.souscripteur ? `${vente.souscripteur.prenom} ${vente.souscripteur.nom}` : '—'}</td>
                  <td style={{ fontSize: 11, color: '#888' }}>{vente?.souscripteur?.telephone || '—'}</td>
                  <td style={{ color: '#27500A', fontWeight: vente ? 600 : 400 }}>{vente ? fmtF(totalPaye) : '—'}</td>
                  <td style={{ color: restant > 0 ? '#BA7517' : '#888' }}>{vente ? fmtF(restant) : '—'}</td>
                  <td style={{ width: 80 }}>
                    {vente && (
                      <div>
                        <Prog value={pct} color={retard ? '#A32D2D' : '#1a3f6f'} />
                        <span style={{ fontSize: 9, color: retard ? '#A32D2D' : '#888' }}>{pct}%{retard ? ' ⚠' : ''}</span>
                      </div>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display:'flex', gap:3 }}>
                      <button className="btn btn-ghost btn-xs" title="Aperçu"
                        onClick={e => { e.stopPropagation(); setSelectedLot(l); }}>
                        <Eye size={11}/>
                      </button>
                      <button className="btn btn-ghost btn-xs" style={{ color:'#1a3f6f' }} title="Modifier"
                        onClick={e => { e.stopPropagation(); setLotEdit(l); }}>
                        ✏️
                      </button>
                      <button className="btn btn-ghost btn-xs" style={{ color:'#A32D2D' }} title="Supprimer"
                        onClick={e => {
                          e.stopPropagation();
                          if (window.confirm(`Supprimer le lot ${l.numero} ? Action irréversible.`))
                            deleteLotMut.mutate(l.id);
                        }}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={11}><div className="empty-state"><p>Aucun lot</p></div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Fiche lot */}
      {selectedLot && (
        <FicheLot lot={selectedLot} onClose={() => setSelectedLot(null)} />
      )}
      {/* Modal édition lot */}
      {lotEdit && (
        <ModalEditLot
          lot={lotEdit}
          onClose={() => setLotEdit(null)}
          onSave={(id, data) =>
            toptelsigAPI.updateLot(id, data)
              .then(() => { qc.invalidateQueries(['projet-complet', projetId]); setLotEdit(null); onRefresh?.(); })
              .catch(e => alert('Erreur: ' + (e?.response?.data?.error || e.message)))
          }
        />
      )}
    </div>
  );
}

// ── Modal édition lot ──────────────────────────────────────────────────────────
function ModalEditLot({ lot, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numero: lot.numero || '',
    ilot: lot.ilot || '',
    superficie: lot.superficie || '',
    prix: lot.prix || '',
    statut: lot.statut || 'DISPONIBLE',
    localisation: lot.localisation || '',
    observations: lot.observations || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(lot.id, {
        ...form,
        superficie: form.superficie !== '' ? Number(form.superficie) : undefined,
        prix: form.prix !== '' ? Number(form.prix) : undefined,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16, color:'#1a3f6f' }}>
            ✏️ Modifier — Lot {lot.numero}
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label className="label">N° Lot *</label>
            <input className="input" value={form.numero} onChange={e => set('numero', e.target.value)}/>
          </div>
          <div>
            <label className="label">Îlot</label>
            <input className="input" value={form.ilot} onChange={e => set('ilot', e.target.value)} placeholder="Ex: ILOT-A"/>
          </div>
          <div>
            <label className="label">Superficie (m²)</label>
            <input className="input" type="number" min={0} value={form.superficie} onChange={e => set('superficie', e.target.value)}/>
          </div>
          <div>
            <label className="label">Prix catalogue (FCFA)</label>
            <input className="input" type="number" min={0} value={form.prix} onChange={e => set('prix', e.target.value)}/>
          </div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={form.statut} onChange={e => set('statut', e.target.value)}>
              {['DISPONIBLE','RESERVE','VENDU','INDISPONIBLE','LITIGE'].map(s =>
                <option key={s} value={s}>{s}</option>
              )}
            </select>
          </div>
          <div>
            <label className="label">Localisation</label>
            <input className="input" value={form.localisation} onChange={e => set('localisation', e.target.value)} placeholder="Ex: Zone A"/>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label className="label">Observations</label>
            <textarea className="input" rows={2} value={form.observations}
              onChange={e => set('observations', e.target.value)}
              style={{ resize:'vertical' }} placeholder="Notes internes..."/>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20, borderTop:'0.5px solid #e8e7e1', paddingTop:14 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
            disabled={!form.numero || saving}
            onClick={handleSave}>
            {saving ? '...' : '✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fiche lot détaillée ───────────────────────────────────────────────────────
function FicheLot({ lot, onClose }) {
  const vente = lot.vente;
  const totalPaye = vente?.paiements?.reduce((s, p) => s + p.montant, 0) || 0;
  const st = STATUT_LOT[lot.statut] || STATUT_LOT.DISPONIBLE;
  const [docViewer, setDocViewer] = useState(null);
  const [genLoading, setGenLoading] = useState('');

  const genererDoc = async (type, paiementId) => {
    setGenLoading(type);
    try {
      const doc = await facturationAPI.generer(lot.id, type, paiementId);
      setDocViewer({ ...doc, client: vente?.souscripteur });
    } catch (e) {
      alert('Erreur génération : ' + (e?.error || e?.message || 'Erreur'));
    } finally { setGenLoading(''); }
  };

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>
            📍 Lot {lot.numero}{lot.ilot ? ` — Îlot ${lot.ilot}` : ''}
          </h3>
          <div style={{ display:'flex', gap:6 }}>
            <button style={{ fontSize:11, padding:'5px 10px', background:'#1a3f6f', color:'white', border:'none', borderRadius:7, cursor:'pointer' }}
              onClick={() => {
                const tel = vente?.souscripteur?.telephone?.replace(/\s/g,'') || '';
                const nom = vente?.souscripteur ? `${vente.souscripteur.prenom} ${vente.souscripteur.nom}` : '';
                const msg = encodeURIComponent(`🏘 Récapitulatif lot ${lot.numero}${lot.ilot?' (Îlot '+lot.ilot+')':''}
━━━━━━━━━━━━━━━━━
📐 Superficie : ${(lot.superficie||0).toLocaleString('fr')} m²
💰 Prix : ${fmtF(lot.prix)}
👤 Client : ${nom}
💳 Total payé : ${fmtF(totalPaye)}
📊 Restant : ${fmtF(vente?vente.prixVente-totalPaye:0)}
✅ Taux : ${vente&&vente.prixVente>0?Math.round(totalPaye/vente.prixVente*100):0}%
━━━━━━━━━━━━━━━━━
2IG — TOPTELSIG`);
                window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
              }}>
              💬 WhatsApp
            </button>
            <button style={{ fontSize:11, padding:'5px 10px', background:'#27500A', color:'white', border:'none', borderRadius:7, cursor:'pointer' }}
              onClick={() => {
                const nom = vente?.souscripteur ? `${vente.souscripteur.prenom} ${vente.souscripteur.nom}` : '';
                const sujet = encodeURIComponent(`Récapitulatif lot ${lot.numero} — TOPTELSIG 2IG`);
                const corps = encodeURIComponent(`Bonjour ${nom},

Voici le récapitulatif de votre lot :

Lot N° : ${lot.numero}
Îlot : ${lot.ilot||'—'}
Superficie : ${(lot.superficie||0).toLocaleString('fr')} m²
Prix de vente : ${fmtF(lot.prix)}

Total payé : ${fmtF(totalPaye)}
Restant : ${fmtF(vente?vente.prixVente-totalPaye:0)}
Taux de paiement : ${vente&&vente.prixVente>0?Math.round(totalPaye/vente.prixVente*100):0}%

Cordialement,
TOPTELSIG — Groupe 2IG`);
                window.open(`mailto:${vente?.souscripteur?.email||''}?subject=${sujet}&body=${corps}`);
              }}>
              📧 Email
            </button>
            <button style={{ fontSize:11, padding:'5px 10px', background:'#888', color:'white', border:'none', borderRadius:7, cursor:'pointer' }}
              onClick={() => window.print()}>
              🖨️ Imprimer
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
          </div>
        </div>

        {/* Boutons facturation */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, padding:'10px 14px', background:'#EEF3FB', borderRadius:8 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#1a3f6f', width:'100%', marginBottom:4 }}>📄 Générer un document</div>
          {[
            { type:'FACTURE', label:'🧾 Facture', color:'#1a3f6f', enabled: !!vente },
            { type:'PROFORMA', label:'📋 Proforma', color:'#BA7517', enabled: true },
            { type:'RECU', label:'🧾 Reçu paiement', color:'#27500A', enabled: !!(vente?.paiements?.length > 0) },
            { type:'SITUATION', label:'📊 Situation client', color:'#8B1A1A', enabled: !!vente },
          ].map(btn => (
            <button key={btn.type}
              disabled={!btn.enabled || genLoading === btn.type}
              onClick={() => genererDoc(btn.type)}
              style={{ fontSize:11, padding:'6px 12px', background: btn.enabled ? btn.color : '#ddd', color:'white', border:'none', borderRadius:7, cursor: btn.enabled ? 'pointer' : 'not-allowed', opacity: btn.enabled ? 1 : 0.6 }}>
              {genLoading === btn.type ? '⏳...' : btn.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Infos lot */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>Informations lot</div>
            {[['Numéro', lot.numero], ['Îlot', lot.ilot || '—'], ['Superficie', `${(lot.superficie || 0).toLocaleString('fr')} m²`], ['Prix catalogue', fmtF(lot.prix)], ['Statut', <span style={{ color: st.color, fontWeight: 600 }}>{st.label}</span>]].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f0efe9', fontSize: 12 }}>
                <span style={{ color: '#888' }}>{k}</span><span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Client */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>Client / Souscripteur</div>
            {vente?.souscripteur ? (
              <>
                {[['Nom', `${vente.souscripteur.prenom} ${vente.souscripteur.nom}`], ['Téléphone', vente.souscripteur.telephone], ['Statut', vente.souscripteur.statut], ['Commercial', vente.souscripteur.commercialNom || '—'], ['Prescripteur', vente.prescripteur ? `${vente.prescripteur.prenom} ${vente.prescripteur.nom}` : '—']].map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f0efe9', fontSize: 12 }}>
                    <span style={{ color: '#888' }}>{k}</span><span>{v}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ color: '#aaa', fontSize: 12, padding: 12, textAlign: 'center' }}>
                {lot.reservations?.length > 0 ? `Réservé par ${lot.reservations[0].souscripteur?.prenom} ${lot.reservations[0].souscripteur?.nom}` : 'Lot disponible — Aucun client'}
              </div>
            )}
          </div>
        </div>

        {/* Finances vente */}
        {vente && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>Suivi financier</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              <KBox label="Prix vente" value={fmtF(vente.prixVente)} color="#1a3f6f" />
              <KBox label="Total payé" value={fmtF(totalPaye)} color="#27500A" />
              <KBox label="Restant" value={fmtF(vente.prixVente - totalPaye)} color="#BA7517" />
              <KBox label="Taux paiement" value={vente.prixVente > 0 ? Math.round(totalPaye / vente.prixVente * 100) + '%' : '0%'} color="#1a3f6f" />
            </div>
          </div>
        )}

        {/* Échéancier */}
        {vente?.echeanciers?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>Échéancier ({vente.echeanciers.length} échéances)</div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {vente.echeanciers.map((e, i) => {
                const retard = e.statut === 'RETARD';
                const paye = e.statut === 'PAYE';
                return (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: retard ? '#FCEBEB' : paye ? '#EAF3DE' : '#F7F7F5', borderRadius: 6, marginBottom: 3, fontSize: 11 }}>
                    <span style={{ color: '#888' }}>#{i + 1} — {e.dateEcheance ? new Date(e.dateEcheance).toLocaleDateString('fr') : '—'}</span>
                    <span style={{ fontWeight: 600 }}>{fmtF(e.montant)}</span>
                    <span style={{ color: retard ? '#A32D2D' : paye ? '#27500A' : '#888', fontWeight: 500 }}>{e.statut}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GED lot */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>📁 Documents (GED)</div>
          <GEDPanel entiteType="lot" entiteId={lot.id} />
        </div>
      </div>
    </div>

    {/* Visionneuse document */}
    {docViewer && (
      <DocumentViewer
        document={docViewer}
        client={vente?.souscripteur}
        onClose={() => setDocViewer(null)}
      />
    )}
    </>
  );
}

// ── Onglet CRM ────────────────────────────────────────────────────────────────
function OngletCRM({ souscripteurs = [], kpi, projetId }) {
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const PIPELINE_COLORS = { PROSPECT:'#888', CONTACTE:'#BA7517', INTERESSE:'#1a3f6f', NEGOCIE:'#E87722', CLIENT:'#27500A', PERDU:'#A32D2D' };

  const filtered = souscripteurs.filter(s =>
    (!statutFilter || s.statut === statutFilter) &&
    (!search || `${s.prenom} ${s.nom} ${s.telephone}`.toLowerCase().includes(search.toLowerCase()))
  );

  const statsParStatut = Object.keys(PIPELINE_COLORS).reduce((acc, s) => {
    acc[s] = souscripteurs.filter(x => x.statut === s).length;
    return acc;
  }, {});

  return (
    <div>
      {/* Entonnoir visuel */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {Object.entries(PIPELINE_COLORS).map(([s, color]) => {
          const count = statsParStatut[s] || 0;
          return (
            <div key={s} style={{ background: color + '15', border: `1px solid ${color}30`, borderRadius: 8, padding: '8px 12px', textAlign: 'center', minWidth: 80, flex: 1, cursor: 'pointer',
              outline: statutFilter === s ? `2px solid ${color}` : 'none' }}
              onClick={() => setStatutFilter(statutFilter === s ? '' : s)}>
              <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, color }}>{count}</div>
              <div style={{ fontSize: 9, color: '#888', marginTop: 1 }}>{s}</div>
            </div>
          );
        })}
      </div>

      {/* Filtres + recherche */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input className="input" style={{ flex: 1 }} placeholder="🔍 Nom, téléphone..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tableau liste complète */}
      <div className="table-container">
        <table className="table-erp">
          <thead>
            <tr>
              <th>Nom</th><th>Téléphone</th><th>Email</th><th>Statut</th>
              <th>Commercial</th><th>Source</th><th>Relances</th><th>Dernière interaction</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.prenom} {s.nom}</td>
                <td style={{ fontSize: 11 }}>{s.telephone}</td>
                <td style={{ fontSize: 11, color: '#888' }}>{s.email || '—'}</td>
                <td>
                  <span style={{ fontSize: 10, background: (PIPELINE_COLORS[s.statut] || '#888') + '18', color: PIPELINE_COLORS[s.statut] || '#888', borderRadius: 10, padding: '2px 8px', fontWeight: 500 }}>
                    {s.statut}
                  </span>
                </td>
                <td style={{ fontSize: 11 }}>{s.commercialNom || '—'}</td>
                <td style={{ fontSize: 11, color: '#888' }}>{s.sourceAcquisition || '—'}</td>
                <td style={{ textAlign: 'center', fontWeight: 600, color: '#1a3f6f' }}>{s.relances?.length || 0}</td>
                <td style={{ fontSize: 11, color: '#888' }}>
                  {s.relances?.[0] ? new Date(s.relances[0].dateRelance).toLocaleDateString('fr') : '—'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8}><div className="empty-state"><p>Aucun contact pour ce projet</p></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>{filtered.length} contact(s) affiché(s) sur {souscripteurs.length}</div>
    </div>
  );
}

// ── Onglet FINANCES ───────────────────────────────────────────────────────────
function OngletFinances({ data }) {
  if (!data) return null;
  const { kpi, graphiques, depenses } = data;
  const f = kpi.finances;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI finances */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {[
          { label: 'CA prévisionnel', value: fmtF(f.caPrevu), color: '#1a3f6f' },
          { label: 'CA encaissé', value: fmtF(f.caEnc), color: '#27500A' },
          { label: 'Reste à enc.', value: fmtF(f.resteAEncaisser), color: '#BA7517' },
          { label: 'Dépenses payées', value: fmtF(f.depPayees), color: '#A32D2D' },
          { label: 'Marge nette', value: fmtF(f.resultatBrut), color: f.resultatBrut >= 0 ? '#27500A' : '#A32D2D' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: '12px 14px', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Encaissements mensuels */}
        <div style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: 14 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📈 Encaissements mensuels</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={graphiques?.encMensuels || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9" />
              <XAxis dataKey="mois" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${Math.round(v/1000)}k`} />
              <Tooltip formatter={v => [fmtF(v), '']} />
              <Bar dataKey="montant" fill="#1a3f6f" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Modes de paiement */}
        <div style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: 14 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>💳 Modes de paiement</div>
          {graphiques?.paiementsParMode?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {graphiques.paiementsParMode.map((p, i) => {
                const total = graphiques.paiementsParMode.reduce((s, x) => s + x.montant, 0);
                const pct = total > 0 ? Math.round(p.montant / total * 100) : 0;
                const colors = ['#E87722','#27500A','#FFCC00','#1a3f6f','#00B9F1','#5F5E5A'];
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                      <span>{p.mode} ({p.nb} transactions)</span>
                      <span style={{ fontWeight: 600 }}>{fmtF(p.montant)} — {pct}%</span>
                    </div>
                    <Prog value={pct} color={colors[i % colors.length]} h={4} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#ccc', fontSize: 12, textAlign: 'center', padding: 20 }}>Aucune transaction</div>
          )}
        </div>
      </div>

      {/* Dépenses par phase */}
      {graphiques?.depParPhase?.length > 0 && (
        <div style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: 14 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📊 Dépenses par phase</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={graphiques.depParPhase} layout="vertical" barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${Math.round(v/1000)}k`} />
              <YAxis dataKey="phase" type="category" tick={{ fontSize: 9 }} width={130} />
              <Tooltip formatter={v => [fmtF(v), '']} />
              <Bar dataKey="montant" name="Réalisé" fill="#A32D2D" radius={[0, 3, 3, 0]} />
              <Bar dataKey="budget" name="Budget" fill="#1a3f6f" radius={[0, 3, 3, 0]} opacity={0.3} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Onglet GESTION PROJET ─────────────────────────────────────────────────────
function OngletGestionProjet({ phases = [], projetId, onRefresh }) {
  const qc = useQueryClient();
  const [openPhases, setOpenPhases] = useState({});
  const updatePhase = useMutation({
    mutationFn: ({ id, data }) => toptelsigAPI.updatePhase(id, data),
    onSuccess: () => { qc.invalidateQueries(['projet-complet', projetId]); onRefresh?.(); }
  });
  const seedPhases = useMutation({
    mutationFn: () => toptelsigAPI.seedPhasesProjet(projetId),
    onSuccess: (r) => { qc.invalidateQueries(['projet-complet', projetId]); onRefresh?.(); alert(`✅ ${r.message || 'Phases créées'}`); }
  });

  const togglePhase = id => setOpenPhases(p => ({ ...p, [id]: !p[id] }));

  if (phases.length === 0) {
    return (
      <div className="empty-state">
        <Target size={40} />
        <p>Aucune phase définie</p>
        <button className="btn btn-primary btn-sm" style={{ background: '#1a3f6f', border: 'none', marginTop: 8 }}
          disabled={seedPhases.isPending}
          onClick={() => seedPhases.mutate()}>
          {seedPhases.isPending ? 'Création...' : '⚡ Créer les 15 phases standard'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#888' }}>{phases.length} phase(s) · {phases.filter(p => p.statut === 'TERMINE').length} terminée(s)</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ fontSize: 10, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
            Avancement global :
            <span style={{ fontFamily: 'Syne', fontWeight: 700, color: '#1a3f6f' }}>
              {phases.length > 0 ? Math.round(phases.reduce((s, p) => s + p.avancement, 0) / phases.length) : 0}%
            </span>
          </div>
        </div>
      </div>

      {phases.map((phase, pi) => {
        const st = STATUT_PHASE[phase.statut] || STATUT_PHASE.A_FAIRE;
        const isOpen = openPhases[phase.id] !== false;
        const nbLivObl = phase.livrables?.filter(l => l.obligatoire && l.statut !== 'VALIDE').length || 0;

        return (
          <div key={phase.id} style={{ marginBottom: 8, border: `1.5px solid ${st.color}25`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ background: st.bg, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}
              onClick={() => togglePhase(phase.id)}>
              {isOpen ? <ChevronDown size={14} color={st.color} /> : <ChevronRight size={14} color={st.color} />}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: st.color }}>{pi + 1}. {phase.nom}</span>
                  <span style={{ fontSize: 10, background: st.color + '20', color: st.color, borderRadius: 10, padding: '1px 7px' }}>{st.label}</span>
                  {nbLivObl > 0 && <span style={{ fontSize: 10, background: '#FCEBEB', color: '#A32D2D', borderRadius: 10, padding: '1px 7px' }}>⚠ {nbLivObl} livrable(s) requis</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 3, fontSize: 10, color: '#888' }}>
                  <span>{phase.activites?.length || 0} activité(s)</span>
                  <span>{phase.livrables?.filter(l => l.statut === 'VALIDE').length || 0}/{phase.livrables?.length || 0} livrables validés</span>
                  {phase.responsableNom && <span>👤 {phase.responsableNom}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                <div style={{ width: 60 }}>
                  <div style={{ fontSize: 9, textAlign: 'right', color: '#888', marginBottom: 1 }}>{phase.avancement}%</div>
                  <Prog value={phase.avancement} color={st.color} />
                </div>
                <select style={{ fontSize: 10, padding: '2px 5px', borderRadius: 5, border: '0.5px solid #ddd', background: 'white', cursor: 'pointer' }}
                  value={phase.statut}
                  onChange={e => updatePhase.mutate({ id: phase.id, data: { statut: e.target.value } })}>
                  {Object.entries(STATUT_PHASE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: '10px 14px' }}>
                {/* Livrables */}
                {phase.livrables?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#888', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase' }}>Livrables</div>
                    {phase.livrables.map(l => (
                      <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 8px', background: '#F7F7F5', borderRadius: 6, marginBottom: 3 }}>
                        <FileText size={12} color={STATUT_LIV[l.statut] || '#888'} />
                        <span style={{ flex: 1, fontSize: 11 }}>{l.nom}</span>
                        {l.obligatoire && <span style={{ fontSize: 9, background: '#FCEBEB', color: '#A32D2D', borderRadius: 4, padding: '1px 5px' }}>Obligatoire</span>}
                        <span style={{ fontSize: 10, color: STATUT_LIV[l.statut] || '#888', fontWeight: 500 }}>{l.statut}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Activités */}
                {phase.activites?.map((act, ai) => (
                  <div key={act.id} style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 7, padding: '8px 10px', marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, fontSize: 12 }}>{pi + 1}.{ai + 1} {act.nom}</span>
                      <span style={{ fontSize: 10, color: '#888' }}>{act.taches?.length || 0} tâche(s)</span>
                    </div>
                    {act.taches?.map(t => (
                      <div key={t.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 0', fontSize: 11, borderTop: '0.5px solid #f7f7f5' }}>
                        <span style={{ color: t.termine ? '#27500A' : '#888' }}>{t.termine ? '✓' : '○'}</span>
                        <span style={{ flex: 1, textDecoration: t.termine ? 'line-through' : undefined, color: t.termine ? '#aaa' : undefined }}>{t.nom}</span>
                        {t.dateEcheance && <span style={{ fontSize: 10, color: !t.termine && new Date(t.dateEcheance) < new Date() ? '#A32D2D' : '#888' }}>
                          {new Date(t.dateEcheance).toLocaleDateString('fr')}
                        </span>}
                        <span style={{ fontSize: 9, background: t.priorite === 'HAUTE' ? '#FCEBEB' : '#F7F7F5', color: t.priorite === 'HAUTE' ? '#A32D2D' : '#888', borderRadius: 4, padding: '1px 5px' }}>{t.priorite}</span>
                      </div>
                    ))}
                  </div>
                ))}

                {phase.activites?.length === 0 && phase.livrables?.length === 0 && (
                  <div style={{ color: '#ccc', fontSize: 11, textAlign: 'center', padding: '10px 0' }}>Phase sans activité ni livrable</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Onglet LIVRABLES ──────────────────────────────────────────────────────────
function OngletLivrables({ phases = [], projetId }) {
  const qc = useQueryClient();
  const allLivrables = phases.flatMap(ph => (ph.livrables || []).map(l => ({ ...l, phaseNom: ph.nom })));
  const updateLivrable = useMutation({
    mutationFn: ({ id, data }) => toptelsigAPI.updateLivrable(id, data),
    onSuccess: () => qc.invalidateQueries(['projet-complet', projetId])
  });

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
        {['A_PRODUIRE','EN_COURS','SOUMIS','VALIDE'].map(s => (
          <div key={s} style={{ background: (STATUT_LIV[s] || '#888') + '15', border: `1px solid ${STATUT_LIV[s] || '#888'}30`, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 22, color: STATUT_LIV[s] || '#888' }}>{allLivrables.filter(l => l.statut === s).length}</div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{s.replace('_', ' ')}</div>
          </div>
        ))}
      </div>
      <div className="table-container">
        <table className="table-erp">
          <thead><tr><th>Livrable</th><th>Phase</th><th>Type</th><th>Responsable</th><th>Date prévue</th><th>Obligatoire</th><th>Statut</th></tr></thead>
          <tbody>
            {allLivrables.map(l => (
              <tr key={l.id}>
                <td style={{ fontWeight: 500, fontSize: 12 }}>{l.nom}</td>
                <td style={{ fontSize: 11, color: '#888' }}>{l.phaseNom}</td>
                <td style={{ fontSize: 10 }}>{l.typeLivrable}</td>
                <td style={{ fontSize: 11 }}>{l.responsableNom || '—'}</td>
                <td style={{ fontSize: 11, color: l.datePrevue && new Date(l.datePrevue) < new Date() && l.statut !== 'VALIDE' ? '#A32D2D' : '#888' }}>
                  {l.datePrevue ? new Date(l.datePrevue).toLocaleDateString('fr') : '—'}
                </td>
                <td style={{ textAlign: 'center' }}>{l.obligatoire ? <span style={{ color: '#A32D2D' }}>✓</span> : '—'}</td>
                <td>
                  <select style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, border: `1px solid ${STATUT_LIV[l.statut] || '#888'}40`, background: (STATUT_LIV[l.statut] || '#888') + '10', color: STATUT_LIV[l.statut] || '#888', cursor: 'pointer' }}
                    value={l.statut} onChange={e => updateLivrable.mutate({ id: l.id, data: { statut: e.target.value } })}>
                    {Object.keys(STATUT_LIV).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {allLivrables.length === 0 && <tr><td colSpan={7}><div className="empty-state"><p>Aucun livrable défini</p></div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Onglet GED ────────────────────────────────────────────────────────────────
function OngletGED({ projetId }) {
  return (
    <div>
      <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📁 Documents du projet</div>
      <GEDPanel entiteType="projet" entiteId={projetId} />
    </div>
  );
}

// ── CARD PROJET ACCORDÉON ─────────────────────────────────────────────────────
function CarteProjet({ projet, isOpen, onToggle, onEdit }) {
  const qc = useQueryClient();
  const [onglet, setOnglet] = useState('resume');
  const ONGLETS = [
    { key: 'resume', label: '📋 Résumé' },
    { key: 'lots', label: '🏘 Lots' },
    { key: 'crm', label: '🎯 CRM' },
    { key: 'finances', label: '💰 Finances' },
    { key: 'gestion', label: '📊 Gestion Projet' },
    { key: 'livrables', label: '📎 Livrables' },
    { key: 'ged', label: '📁 GED' },
  ];

  const { data: detail, isLoading, error: detailError, refetch } = useQuery({
    queryKey: ['projet-complet', projet.id],
    queryFn: () => toptelsigAPI.projetComplet(projet.id),
    enabled: isOpen,
    staleTime: 30000,
    retry: 1,
  });

  const updateStatut = useMutation({
    mutationFn: ({ statut }) => toptelsigAPI.updateProjet(projet.id, { statut }),
    onSuccess: () => qc.invalidateQueries(['projets']),
  });

  const STATUT_COLORS = { EN_COURS: '#1a3f6f', PLANIFIE: '#E87722', SUSPENDU: '#A32D2D', TERMINE: '#27500A', ARCHIVE: '#888' };
  const sc = STATUT_COLORS[projet.statut] || '#888';

  return (
    <div style={{ border: `1.5px solid ${isOpen ? sc : '#e8e7e1'}`, borderRadius: 12, overflow: 'hidden', marginBottom: 8, transition: 'border-color 0.2s' }}>
      {/* Header projet */}
      <div style={{ background: isOpen ? sc + '10' : 'white', padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}
        onClick={onToggle}>
        {isOpen ? <ChevronDown size={18} color={sc} /> : <ChevronRight size={18} color="#888" />}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 16 }}>{projet.nom}</span>
            <span style={{ fontSize: 11, background: sc + '18', color: sc, borderRadius: 10, padding: '2px 8px', fontWeight: 500 }}>{projet.statut}</span>
            {projet.priorite === 'HAUTE' && <span style={{ fontSize: 10, background: '#FCEBEB', color: '#A32D2D', borderRadius: 6, padding: '1px 6px' }}>🔴 HAUTE</span>}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 3, display: 'flex', gap: 12 }}>
            <span>📍 {projet.localisation}, {projet.ville}</span>
            <span>🏘 {projet._count?.lots || 0} lot(s)</span>
            {projet.statsLots?.VENDU > 0 && <span style={{ color: '#A32D2D' }}>Vendus: {projet.statsLots.VENDU}</span>}
            {projet.statsLots?.DISPONIBLE > 0 && <span style={{ color: '#27500A' }}>Dispos: {projet.statsLots.DISPONIBLE}</span>}
            {projet.responsableNom && <span>👤 {projet.responsableNom}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>Avancement</div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: sc }}>{projet.avancement || 0}%</div>
          </div>
          <div style={{ width: 60 }}><Prog value={projet.avancement || 0} color={sc} /></div>
          <select style={{ fontSize: 10, padding: '3px 6px', borderRadius: 6, border: '0.5px solid #ddd', cursor: 'pointer' }}
            value={projet.statut}
            onChange={e => updateStatut.mutate({ statut: e.target.value })}>
            {['EN_COURS','PLANIFIE','SUSPENDU','TERMINE','ARCHIVE'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-ghost btn-xs" onClick={() => onEdit(projet)}><Edit2 size={12} /></button>
        </div>
      </div>

      {/* Contenu accordéon */}
      {isOpen && (
        <div style={{ padding: '0 18px 16px' }}>
          {/* Onglets */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e8e7e1', marginBottom: 16, flexWrap: 'wrap' }}>
            {ONGLETS.map(o => (
              <button key={o.key} onClick={() => setOnglet(o.key)}
                style={{ padding: '7px 12px', border: 'none', background: 'none', borderBottom: onglet === o.key ? '2px solid #1a3f6f' : '2px solid transparent', color: onglet === o.key ? '#1a3f6f' : '#888', fontSize: 12, fontWeight: onglet === o.key ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {o.label}
              </button>
            ))}
            {isLoading && <span style={{ fontSize: 11, color: '#888', alignSelf: 'center', marginLeft: 8 }}>Chargement...</span>}
          </div>

          {/* Contenu onglet */}
          {detailError && (
            <div style={{ padding:16, background:'#FCEBEB', borderRadius:8, color:'#A32D2D', fontSize:12 }}>
              ⚠ Erreur chargement : {detailError?.message || detailError?.error || 'Erreur serveur'}
              <button className="btn btn-ghost btn-xs" style={{ marginLeft:8 }} onClick={refetch}>Réessayer</button>
            </div>
          )}
          {onglet === 'resume'    && <OngletResume    data={detail} projet={projet} />}
          {onglet === 'lots'     && <OngletLots      lots={detail?.lots}           projetId={projet.id} onRefresh={refetch} />}
          {onglet === 'crm'      && <OngletCRM       souscripteurs={detail?.souscripteurs} kpi={detail?.kpi} />}
          {onglet === 'finances' && <OngletFinances   data={detail} />}
          {onglet === 'gestion'  && <OngletGestionProjet phases={detail?.phases} projetId={projet.id} onRefresh={refetch} />}
          {onglet === 'livrables'&& <OngletLivrables  phases={detail?.phases} projetId={projet.id} />}
          {onglet === 'ged'      && <OngletGED        projetId={projet.id} />}
        </div>
      )}
    </div>
  );
}

// ── Modal Nouveau/Modifier Projet ─────────────────────────────────────────────
function ModalProjet({ projet, onClose, onSave, loading }) {
  const isEdit = !!projet;
  const [form, setForm] = useState({
    code: projet?.code || '',
    nom: projet?.nom || '',
    localisation: projet?.localisation || '',
    ville: projet?.ville || 'Abidjan',
    superficie: projet?.superficie || '',
    nombreLots: projet?.nombreLots || '',
    prixLotMin: projet?.prixLotMin || '',
    prixLotMax: projet?.prixLotMax || '',
    statut: projet?.statut || 'EN_COURS',
    priorite: projet?.priorite || 'NORMALE',
    responsableNom: projet?.responsableNom || '',
    budgetTotal: projet?.budgetTotal || '',
    description: projet?.description || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const localisations = LOCALISATIONS_CI[form.ville] || [];

  const handleVilleChange = (v) => { set('ville', v); set('localisation', ''); if (!isEdit && !form.code) set('code', genCode(form.nom, v)); };
  const handleNomChange = (v) => { set('nom', v); if (!isEdit && !form.code) set('code', genCode(v, form.ville)); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>{isEdit ? `Modifier ${projet.nom}` : 'Nouveau projet foncier'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div className="form-grid">
          <div><label className="label">Code *</label><input className="input" value={form.code} onChange={e => set('code', e.target.value)} /></div>
          <div><label className="label">Nom *</label><input className="input" value={form.nom} onChange={e => handleNomChange(e.target.value)} /></div>
          <div>
            <label className="label">Ville *</label>
            <select className="input" value={form.ville} onChange={e => handleVilleChange(e.target.value)}>
              {VILLES_CI.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Localisation</label>
            <input className="input" list={`loc-${form.ville}`} value={form.localisation} onChange={e => set('localisation', e.target.value)} placeholder="Saisir ou choisir..." />
            <datalist id={`loc-${form.ville}`}>{localisations.map(l => <option key={l} value={l} />)}</datalist>
          </div>
          <div><label className="label">Superficie (m²)</label><input className="input" type="number" value={form.superficie} onChange={e => set('superficie', e.target.value)} /></div>
          <div><label className="label">Nombre de lots</label><input className="input" type="number" value={form.nombreLots} onChange={e => set('nombreLots', e.target.value)} /></div>
          <div><label className="label">Prix lot min (FCFA)</label><input className="input" type="number" value={form.prixLotMin} onChange={e => set('prixLotMin', e.target.value)} /></div>
          <div><label className="label">Prix lot max (FCFA)</label><input className="input" type="number" value={form.prixLotMax} onChange={e => set('prixLotMax', e.target.value)} /></div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={form.statut} onChange={e => set('statut', e.target.value)}>
              {['EN_COURS','PLANIFIE','SUSPENDU','TERMINE','ARCHIVE'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Priorité</label>
            <select className="input" value={form.priorite} onChange={e => set('priorite', e.target.value)}>
              {['HAUTE','NORMALE','BASSE'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="full"><label className="label">Responsable</label><input className="input" value={form.responsableNom} onChange={e => set('responsableNom', e.target.value)} /></div>
          <div className="full"><label className="label">Budget total (FCFA)</label><input className="input" type="number" value={form.budgetTotal} onChange={e => set('budgetTotal', e.target.value)} /></div>
          <div className="full"><label className="label">Description</label><textarea className="input" rows={2} style={{ resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!form.code || !form.nom || loading} style={{ background: '#1a3f6f', border: 'none' }}
            onClick={() => onSave({
              ...form,
              superficie: form.superficie ? Number(form.superficie) : undefined,
              nombreLots: form.nombreLots ? Number(form.nombreLots) : undefined,
              prixLotMin: form.prixLotMin ? Number(form.prixLotMin) : undefined,
              prixLotMax: form.prixLotMax ? Number(form.prixLotMax) : undefined,
              budgetTotal: form.budgetTotal ? Number(form.budgetTotal) : undefined,
            })}>
            {loading ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────────────────
export default function ProjetsPage() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editProjet, setEditProjet] = useState(null);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [toast, setToast] = useState(null);
  const showToast = (msg, t = 'success') => { setToast({ msg, t }); setTimeout(() => setToast(null), 3000); };

  const { data: projets = [], isLoading } = useQuery({
    queryKey: ['projets'],
    queryFn: toptelsigAPI.projets,
    staleTime: 30000,
  });

  const createMut = useMutation({
    mutationFn: toptelsigAPI.createProjet,
    onSuccess: () => { qc.invalidateQueries(['projets']); setShowCreate(false); showToast('Projet créé ✓'); },
    onError: e => showToast(e?.error || 'Erreur', 'error'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => toptelsigAPI.updateProjet(id, data),
    onSuccess: () => { qc.invalidateQueries(['projets']); setEditProjet(null); showToast('Projet modifié ✓'); },
  });
  const seedAll = useMutation({
    mutationFn: toptelsigAPI.seedPhasesAll,
    onSuccess: r => { qc.invalidateQueries(['projets']); showToast(`${r.total} phases créées pour ${r.results?.length} projet(s)`); },
  });

  const filteredProjets = projets.filter(p =>
    (!search || p.nom.toLowerCase().includes(search.toLowerCase()) || p.ville.toLowerCase().includes(search.toLowerCase())) &&
    (!statutFilter || p.statut === statutFilter)
  );

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Syne', fontWeight: 800, fontSize: 22, color: '#1a3f6f' }}>
            📍 Projets Fonciers
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
            {projets.length} projet(s) · Centre de pilotage complet par projet
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" disabled={seedAll.isPending} onClick={() => seedAll.mutate()} title="Créer les 15 phases standard pour tous les projets">
            {seedAll.isPending ? '⏳' : '⚡'} Init. phases
          </button>
          <button className="btn btn-primary btn-sm" style={{ background: '#1a3f6f', border: 'none' }} onClick={() => setShowCreate(true)}>
            <Plus size={13} /> Nouveau projet
          </button>
        </div>
      </div>

      {/* KPI globaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Projets actifs', value: projets.filter(p => p.statut === 'EN_COURS').length, color: '#1a3f6f' },
          { label: 'Total lots', value: projets.reduce((s, p) => s + (p._count?.lots || 0), 0), color: '#1a3f6f' },
          { label: 'Lots disponibles', value: projets.reduce((s, p) => s + (p.statsLots?.DISPONIBLE || 0), 0), color: '#27500A' },
          { label: 'Lots vendus', value: projets.reduce((s, p) => s + (p.statsLots?.VENDU || 0), 0), color: '#A32D2D' },
          { label: 'Villes couvertes', value: [...new Set(projets.map(p => p.ville))].length, color: '#888' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'white', border: `0.5px solid #e8e7e1`, borderRadius: 10, padding: '10px 14px', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 22, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
          <input className="input" style={{ paddingLeft: 30, width: 200 }} placeholder="Rechercher un projet..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['', 'EN_COURS', 'PLANIFIE', 'SUSPENDU', 'TERMINE'].map(s => (
          <button key={s} onClick={() => setStatutFilter(s)} className={`filter-btn ${statutFilter === s ? 'active' : ''}`}>
            {s || 'Tous'} {s ? `(${projets.filter(p => p.statut === s).length})` : `(${projets.length})`}
          </button>
        ))}
      </div>

      {/* Liste projets accordéon */}
      {isLoading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Chargement...</div>}
      {filteredProjets.map(p => (
        <CarteProjet
          key={p.id}
          projet={p}
          isOpen={openId === p.id}
          onToggle={() => setOpenId(openId === p.id ? null : p.id)}
          onEdit={setEditProjet}
        />
      ))}
      {!isLoading && filteredProjets.length === 0 && (
        <div className="empty-state"><Building2 size={40} /><p>Aucun projet foncier</p></div>
      )}

      {/* Modals */}
      {showCreate && (
        <ModalProjet onClose={() => setShowCreate(false)} onSave={d => createMut.mutate(d)} loading={createMut.isPending} />
      )}
      {editProjet && (
        <ModalProjet projet={editProjet} onClose={() => setEditProjet(null)} onSave={d => updateMut.mutate({ id: editProjet.id, data: d })} loading={updateMut.isPending} />
      )}

      {toast && <div style={{ position: 'fixed', bottom: 20, right: 16, background: toast.t === 'error' ? '#A32D2D' : '#27500A', color: 'white', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 9999 }}>{toast.msg}</div>}
    </div>
  );
}
