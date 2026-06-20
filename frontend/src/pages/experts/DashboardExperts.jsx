import { useQuery } from '@tanstack/react-query';
import { expertsAPI } from '../../lib/api';
import { Users, Briefcase, CheckCircle, TrendingUp, Clock, AlertCircle } from 'lucide-react';

const SPEC_LABEL = {
  GEOMETRE_EXPERT: 'Géomètre-Expert', NOTAIRE: 'Notaire', ARCHITECTE: 'Architecte',
  EVALUATEUR: 'Évaluateur', JURISTE: 'Juriste', TOPOGRAPHE: 'Topographe', AUTRE: 'Autre',
};

const STATUT_MISSION = {
  EN_ATTENTE: { label: 'En attente', color: '#888', bg: '#F1EFE8' },
  EN_COURS:   { label: 'En cours',   color: '#5B21B6', bg: '#EDE9FE' },
  TERMINEE:   { label: 'Terminée',   color: '#27500A', bg: '#EAF3DE' },
  ANNULEE:    { label: 'Annulée',    color: '#A32D2D', bg: '#FCEBEB' },
};

export default function DashboardExperts() {
  const { data: stats } = useQuery({ queryKey: ['experts-stats'], queryFn: expertsAPI.stats, refetchInterval: 30000 });
  const { data: missions = [] } = useQuery({ queryKey: ['missions-all', ''], queryFn: () => expertsAPI.missions(), refetchInterval: 30000 });
  const { data: experts = [] } = useQuery({ queryKey: ['experts', {}], queryFn: () => expertsAPI.list(), refetchInterval: 60000 });

  const missionsRecentes = [...missions].slice(0, 6);

  const parSpecialite = experts.reduce((acc, e) => {
    acc[e.specialite] = (acc[e.specialite] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Dashboard Experts</h1>
        <div style={{ fontSize: 12, color: '#888', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="dot dot-pulse" style={{ background: '#5B21B6' }} />
          Vue d'ensemble du réseau d'experts 2iG
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Experts actifs', value: stats?.actifs ?? '—', icon: Users, color: '#5B21B6' },
          { label: 'Missions en cours', value: stats?.missionsEnCours ?? '—', icon: Briefcase, color: '#E85D04' },
          { label: 'Missions terminées', value: stats?.missionsTerminees ?? '—', icon: CheckCircle, color: '#27500A' },
          { label: 'Montant engagé', value: stats?.montantTotal ? (stats.montantTotal / 1000).toFixed(0) + 'k F' : '0 F', icon: TrendingUp, color: '#1a3f6f' },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={18} color={k.color} />
            </div>
            <div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ fontSize: 22, color: k.color }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        {/* Missions récentes */}
        <div>
          <h2 style={{ fontSize: 14, fontFamily: 'Syne', fontWeight: 700, marginBottom: 12 }}>Missions récentes</h2>
          {missionsRecentes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: '#ccc', fontSize: 13 }}>
              <Briefcase size={28} style={{ marginBottom: 8 }} /><br />Aucune mission
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {missionsRecentes.map(m => {
                const s = STATUT_MISSION[m.statut] || STATUT_MISSION.EN_ATTENTE;
                return (
                  <div key={m.id} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{m.titre}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        👤 {m.expert?.prenom} {m.expert?.nom}
                        {m.projetNom && <> · 🏗 {m.projetNom}</>}
                      </div>
                      {m.dateDebut && (
                        <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>
                          <Clock size={10} style={{ marginRight: 3 }} />
                          {new Date(m.dateDebut).toLocaleDateString('fr')}
                          {m.dateFin && ` → ${new Date(m.dateFin).toLocaleDateString('fr')}`}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 10, padding: '2px 8px' }}>{s.label}</span>
                      {m.montant && <span style={{ fontSize: 11, color: '#5B21B6', fontWeight: 600 }}>{m.montant.toLocaleString('fr')} F</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel droit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Répartition par spécialité */}
          <div className="card">
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Répartition par spécialité</div>
            {Object.entries(parSpecialite).length === 0 ? (
              <div style={{ color: '#ccc', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>Aucun expert</div>
            ) : (
              Object.entries(parSpecialite).map(([spec, count]) => (
                <div key={spec} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#555' }}>{SPEC_LABEL[spec] || spec}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: Math.max(20, (count / experts.length) * 80), height: 6, background: '#5B21B6', borderRadius: 3 }} />
                    <span style={{ fontSize: 11, color: '#888', width: 16, textAlign: 'right' }}>{count}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Alertes missions */}
          {missions.filter(m => m.statut === 'EN_COURS' && m.dateFin && new Date(m.dateFin) < new Date()).length > 0 && (
            <div className="card" style={{ border: '1px solid #FAEEDA', background: '#FFFCF5' }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#BA7517', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} /> Missions en retard
              </div>
              {missions.filter(m => m.statut === 'EN_COURS' && m.dateFin && new Date(m.dateFin) < new Date()).map(m => (
                <div key={m.id} style={{ fontSize: 11, color: '#666', marginBottom: 5 }}>
                  ⚠ {m.titre} · {m.expert?.prenom} {m.expert?.nom}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
