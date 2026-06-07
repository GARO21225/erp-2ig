import { useQuery } from '@tanstack/react-query';
import { dashboardAPI, alertesAPI } from '../../lib/api';
import { TrendingUp, TrendingDown, Minus, Flame, MapPin, Truck, Users, AlertTriangle, Activity, Bell, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

const fmtM = (n) => {
  if (!n) return '0';
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n/1000)}k`;
  return Math.round(n).toLocaleString();
};

function KpiCard({ label, value, unit, delta, deltaType, icon: Icon, color }) {
  const DeltaIcon = deltaType === 'up' ? TrendingUp : deltaType === 'down' ? TrendingDown : Minus;
  const deltaColor = deltaType === 'up' ? '#3B6D11' : deltaType === 'down' ? '#A32D2D' : '#888';
  return (
    <div className="kpi">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value">{value}<span style={{ fontSize: 13, fontWeight: 400, color: '#888', marginLeft: 3 }}>{unit}</span></div>
          {delta && <div className="kpi-delta" style={{ color: deltaColor, display: 'flex', alignItems: 'center', gap: 3 }}><DeltaIcon size={11} />{delta}</div>}
        </div>
        {Icon && (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} style={{ color }} />
          </div>
        )}
      </div>
    </div>
  );
}

function FilialeCard({ title, icon: Icon, color, bgColor, metrics, badge }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} style={{ color }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>{title}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{badge}</div>
          </div>
        </div>
        <div className="dot dot-green dot-pulse" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ background: '#F7F7F5', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: m.alert ? '#A32D2D' : '#1a1a1a' }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 9, color: '#aaa', marginTop: 1 }}>{m.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

const FILIALE_COLOR = { YAKRO_GRILL: '#8B1A1A', TOPTELSIG: '#1a3f6f', LIYA: '#E85D04', GROUPE: '#888' };
const ALERTE_COLOR = { CRITIQUE: '#A32D2D', ATTENTION: '#BA7517' };
const ALERTE_BG = { CRITIQUE: '#FCEBEB', ATTENTION: '#FAEEDA' };

export default function DashboardGroupe() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-groupe'],
    queryFn: dashboardAPI.groupe,
    refetchInterval: 60000,
  });

  const { data: scoresSante } = useQuery({
    queryKey: ['score-sante'],
    queryFn: dashboardAPI.scoreSante,
    refetchInterval: 300000,
  });

  const { data: alertesData } = useQuery({
    queryKey: ['alertes'],
    queryFn: alertesAPI.critiques,
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <div style={{ textAlign: 'center', color: '#888' }}>
          <Activity size={32} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 13 }}>Chargement du Centre de Commandement...</div>
        </div>
      </div>
    );
  }

  const yakro = data?.yakro || {};
  const toptelsig = data?.toptelsig || {};
  const liya = data?.liya || {};
  const timeline = data?.timeline || [];
  const alertes = alertesData?.alertes || [];
  const nbCritiques = alertesData?.critiques || 0;

  // Score santé — utiliser données réelles si disponibles
  const scoreMoyen = scoresSante
    ? Math.round(Object.values(scoresSante).reduce((s, v) => s + (v.score || 0), 0) / Math.max(Object.keys(scoresSante).length, 1))
    : null;
  const scoreColor = scoreMoyen ? (scoreMoyen >= 80 ? '#27500A' : scoreMoyen >= 60 ? '#BA7517' : '#A32D2D') : '#888';

  // Données graphe CA — réelles depuis encaissements si disponibles, sinon mock indicatif
  const encParFiliale = data?.finance?.encaissements || [];
  const caGroupeParFiliale = {
    YAKRO_GRILL: encParFiliale.find(e => e.filiale === 'YAKRO_GRILL')?._sum?.montant || 0,
    TOPTELSIG: encParFiliale.find(e => e.filiale === 'TOPTELSIG')?._sum?.montant || 0,
    LIYA: encParFiliale.find(e => e.filiale === 'LIYA')?._sum?.montant || 0,
  };

  const caTotalGroupe = Object.values(caGroupeParFiliale).reduce((s, v) => s + v, 0);

  const barData = [
    { name: 'Yakro Grill', value: caGroupeParFiliale.YAKRO_GRILL / 1000, fill: '#8B1A1A' },
    { name: 'TOPTELSIG', value: caGroupeParFiliale.TOPTELSIG / 1000, fill: '#1a3f6f' },
    { name: 'LiYA', value: caGroupeParFiliale.LIYA / 1000, fill: '#E85D04' },
  ];

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontFamily: 'Syne', fontWeight: 800, letterSpacing: -0.5 }}>Centre de Commandement DG</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Vision temps réel — Groupe 2iG · 3 filiales actives</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Alertes */}
          {alertes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: nbCritiques > 0 ? '#FCEBEB' : '#FAEEDA', borderRadius: 10, padding: '8px 14px', border: `1px solid ${nbCritiques > 0 ? '#F7C1C1' : '#FAC775'}` }}>
              <AlertTriangle size={15} color={nbCritiques > 0 ? '#A32D2D' : '#BA7517'} />
              <span style={{ fontSize: 13, fontWeight: 600, color: nbCritiques > 0 ? '#A32D2D' : '#BA7517' }}>
                {nbCritiques > 0 ? `${nbCritiques} critique(s)` : `${alertes.length} alerte(s)`}
              </span>
            </div>
          )}
          {/* Score santé */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: '10px 16px' }}>
            <div className="dot dot-green dot-pulse" />
            <div>
              <div style={{ fontSize: 10, color: '#888' }}>Score Santé Groupe</div>
              <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 22, color: scoreColor, lineHeight: 1 }}>
                {scoreMoyen ?? '—'}<span style={{ fontSize: 12, fontWeight: 400, color: '#888' }}>/100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertes critiques */}
      {alertes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {alertes.slice(0, 4).map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: ALERTE_BG[a.gravite], borderRadius: 8, padding: '6px 12px', border: `0.5px solid ${ALERTE_COLOR[a.gravite]}30` }}>
                <AlertTriangle size={12} color={ALERTE_COLOR[a.gravite]} />
                <span style={{ fontSize: 11, color: ALERTE_COLOR[a.gravite], fontWeight: 500 }}>{a.message}</span>
                {a.detail && <span style={{ fontSize: 10, color: '#888' }}>{a.detail}</span>}
              </div>
            ))}
            {alertes.length > 4 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', fontSize: 11, color: '#888' }}>
                +{alertes.length - 4} autres alertes
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI Groupe */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KpiCard label="CA Groupe (mois)" value={fmtM(caTotalGroupe)} unit="FCFA" delta={caTotalGroupe > 0 ? 'Données réelles' : 'En attente données'} deltaType="neutral" icon={TrendingUp} color="#1a3f6f" />
        <KpiCard label="Trésorerie Nette" value={fmtM(data?.finance?.encaissements?.reduce((s, e) => s + (e._sum?.montant || 0), 0) || 0)} unit="FCFA" delta="Encaissements mois" deltaType="neutral" icon={Activity} color="#639922" />
        <KpiCard label="Employés Actifs" value={data?.employes?.reduce((s, e) => s + (e._count?.id || 0), 0) ?? '—'} unit="pers." delta="Toutes filiales" deltaType="neutral" icon={Users} color="#888" />
        <KpiCard label="Retards paiement" value={toptelsig.retards ?? '—'} unit="dossiers" delta={toptelsig.retards > 0 ? '⚠ À traiter' : 'Aucun retard'} deltaType={toptelsig.retards > 0 ? 'down' : 'neutral'} icon={AlertTriangle} color="#A32D2D" />
      </div>

      {/* Scores Santé par filiale */}
      {scoresSante && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[['YAKRO_GRILL', 'Yakro Grill', '#8B1A1A'], ['TOPTELSIG', 'TOPTELSIG', '#1a3f6f'], ['LIYA', 'LiYA', '#E85D04']].map(([key, label, color]) => {
            const s = scoresSante[key];
            if (!s) return null;
            const sc = s.score || 0;
            const scColor = sc >= 80 ? '#27500A' : sc >= 60 ? '#BA7517' : '#A32D2D';
            return (
              <div key={key} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: color + '15', border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 15, color }}>{sc}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
                  <div style={{ height: 4, background: '#F1EFE8', borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${sc}%`, background: color, borderRadius: 2, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>CA {fmtM(s.ca)} · Tréso {fmtM(s.tresorerie)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filiales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <FilialeCard title="Yakro Grill" icon={Flame} color="#8B1A1A" bgColor="#FDF2F2" badge="Restaurant · Yamoussoukro"
          metrics={[
            { label: 'CA du jour', value: fmtM(yakro.caJour || 0) + ' F' },
            { label: 'Tables occupées', value: `${yakro.tablesOccupees ?? '—'}/${yakro.tablesTotal ?? '—'}` },
            { label: 'Commandes actives', value: yakro.commandesActives ?? '—' },
            { label: 'Statut cuisine', value: yakro.commandesActives > 0 ? 'En service' : 'Calme', sub: 'Temps réel' },
          ]}
        />
        <FilialeCard title="TOPTELSIG" icon={MapPin} color="#1a3f6f" bgColor="#EEF3FB" badge="Foncier · Côte d'Ivoire"
          metrics={[
            { label: 'Projets actifs', value: toptelsig.projetsActifs ?? '—' },
            { label: 'Lots vendus (mois)', value: toptelsig.lotsVendusMois ?? '—' },
            { label: 'Souscripteurs', value: toptelsig.souscripteurs ?? '—' },
            { label: 'Retards pmt', value: toptelsig.retards ?? '—', alert: toptelsig.retards > 0 },
          ]}
        />
        <FilialeCard title="LiYA" icon={Truck} color="#E85D04" bgColor="#FFF0EB" badge="Livraison · Yamoussoukro"
          metrics={[
            { label: 'Livraisons / jour', value: liya.livraisonsJour ?? '—' },
            { label: 'Motos actives', value: `${liya.motosActives ?? '—'}/${liya.motosTotal ?? '—'}` },
            { label: 'En transit', value: liya.enTransit ?? '—' },
            { label: 'Taux réussite', value: liya.tauxReussite ? liya.tauxReussite + '%' : '—' },
          ]}
        />
      </div>

      {/* Graphe + Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13 }}>CA ce mois par filiale (k FCFA)</div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} margin={{ left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => (v * 1000).toLocaleString('fr') + ' FCFA'} contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid #e8e7e1' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>ERP Timeline</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {(timeline.length > 0 ? timeline : MOCK_TIMELINE).slice(0, 7).map((evt, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', border: `1.5px solid ${FILIALE_COLOR[evt.filiale] || '#888'}`, flexShrink: 0, marginTop: 3, background: 'white' }} />
                  {i < arr.length - 1 && <div style={{ width: 1, flex: 1, background: '#e8e7e1', minHeight: 12 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{evt.label}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ padding: '1px 6px', borderRadius: 6, background: (FILIALE_COLOR[evt.filiale] || '#888') + '18', color: FILIALE_COLOR[evt.filiale] || '#888', fontSize: 10, fontWeight: 500 }}>
                      {evt.filiale?.replace('_', ' ')}
                    </span>
                    <span>{evt.date ? new Date(evt.date).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    {evt.montant && <span style={{ fontWeight: 500, color: '#1a1a1a' }}>{(evt.montant / 1000).toFixed(0)}k F</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const MOCK_TIMELINE = [
  { label: 'Commande POS #341 — Table 4', filiale: 'YAKRO_GRILL', date: new Date() },
  { label: 'Livraison #LY-089 terminée', filiale: 'LIYA', date: new Date(Date.now() - 600000) },
  { label: 'Paiement reçu — KOFFI A. (lot 14B)', filiale: 'TOPTELSIG', date: new Date(Date.now() - 1800000) },
  { label: 'Approvisionnement bar validé', filiale: 'YAKRO_GRILL', date: new Date(Date.now() - 3600000) },
  { label: 'Nouveau prescripteur enregistré', filiale: 'TOPTELSIG', date: new Date(Date.now() - 7200000) },
  { label: 'Plein carburant moto YK-001-CI', filiale: 'LIYA', date: new Date(Date.now() - 9000000) },
  { label: 'Rotation repos semaine générée', filiale: 'YAKRO_GRILL', date: new Date(Date.now() - 14400000) },
];
