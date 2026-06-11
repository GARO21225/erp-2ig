import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store';
import { authAPI } from '../../lib/api';
import {
  LayoutDashboard, Users, Wallet, Package, ChevronDown, ChevronRight, Shield, Settings, Clock, Target,
  Flame, MapPin, Truck, Search, Bell, LogOut, Menu, X,
  ClipboardList, BookOpen, Calendar,
  Building2, Map, Bike, Layers, FileText, TrendingUp
} from 'lucide-react';

const FILIALES = [
  { key: 'GROUPE',     label: 'Groupe 2iG',  color: '#1a3f6f' },
  { key: 'YAKRO_GRILL',label: 'Yakro Grill', color: '#8B1A1A' },
  { key: 'TOPTELSIG',  label: 'TOPTELSIG',   color: '#1a3f6f' },
  { key: 'LIYA',       label: 'LiYA',        color: '#E85D04' },
];

const NAV = {
  GROUPE: [
    { label: 'Commandement DG', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Accès & Rôles', to: '/utilisateurs', icon: Shield },
    { label: 'Journal d\'activité', to: '/historisation', icon: Clock },
    { label: 'Ressources Humaines', to: '/rh', icon: Users },
    { label: 'Finance Groupe', to: '/finance', icon: Wallet },
    { label: 'Stocks & Achats', to: '/stocks', icon: Package },
  ],
  YAKRO_GRILL: [
    { label: 'Dashboard', to: '/yakro/dashboard', icon: Activity },
    { label: 'Plan de Salle (POS)', to: '/yakro/pos', icon: Layers },
    { label: 'Menu & Carte', to: '/yakro/menu', icon: BookOpen },
    { label: 'Caisse du jour', to: '/yakro/caisse', icon: Wallet },
    { label: 'Réservations', to: '/yakro/reservations', icon: Calendar },
    { label: 'Config. Tables', to: '/yakro/tables', icon: Settings },
  ],
  TOPTELSIG: [
    { label: 'Dashboard TOPTELSIG', to: '/toptelsig/dashboard', icon: LayoutDashboard },
    { label: 'CRM — Prospects', to: '/toptelsig/prospects', icon: Users },
    { label: 'Gestion de Projet', to: '/toptelsig/gestion-projet', icon: Target },
    { label: 'Projets fonciers', to: '/toptelsig/projets', icon: Building2 },
    { label: 'Souscripteurs', to: '/toptelsig/souscripteurs', icon: Users },
    { label: 'Prescripteurs', to: '/toptelsig/prescripteurs', icon: TrendingUp },
    { label: 'Ventes & Échéanciers', to: '/toptelsig/ventes', icon: TrendingUp },
    { label: 'Dépenses', to: '/toptelsig/depenses', icon: FileText },
  ],
  LIYA: [
    { label: 'Livraisons', to: '/liya/livraisons', icon: Truck },
    { label: 'Motos & Flotte', to: '/liya/motos', icon: Bike },
    { label: 'Carte GPS', to: '/liya/carte', icon: Map },
    { label: 'Stock Clients 3PL', to: '/liya/stock3pl', icon: Package },
  ],
};

const ICONS = {
  GROUPE:     <LayoutDashboard size={14} />,
  YAKRO_GRILL:<Flame size={14} />,
  TOPTELSIG:  <MapPin size={14} />,
  LIYA:       <Truck size={14} />,
};

const ENTITE_LABELS = {
  employes:'👥 Employé', souscripteurs:'🏠 Souscripteur', prescripteurs:'🤝 Prescripteur',
  lots:'📍 Lot', projets:'🏗 Projet', livraisons:'🛵 Livraison', motos:'🏍 Moto', produits:'📦 Produit',
};

export default function Layout() {
  const { user, filiale, setFiliale, logout } = useAuthStore();
  const [search, setSearch]         = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filialeOpen, setFilialeOpen] = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchRef = useRef(null);
  const navigate  = useNavigate();

  const nav   = NAV[filiale] || NAV.GROUPE;
  const color = filiale === 'YAKRO_GRILL' ? '#8B1A1A' : filiale === 'LIYA' ? '#E85D04' : '#1a3f6f';

  // Ctrl+K
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setSidebarOpen(false); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // Fermer sidebar sur navigation mobile
  const closeSidebar = () => setSidebarOpen(false);

  const handleSearch = async (val) => {
    setSearch(val);
    if (val.trim().length < 3) { setSearchResults(null); return; }
    setSearchLoading(true); setSearchOpen(true);
    try {
      const { rechercheAPI } = await import('../../lib/api');
      const res = await rechercheAPI.global(val.trim());
      setSearchResults(res);
    } catch { setSearchResults(null); }
    finally { setSearchLoading(false); }
  };

  const handleResult = (entite, item) => {
    setSearch(''); setSearchOpen(false); setSearchResults(null); setSidebarOpen(false);
    const routes = {
      employes: '/rh', souscripteurs: '/toptelsig/souscripteurs',
      prescripteurs: '/toptelsig/prescripteurs', lots: '/toptelsig/projets',
      projets: '/toptelsig/projets', livraisons: '/liya/livraisons',
      motos: '/liya/motos', produits: '/stocks',
    };
    navigate(routes[entite] || '/dashboard');
  };

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout(); navigate('/login');
  };

  const NavItems = ({ onItemClick }) => (
    <>
      <div style={{ padding: '8px 16px 4px', fontSize: 9, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#aaa' }}>
        {FILIALES.find(f => f.key === filiale)?.label}
      </div>
      {nav.map(item => (
        <NavLink key={item.to} to={item.to} onClick={onItemClick}
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
            fontSize: 13, color: isActive ? '#1a1a1a' : '#888780', textDecoration: 'none',
            background: isActive ? '#F1EFE8' : 'transparent', fontWeight: isActive ? 600 : 400,
            borderLeft: `2px solid ${isActive ? color : 'transparent'}`, transition: 'all 0.1s',
          })}>
          <item.icon size={15} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
        </NavLink>
      ))}
      {filiale !== 'GROUPE' && (
        <>
          <div style={{ padding: '12px 16px 4px', fontSize: 9, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#aaa' }}>Communs</div>
          {[
            { label: 'Stocks & Approvisionnements', to: '/stocks', icon: Package },
            { label: 'RH & Équipes', to: '/rh', icon: Users },
          ].map(item => (
            <NavLink key={item.to} to={item.to} onClick={onItemClick}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
                fontSize: 13, color: isActive ? '#1a1a1a' : '#888780', textDecoration: 'none',
                background: isActive ? '#F1EFE8' : 'transparent', fontWeight: isActive ? 600 : 400,
                borderLeft: `2px solid ${isActive ? color : 'transparent'}`,
              })}>
              <item.icon size={15} />
              {item.label}
            </NavLink>
          ))}
        </>
      )}
    </>
  );

  return (
    <div className="app-layout">

      {/* ── TOPBAR ────────────────────────────────────────── */}
      <header className="app-topbar">
        {/* Hamburger mobile */}
        <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#555', display: 'flex', alignItems: 'center' }}>
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Logo */}
        <div className="topbar-logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#E87722' }}>2</span><span style={{ color: '#1a3f6f' }}>iG</span>
          <span className="erp-label" style={{ fontSize: 9, fontWeight: 500, color: '#888', letterSpacing: 2, textTransform: 'uppercase' }}>ERP</span>
        </div>

        {/* Sélecteur filiale */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setFilialeOpen(!filialeOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#F1EFE8', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
            <span style={{ color }}>{ICONS[filiale]}</span>
            <span style={{ display: 'none', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}
              className="filiale-label">
              {FILIALES.find(f => f.key === filiale)?.label}
            </span>
            <ChevronDown size={11} color="#888" />
          </button>
          {filialeOpen && (
            <>
              <div onClick={() => setFilialeOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: 4, zIndex: 200, minWidth: 170, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                {FILIALES.map(f => (
                  <button key={f.key} onClick={() => { setFiliale(f.key); setFilialeOpen(false); navigate('/dashboard'); setSidebarOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: 'none', background: filiale === f.key ? '#F1EFE8' : 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: 13, borderRadius: 6 }}>
                    <span style={{ color: f.color }}>{ICONS[f.key]}</span> {f.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Recherche */}
        <div className="topbar-search" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F1EFE8', border: `0.5px solid ${searchOpen ? '#1a3f6f' : '#e8e7e1'}`, borderRadius: 20, padding: '6px 12px' }}>
            <Search size={13} color="#888" style={{ flexShrink: 0 }} />
            <input ref={searchRef} value={search} onChange={e => handleSearch(e.target.value)}
              onFocus={() => search.length >= 3 && setSearchOpen(true)}
              placeholder="Rechercher… (Ctrl+K)"
              style={{ border: 'none', background: 'transparent', fontSize: 12, outline: 'none', width: '100%', minWidth: 0 }} />
            {search && <button onClick={() => { setSearch(''); setSearchResults(null); setSearchOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 0, flexShrink: 0 }}>✕</button>}
          </div>
          {searchOpen && (searchLoading || searchResults) && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, zIndex: 300, maxHeight: 360, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              {searchLoading
                ? <div style={{ padding: '12px 16px', fontSize: 13, color: '#888' }}>Recherche…</div>
                : searchResults?.nbResultats === 0
                  ? <div style={{ padding: '12px 16px', fontSize: 13, color: '#888' }}>Aucun résultat</div>
                  : Object.entries(searchResults?.resultats || {}).map(([entite, items]) => {
                      if (!items?.length) return null;
                      return (
                        <div key={entite}>
                          <div style={{ padding: '6px 16px 2px', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#aaa' }}>{ENTITE_LABELS[entite]}</div>
                          {items.map((item, i) => {
                            const label = `${item.prenom || ''} ${item.nom || item.immatriculation || ''}`.trim() || item.numero || item.code || item.reference || '—';
                            return (
                              <div key={i} onClick={() => handleResult(entite, item)}
                                style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}
                                onMouseEnter={e => e.currentTarget.style.background = '#F1EFE8'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                {label}
                                <ChevronRight size={12} color="#ccc" />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
              }
            </div>
          )}
        </div>

        {/* User + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#EEF3FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1a3f6f', flexShrink: 0 }}>
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div style={{ lineHeight: 1.2, display: 'none' }} className="user-info">
            <div style={{ fontSize: 12, fontWeight: 500 }}>{user?.prenom}</div>
            <div style={{ fontSize: 10, color: '#888' }}>{user?.role}</div>
          </div>
          <button onClick={handleLogout} title="Déconnexion"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 4, display: 'flex', alignItems: 'center' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Overlay mobile sidebar ─────────────────────── */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={closeSidebar} />

      {/* ── SIDEBAR ───────────────────────────────────── */}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <NavItems onItemClick={closeSidebar} />
        <div style={{ height: 40 }} />
      </aside>

      {/* ── MAIN ──────────────────────────────────────── */}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
