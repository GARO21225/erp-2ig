import { useQuery } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import { useState } from 'react';
import FilterBar from '../../components/ui/FilterBar';
import ExportBar from '../../components/ui/ExportBar';
import { exportPDF } from '../../lib/export';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

const TYPE_COLORS = { ESPECES: '#27500A', ORANGE_MONEY: '#E87722', MTN_MONEY: '#FFCC00', MOOV_MONEY: '#0066CC', WAVE: '#1A73E8', BANQUE: '#5F5E5A' };

export default function CaisseYakro() {
  const [filtreDates, setFiltreDates] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['caisse-yakro', filtreDates],
    queryFn: yakroAPI.caisse,
    refetchInterval: 30000,
  });

  const ca = data?.caJour || 0;
  const rein = data?.reinvestissement || {};
  const parType = data?.parType || [];

  const exportPDFCaisse = () => {
    const entetes = ['Moyen de paiement', 'Montant (FCFA)'];
    const lignes = parType.map(t => [t.type?.replace('_', ' '), (t._sum?.total || 0).toLocaleString('fr') + ' F']);
    lignes.push(['TOTAL', ca.toLocaleString('fr') + ' F']);
    exportPDF('Rapport Caisse du Jour — Yakro Grill', 'caisse_yakro', entetes, lignes, {
      sousTitre: `CA du jour : ${ca.toLocaleString('fr')} FCFA · ${data?.nbCommandes || 0} commandes`,
    });
  };

  const chartData = parType.map(t => ({
    name: t.type?.replace('_', ' ') || 'Autre',
    montant: t._sum?.total || 0,
    color: TYPE_COLORS[t.type] || '#888',
  }));

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Caisse du jour</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>Résultats financiers Yakro Grill</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <FilterBar onChange={setFiltreDates} defaultPreset="today" color="#8B1A1A" />
          <ExportBar onPDFClick={exportPDFCaisse} />
        </div>
      </div>

      {/* KPI principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="kpi" style={{ background: 'linear-gradient(135deg, #8B1A1A, #A83030)', border: 'none', color: 'white', gridColumn: '1' }}>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>CA du jour</div>
          <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 28, letterSpacing: -1 }}>{(ca / 1000).toFixed(0)}k</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>FCFA · {data?.nbCommandes || 0} commandes</div>
        </div>

        {[
          { label: '🍳 Cuisine (50%)', montant: rein.cuisine || 0, desc: 'Budget appro cuisine' },
          { label: '🥤 Boisson (45%)', montant: rein.boisson || 0, desc: 'Budget appro boisson' },
          { label: '🍺 Bar (45%)',      montant: rein.bar || 0,     desc: 'Budget appro bar' },
        ].map(k => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 18, color: '#8B1A1A' }}>{(k.montant / 1000).toFixed(0)}k F</div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>{k.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Graphe par type de paiement */}
        <div className="card">
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Ventilation par moyen de paiement</div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={32}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={v => v.toLocaleString('fr') + ' FCFA'} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="montant" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 13 }}>
              Aucun paiement enregistré
            </div>
          )}
        </div>

        {/* Règles de réinvestissement */}
        <div className="card">
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 14 }}>
            Règles de réinvestissement
          </div>
          {[
            { cat: 'Cuisine', taux: 50, montant: rein.cuisine || 0, icon: '🍳' },
            { cat: 'Boisson', taux: 45, montant: rein.boisson || 0, icon: '🥤' },
            { cat: 'Bar',     taux: 45, montant: rein.bar || 0,     icon: '🍺' },
          ].map(r => (
            <div key={r.cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '0.5px solid #f0efe9' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 18 }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.cat}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{r.taux}% du CA {r.cat.toLowerCase()} → appro</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16, color: '#8B1A1A' }}>{(r.montant / 1000).toFixed(1)}k F</div>
                <span className="badge badge-yakro">{r.taux}%</span>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 14, padding: '10px 14px', background: '#F7F7F5', borderRadius: 8, fontSize: 12, color: '#666' }}>
            Ces budgets sont calculés automatiquement à chaque paiement de commande et alimentent les budgets d'approvisionnement respectifs.
          </div>
        </div>
      </div>
    </div>
  );
}
