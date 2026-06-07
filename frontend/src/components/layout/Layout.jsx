import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store';
import { authAPI } from '../../lib/api';
import {
  LayoutDashboard, Users, Wallet, Package, ChevronDown,
  Flame, MapPin, Truck, Search, Bell, LogOut, Menu,
  ShoppingCart, ClipboardList, BookOpen, Calendar,
  Building2, Map, Bike, Layers, FileText, TrendingUp
} from 'lucide-react';

const FILIALES = [
  { key: 'GROUPE', label: 'Groupe 2iG', color: '#1a3f6f' },
  { key: 'YAKRO_GRILL', label: 'Yakro Grill', color: '#8B1A1A' },
  { key: 'TOPTELSIG', label: 'TOPTELSIG', color: '#1a3f6f' },
  { key: 'LIYA', label: 'LiYA', color: '#E85D04' },
];

const NAV = {
  GROUPE: [
    { label: 'Centre de commandement', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Ressources Humaines', to: '/rh', icon: Users },
    { label: 'Finance Groupe', to: '/finance', icon: Wallet },
    { label: 'Stocks & Achats', to: '/stocks', icon: Package },
  ],
  YAKRO_GRILL: [
    { label: 'POS — Plan de salle', to: '/yakro/pos', icon: Layers },
    { label: 'Commandes', to: '/yakro/commandes', icon: ClipboardList },
    { label: 'Menu & Carte', to: '/yakro/menu', icon: BookOpen },
    { label: 'Réservations', to: '/yakro/reservations', icon: Calendar },
    { label: 'Caisse du jour', to: '/yakro/caisse', icon: Wallet },
  ],
  TOPTELSIG: [
    { label: 'Projets fonciers', to: '/toptelsig/projets', icon: Building2 },
    { label: 'Souscripteurs', to: '/toptelsig/souscripteurs', icon: Users },
    { label: 'Prescripteurs', to: '/toptelsig/prescripteurs', icon: TrendingUp },
    { label: 'Ventes & Échéanciers', to: '/toptelsig/ventes', icon: TrendingUp },
    { label: 'Dépenses', to: '/toptelsig/depenses', icon: FileText },
    { label: 'GED Foncière', to: '/toptelsig/ged', icon: Layers },
  ],
  LIYA: [
    { label: 'Livraisons', to: '/liya/livraisons', icon: Truck },
    { label: 'Motos & Flotte', to: '/liya/motos', icon: Bike },
    { label: 'Carte GPS', to: '/liya/carte', icon: Map },
    { label: 'Stock Clients 3PL', to: '/liya/stock3pl', icon: Package },
  ],
};

const COLORS = {
  GROUPE: '#1a3f6f',
  YAKRO_GRILL: '#8B1A1A',
  TOPTELSIG: '#1a3f6f',
  LIYA: '#E85D04',
};

const ICONS = {
  GROUPE: <LayoutDashboard size={14} />,
  YAKRO_GRILL: <Flame size={14} />,
  TOPTELSIG: <MapPin size={14} />,
  LIYA: <Truck size={14} />,
};

export default function Layout() {
  const { user, filiale, setFiliale, logout } = useAuthStore();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filialeOpen, setFilialeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const nav = NAV[filiale] || NAV.GROUPE;
  const color = COLORS[filiale];

  // Raccourci clavier Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSearchChange = async (val) => {
    setSearch(val);
    if (val.trim().length < 3) { setSearchResults(null); return; }
    setSearchLoading(true);
    setSearchOpen(true);
    try {
      const { rechercheAPI } = await import('../../lib/api');
      const res = await rechercheAPI.global(val.trim());
      setSearchResults(res);
    } catch { setSearchResults(null); }
    finally { setSearchLoading(false); }
  };

  const ENTITE_ROUTES = {
    employes: (item) => navigate('/rh'),
    souscripteurs: (item) => navigate('/toptelsig/souscripteurs'),
    prescripteurs: (item) => navigate('/toptelsig/prescripteurs'),
    lots: (item) => navigate('/toptelsig/projets'),
    projets: (item) => navigate('/toptelsig/projets'),
    livraisons: (item) => navigate('/liya/livraisons'),
    motos: (item) => navigate('/liya/motos'),
    produits: (item) => navigate('/stocks'),
  };

  const ENTITE_LABELS = {
    employes: '👥 Employé', souscripteurs: '🏠 Souscripteur', prescripteurs: '🤝 Prescripteur',
    lots: '📍 Lot', projets: '🏗 Projet', livraisons: '🛵 Livraison', motos: '🏍 Moto', produits: '📦 Produit',
  };

  const handleSelectResult = (entite, item) => {
    setSearch(''); setSearchOpen(false); setSearchResults(null);
    ENTITE_ROUTES[entite]?.(item);
  };

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gridTemplateRows: '56px 1fr', height: '100vh', overflow: 'hidden' }}>

      {/* ── TOPBAR */}
      <header style={{
        gridColumn: '1 / -1', background: 'white', borderBottom: '0.5px solid #e8e7e1',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Logo */}
          <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, letterSpacing: -1 }}>
            <span style={{ color: '#E87722' }}>2</span><span style={{ color: '#1a3f6f' }}>iG</span>
            <span style={{ fontSize: 9, fontWeight: 500, color: '#888', letterSpacing: 2, marginLeft: 6, textTransform: 'uppercase' }}>ERP Groupe</span>
          </div>

          {/* Sélecteur filiale */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setFilialeOpen(!filialeOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#F1EFE8', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'DM Sans' }}
            >
              <span style={{ color }}>{ICONS[filiale]}</span>
              <span>{FILIALES.find(f => f.key === filiale)?.label}</span>
              <ChevronDown size={12} style={{ color: '#888' }} />
            </button>

            {filialeOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: 4, zIndex: 200, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                {FILIALES.map(f => (
                  <button key={f.key} onClick={() => { setFiliale(f.key); setFilialeOpen(false); navigate('/dashboard'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: 'none', background: filiale === f.key ? '#F1EFE8' : 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: 13, borderRadius: 6, fontFamily: 'DM Sans' }}>
                    <span style={{ color: f.color }}>{ICONS[f.key]}</span> {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 300 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F1EFE8', border: `0.5px solid ${searchOpen ? '#1a3f6f' : '#e8e7e1'}`, borderRadius: 20, padding: '6px 14px', transition: 'border 0.1s' }}>
            <Search size={14} color="#888" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => search.length >= 3 && setSearchOpen(true)}
              placeholder="Rechercher… (Ctrl+K)"
              style={{ border: 'none', background: 'transparent', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'DM Sans' }}
            />
            {search && <button onClick={() => { setSearch(''); setSearchResults(null); setSearchOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 0, lineHeight: 1 }}>✕</button>}
          </div>

          {/* Dropdown résultats */}
          {searchOpen && (searchLoading || searchResults) && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 12, zIndex: 300, maxHeight: 400, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              {searchLoading ? (
                <div style={{ padding: '14px 16px', fontSize: 13, color: '#888' }}>Recherche en cours...</div>
              ) : searchResults ? (
                <>
                  {searchResults.nbResultats === 0 ? (
                    <div style={{ padding: '14px 16px', fontSize: 13, color: '#888' }}>Aucun résultat pour "{searchResults.terme}"</div>
                  ) : (
                    Object.entries(searchResults.resultats || {}).map(([entite, items]) => {
                      if (!items?.length) return null;
                      return (
                        <div key={entite}>
                          <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#aaa' }}>
                            {ENTITE_LABELS[entite] || entite}
                          </div>
                          {items.map((item, i) => {
                            const label = item.numero || item.code || `${item.prenom || ''} ${item.nom || item.immatriculation || item.nom || ''}`.trim() || item.reference || item.nom || '—';
                            const sub = item.poste || item.statut || item.telephone || item.categorie || '';
                            return (
                              <div key={i} onClick={() => handleSelectResult(entite, item)}
                                style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#F1EFE8'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                                  {sub && <div style={{ fontSize: 11, color: '#888' }}>{sub}</div>}
                                </div>
                                <ChevronRight size={12} color="#ccc" />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                  <div style={{ padding: '8px 16px', fontSize: 11, color: '#aaa', borderTop: '0.5px solid #f0efe9' }}>
                    {searchResults.nbResultats} résultat(s) · Appuyez Echap pour fermer
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
            <Bell size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#EEF3FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#1a3f6f' }}>
              {user?.prenom?.[0]}{user?.nom?.[0]}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{user?.prenom} {user?.nom}</div>
              <div style={{ fontSize: 10, color: '#888' }}>{user?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── SIDEBAR */}
      <aside style={{ gridRow: 2, background: 'white', borderRight: '0.5px solid #e8e7e1', overflowY: 'auto', paddingTop: 8 }}>
        <div style={{ padding: '8px 16px 4px', fontSize: 9, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#aaa' }}>
          {FILIALES.find(f => f.key === filiale)?.label}
        </div>

        {nav.map(item => (
          <NavLink key={item.to} to={item.to}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 13,
              color: isActive ? '#1a1a1a' : '#888780', textDecoration: 'none',
              background: isActive ? '#F1EFE8' : 'transparent',
              fontWeight: isActive ? 500 : 400,
              borderLeft: isActive ? `2px solid ${color}` : '2px solid transparent',
              transition: 'all 0.1s'
            })}>
            <item.icon size={15} />
            {item.label}
          </NavLink>
        ))}

        {/* Modules communs */}
        {filiale !== 'GROUPE' && (
          <>
            <div style={{ padding: '16px 16px 4px', fontSize: 9, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#aaa' }}>Communs</div>
            {[
              { label: 'RH & Équipes', to: '/rh', icon: Users },
              { label: 'Finance', to: '/finance', icon: Wallet },
              { label: 'Stocks', to: '/stocks', icon: Package },
            ].map(item => (
              <NavLink key={item.to} to={item.to}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 13,
                  color: isActive ? '#1a1a1a' : '#888780', textDecoration: 'none',
                  background: isActive ? '#F1EFE8' : 'transparent',
                  fontWeight: isActive ? 500 : 400,
                  borderLeft: isActive ? `2px solid ${color}` : '2px solid transparent',
                })}>
                <item.icon size={15} />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </aside>

      {/* ── CONTENT */}
      <main style={{ gridRow: 2, overflowY: 'auto', background: '#F7F7F5', padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}
