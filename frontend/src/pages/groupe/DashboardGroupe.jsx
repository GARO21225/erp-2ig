import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, alertesAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import {
  TrendingUp, AlertTriangle, ChevronRight,
  Flame, MapPin, Truck, Users, Wallet, Package,
  ShoppingCart, Bike, Building2
} from 'lucide-react';

const fmtF = (n) => n ? Math.round(n).toLocaleString('fr') + ' F' : '0 F';
const fmtN = (n) => n?.toLocaleString('fr') || '0';

// ── Dashboard GROUPE (DG) ─────────────────────────────────────────────────
function DashboardGroupe({ data, alertes, nbCritiques }) {
  const navigate = useNavigate();
  const filiales = [
    { key: 'YAKRO_GRILL', label: 'Yakro Grill', icon: Flame, color: '#8B1A1A', bg: '#FDF2F2',
      desc: 'Restaurant · Yamoussoukro', to: '/yakro/pos',
      metrics: [
        { label: 'CA du jour', value: fmtF(data?.yakro?.caJour) },
        { label: 'Tables', value: `${data?.yakro?.tables || 12}` },
        { label: 'Commandes', value: fmtN(data?.yakro?.commandes) },
        { label: 'Réinvest.', value: fmtF((data?.yakro?.caJour || 0) * 0.5) },
      ]},
    { key: 'TOPTELSIG', label: 'TOPTELSIG', icon: MapPin, color: '#1a3f6f', bg: '#EEF3FB',
      desc: 'Foncier · Côte d\'Ivoire', to: '/toptelsig/projets',
      metrics: [
        { label: 'Projets actifs', value: fmtN(data?.toptelsig?.projetsActifs) },
        { label: 'Lots vendus', value: fmtN(data?.toptelsig?.lotsVendus) },
        { label: 'Retards', value: fmtN(data?.toptelsig?.retards), alert: data?.toptelsig?.retards > 0 },
        { label: 'Commissions', value: '—' },
      ]},
    { key: 'LIYA', label: 'LiYA', icon: Truck, color: '#E85D04', bg: '#FFF0EB',
      desc: 'Livraison · Yamoussoukro', to: '/liya/livraisons',
      metrics: [
        { label: 'Livraisons / jour', value: fmtN(data?.liya?.livraisonsJour) },
        { label: 'Motos actives', value: `${data?.liya?.motosActives || 0}/${data?.liya?.motosTotal || 0}` },
        { label: 'En cours', value: fmtN(data?.liya?.enCours) },
        { label: 'Taux réussite', value: '—' },
      ]},
  ];

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Centre de Commandement DG</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>Vision temps réel — Groupe 2iG · 3 filiales actives</p>
        </div>
        {nbCritiques > 0 && (
          <div style={{ background: '#FDF2F2', border: '1px solid #F7C1C1', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} color="#A32D2D" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#A32D2D' }}>{nbCritiques} critique(s)</span>
          </div>
        )}
      </div>

      {/* Alertes — seulement si réelles */}
      {alertes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {alertes.slice(0, 3).map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: a.gravite === 'CRITIQUE' ? '#FDF2F2' : '#FAEEDA', borderRadius: 8, border: `1px solid ${a.gravite === 'CRITIQUE' ? '#F7C1C1' : '#FAC775'}` }}>
              <AlertTriangle size={13} color={a.gravite === 'CRITIQUE' ? '#A32D2D' : '#BA7517'} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: a.gravite === 'CRITIQUE' ? '#A32D2D' : '#412402', flex: 1 }}>{a.message}</span>
              <span style={{ fontSize: 11, color: '#888' }}>{a.detail}</span>
            </div>
          ))}
          {alertes.length > 3 && <div style={{ fontSize: 12, color: '#888', paddingLeft: 4 }}>+{alertes.length - 3} autres alertes</div>}
        </div>
      )}

      {/* KPI Groupe */}
      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        {[
          { label: 'CA Groupe (mois)', value: fmtF(data?.ca?.groupe), icon: TrendingUp, color: '#1a3f6f' },
          { label: 'Trésorerie Nette', value: fmtF(data?.tresorerie), icon: Wallet, color: '#27500A' },
          { label: 'Employés Actifs', value: fmtN(data?.employes?.actifs) + ' pers.', icon: Users, color: '#1a3f6f' },
          { label: 'Lots Vendus (total)', value: fmtN(data?.toptelsig?.lotsVendus), icon: Building2, color: '#E85D04' },
        ].map((k, i) => (
          <div key={i} className="kpi">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ fontSize: 18 }}>{k.value}</div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: k.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <k.icon size={14} style={{ color: k.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cards filiales */}
      <div className="grid-3">
        {filiales.map(f => (
          <div key={f.key} className="card" style={{ borderTop: `3px solid ${f.color}`, cursor: 'pointer' }}
            onClick={() => navigate(f.to)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <f.icon size={15} style={{ color: f.color }} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13 }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{f.desc}</div>
                </div>
              </div>
              <ChevronRight size={14} color="#ccc" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {f.metrics.map((m, i) => (
                <div key={i} style={{ background: '#F7F7F5', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: m.alert ? '#A32D2D' : '#1a1a1a' }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard YAKRO GRILL ─────────────────────────────────────────────────
function DashboardYakro() {
  const navigate = useNavigate();
  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontFamily: 'Syne', fontWeight: 800, color: '#8B1A1A' }}>🔥 Yakro Grill</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>Restaurant · Yamoussoukro</p>
        </div>
      </div>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {[
          { label: 'Plan de Salle (POS)', desc: 'Gérer les tables et commandes', icon: ShoppingCart, to: '/yakro/pos', color: '#8B1A1A' },
          { label: 'Commandes du jour', desc: 'Historique et suivi', icon: Package, to: '/yakro/commandes', color: '#8B1A1A' },
          { label: 'Caisse du jour', desc: 'CA et réinvestissement', icon: Wallet, to: '/yakro/caisse', color: '#8B1A1A' },
          { label: 'Menu & Carte', desc: '80 articles disponibles', icon: Package, to: '/yakro/menu', color: '#8B1A1A' },
        ].map((item, i) => (
          <div key={i} className="card" style={{ cursor: 'pointer', borderLeft: '3px solid #8B1A1A' }}
            onClick={() => navigate(item.to)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FDF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <item.icon size={16} style={{ color: '#8B1A1A' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{item.desc}</div>
              </div>
              <ChevronRight size={14} color="#ccc" style={{ marginLeft: 'auto' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard TOPTELSIG ───────────────────────────────────────────────────
function DashboardToptelsig() {
  const navigate = useNavigate();
  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontFamily: 'Syne', fontWeight: 800, color: '#1a3f6f' }}>📍 TOPTELSIG</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>Foncier · Côte d'Ivoire</p>
        </div>
      </div>
      <div className="grid-2">
        {[
          { label: 'Projets Fonciers', desc: 'Gérer les projets et lots', icon: Building2, to: '/toptelsig/projets' },
          { label: 'Souscripteurs', desc: 'Clients et contrats', icon: Users, to: '/toptelsig/souscripteurs' },
          { label: 'Ventes & Échéanciers', desc: 'Suivi des paiements', icon: TrendingUp, to: '/toptelsig/ventes' },
          { label: 'Dépenses', desc: 'Workflow 3 niveaux', icon: Wallet, to: '/toptelsig/depenses' },
          { label: 'Prescripteurs', desc: 'Commissions et réseau', icon: Users, to: '/toptelsig/prescripteurs' },
        ].map((item, i) => (
          <div key={i} className="card" style={{ cursor: 'pointer', borderLeft: '3px solid #1a3f6f' }}
            onClick={() => navigate(item.to)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EEF3FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <item.icon size={16} style={{ color: '#1a3f6f' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{item.desc}</div>
              </div>
              <ChevronRight size={14} color="#ccc" style={{ marginLeft: 'auto' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard LIYA ────────────────────────────────────────────────────────
function DashboardLiya() {
  const navigate = useNavigate();
  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontFamily: 'Syne', fontWeight: 800, color: '#E85D04' }}>🛵 LiYA</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>Livraison · Yamoussoukro</p>
        </div>
      </div>
      <div className="grid-2">
        {[
          { label: 'Livraisons', desc: 'Gérer les livraisons du jour', icon: Truck, to: '/liya/livraisons' },
          { label: 'Motos & Flotte', desc: 'État de la flotte', icon: Bike, to: '/liya/motos' },
          { label: 'Carte GPS', desc: 'Positions en temps réel', icon: MapPin, to: '/liya/carte' },
          { label: 'Stock Clients 3PL', desc: 'Entreposage clients', icon: Package, to: '/liya/stock3pl' },
        ].map((item, i) => (
          <div key={i} className="card" style={{ cursor: 'pointer', borderLeft: '3px solid #E85D04' }}
            onClick={() => navigate(item.to)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FFF0EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <item.icon size={16} style={{ color: '#E85D04' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{item.desc}</div>
              </div>
              <ChevronRight size={14} color="#ccc" style={{ marginLeft: 'auto' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────
export default function Dashboard() {
  const filiale = useAuthStore(s => s.filiale);

  const { data } = useQuery({
    queryKey: ['dashboard-groupe'],
    queryFn: dashboardAPI.groupe,
    staleTime: 30000,
    retry: 1,
  });

  const { data: alertesData } = useQuery({
    queryKey: ['alertes'],
    queryFn: alertesAPI.critiques,
    staleTime: 60000,
    retry: 1,
  });

  const alertes = alertesData?.alertes || [];
  const nbCritiques = alertesData?.critiques || 0;

  // Afficher le dashboard de la filiale sélectionnée
  if (filiale === 'YAKRO_GRILL') return <DashboardYakro />;
  if (filiale === 'TOPTELSIG')   return <DashboardToptelsig />;
  if (filiale === 'LIYA')        return <DashboardLiya />;

  // DG / GROUPE : dashboard consolidé
  return <DashboardGroupe data={data} alertes={alertes} nbCritiques={nbCritiques} />;
}
