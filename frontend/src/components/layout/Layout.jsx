import NotifCentre from '../ui/NotifCentre';
import AssistantERP from '../ui/AssistantERP';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store';
import { authAPI, rechercheAPI } from '../../lib/api';
import {
  LayoutDashboard, Users, Wallet, Package, ChevronDown, ChevronRight, Shield, Settings, Clock, Target,
  Flame, MapPin, Truck, Search, Bell, LogOut, Menu, X,
  ClipboardList, BookOpen, Calendar, Activity, ArrowDownLeft, ArrowUpRight,
  Building2, Map, Bike, Layers, FileText, TrendingUp, Home, Utensils,
  UserCheck, BarChart2, Archive, CheckSquare, Star, Receipt, Folder, Megaphone
} from 'lucide-react';

// ── Filiales ───────────────────────────────────────────────────────────────────
const FILIALES = [
  { key: 'GROUPE',      label: 'Groupe 2iG',   color: '#1a3f6f', icon: '🏛', path: '/dashboard' },
  { key: 'YAKRO_GRILL', label: 'Yakro Grill',  color: '#8B1A1A', icon: '🍽', path: '/yakro/dashboard' },
  { key: 'TOPTELSIG',   label: 'TOPTELSIG',    color: '#27500A', icon: '🏘', path: '/toptelsig/dashboard' },
  { key: 'LIYA',        label: 'LiYA Logistics',color: '#E85D04', icon: '🚚', path: '/liya/livraisons' },
];

// ── Permissions par rôle ───────────────────────────────────────────────────────
// true = accès autorisé, false = masqué
const PERMISSIONS = {
  // Clé : identifiant du lien
  // Rôles qui y ont accès (si vide = tous)
  'utilisateurs':      ['DG', 'DIRECTEUR', 'RH'],
  'historisation':     ['DG', 'DIRECTEUR', 'MANAGER', 'RH'],
  'parametres':        ['DG', 'DIRECTEUR'],
  'finance':           ['DG', 'DIRECTEUR', 'COMPTABLE', 'MANAGER'],
  'marges':            ['DG', 'DIRECTEUR'],
  'gestion-caisse':    ['DG', 'DIRECTEUR', 'MANAGER', 'COMPTABLE', 'CAISSIER'],
  'config-tables':     ['DG', 'DIRECTEUR', 'MANAGER'],
  'prescripteurs':     ['DG', 'DIRECTEUR', 'MANAGER', 'RESP_FONCIER'],
  'ventes':            ['DG', 'DIRECTEUR', 'MANAGER', 'RESP_FONCIER', 'COMPTABLE'],
  'depenses':          ['DG', 'DIRECTEUR', 'MANAGER', 'COMPTABLE', 'RESP_FONCIER', 'CAISSIER'],
};

function canAccess(role, permKey) {
  if (!PERMISSIONS[permKey]) return true; // pas de restriction
  if (role === 'DG') return true;
  return PERMISSIONS[permKey].includes(role);
}

// ── Menus par filiale (complets) ───────────────────────────────────────────────
const NAV = {
  GROUPE: [
    { id: 'dashboard',      label: 'Commandement DG',       to: '/dashboard',              icon: LayoutDashboard },
    { id: 'utilisateurs',   label: 'Accès & Rôles',         to: '/utilisateurs',           icon: Shield },
    { id: 'historisation',  label: 'Journal d\'activité',   to: '/historisation',          icon: Clock },
    { id: 'rh',             label: 'Ressources Humaines',   to: '/rh',                     icon: Users },
    { id: 'finance',        label: 'Finance Groupe',        to: '/finance',                icon: Wallet },
    { id: 'stocks',         label: 'Stocks & Achats',       to: '/stocks',                 icon: Package },
    { id: 'parametres',     label: 'Paramètres Entreprise', to: '/parametres-entreprise',  icon: Settings },
  ],
  YAKRO_GRILL: [
    { id: 'yakro-dashboard', label: 'Dashboard',           to: '/yakro/dashboard',        icon: Activity },
    { id: 'pos',             label: 'Plan de Salle (POS)', to: '/yakro/pos',              icon: Layers },
    { id: 'menu',            label: 'Menu & Carte',        to: '/yakro/menu',             icon: BookOpen },
    { id: 'commandes',       label: 'Historique commandes',to: '/yakro/commandes',        icon: ClipboardList },
    { id: 'caisse',          label: 'Caisse du jour',      to: '/yakro/caisse',           icon: Wallet },
    { id: 'gestion-caisse',  label: 'Gestion Caisse',      to: '/yakro/gestion-caisse',   icon: BarChart2 },
    { id: 'reservations',    label: 'Réservations',        to: '/yakro/reservations',     icon: Calendar },
    { id: 'depenses',        label: 'Dépenses',            to: '/yakro/depenses',         icon: ArrowDownLeft },
    { id: 'config-tables',   label: 'Config. Tables',      to: '/yakro/tables',           icon: Settings },
  ],
  TOPTELSIG: [
    { id: 'toptelsig-dashboard', label: 'Dashboard',           to: '/toptelsig/dashboard',     icon: LayoutDashboard },
    { id: 'crm',                 label: 'CRM — Prospects',     to: '/toptelsig/prospects',     icon: Target },
    { id: 'campagnes',           label: 'Campagnes',           to: '/toptelsig/campagnes',     icon: Megaphone },
    { id: 'projets',             label: 'Projets fonciers',    to: '/toptelsig/projets',       icon: Building2 },
    { id: 'souscripteurs',       label: 'Souscripteurs',       to: '/toptelsig/souscripteurs', icon: UserCheck },
    { id: 'ventes',              label: 'Ventes & Échéanciers',to: '/toptelsig/ventes',        icon: TrendingUp },
    { id: 'prescripteurs',       label: 'Prescripteurs',       to: '/toptelsig/prescripteurs', icon: Star },
    { id: 'gestion-projet',      label: 'Gestion de Projet',   to: '/toptelsig/gestion-projet',icon: CheckSquare },
    { id: 'depenses',            label: 'Dépenses',            to: '/toptelsig/depenses',      icon: ArrowDownLeft },
  ],
  LIYA: [
    { id: 'livraisons',  label: 'Livraisons',          to: '/liya/livraisons', icon: Truck },
    { id: 'motos',       label: 'Motos & Flotte',      to: '/liya/motos',      icon: Bike },
    { id: 'stock3pl',    label: 'Stock Clients 3PL',   to: '/liya/stock3pl',   icon: Archive },
    { id: 'carte',       label: 'Carte GPS',           to: '/liya/carte',      icon: Map },
  ],
};

// Sections communes (toutes filiales sauf GROUPE)
const NAV_COMMUNS = [
  { id: 'stocks-c', label: 'Stocks & Approv.',  to: '/stocks', icon: Package },
  { id: 'rh-c',     label: 'RH & Équipes',      to: '/rh',     icon: Users },
];

const ENTITE_LABELS = {
  employes:'👥 Employé', souscripteurs:'🏠 Souscripteur', prescripteurs:'🤝 Prescripteur',
  lots:'📍 Lot', projets:'🏗 Projet', livraisons:'🛵 Livraison', motos:'🏍 Moto', produits:'📦 Produit',
};

export default function Layout() {
  const { user, filiale, setFiliale, setDernierEspace, logout } = useAuthStore();
  const [search, setSearch]               = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filialeOpen, setFilialeOpen]     = useState(false);
  const [searchOpen, setSearchOpen]       = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const searchRef = useRef(null);
  const navigate  = useNavigate();
  const location  = useLocation();

  const role   = user?.role || 'EMPLOYE';
  const color  = filiale === 'YAKRO_GRILL' ? '#8B1A1A' : filiale === 'LIYA' ? '#E85D04' : filiale === 'TOPTELSIG' ? '#27500A' : '#1a3f6f';
  const filInfo = FILIALES.find(f => f.key === filiale) || FILIALES[0];

  // Filtrer le menu selon les permissions du rôle
  const navItems = (NAV[filiale] || NAV.GROUPE).filter(item => canAccess(role, item.id));

  // Ctrl+K
  useEffect(() => {
    const h = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setSidebarOpen(false); setFilialeOpen(false); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // Mémoriser l'espace courant à chaque changement de filiale
  useEffect(() => {
    if (setDernierEspace) setDernierEspace(filiale);
  }, [filiale]);

  const handleSearch = async val => {
    setSearch(val);
    if (val.trim().length < 3) { setSearchResults(null); return; }
    setSearchLoading(true); setSearchOpen(true);
    try {
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

  const changerFiliale = f => {
    setFiliale(f.key);
    setFilialeOpen(false);
    setSidebarOpen(false);
    if (setDernierEspace) setDernierEspace(f.key);
    navigate(f.path);
  };

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout(); navigate('/login');
  };

  // Filiales accessibles selon le rôle
  const filialesAccessibles = FILIALES.filter(f => {
    if (role === 'DG' || user?.filiale === 'GROUPE') return true;
    if (f.key === 'GROUPE') return ['DIRECTEUR','MANAGER','COMPTABLE','RH'].includes(role);
    if (f.key === user?.filiale) return true;
    if (f.key === 'GROUPE') return true;
    return false;
  });

  const NavItems = ({ onItemClick }) => (
    <>
      {/* En-tête filiale */}
      <div style={{ padding:'12px 16px 6px', display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:16 }}>{filInfo.icon}</span>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color }}>{filInfo.label}</span>
      </div>

      {/* Items de navigation filtrés par rôle */}
      {navItems.map(item => (
        <NavLink key={item.to} to={item.to} onClick={onItemClick}
          style={({ isActive }) => ({
            display:'flex', alignItems:'center', gap:10, padding:'9px 16px',
            fontSize:13, color:isActive?'#1a1a1a':'#888780', textDecoration:'none',
            background:isActive?'#F1EFE8':'transparent', fontWeight:isActive?600:400,
            borderLeft:`2px solid ${isActive?color:'transparent'}`, transition:'all 0.1s',
          })}>
          <item.icon size={15}/>
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</span>
        </NavLink>
      ))}

      {/* Section Communs (hors GROUPE) */}
      {filiale !== 'GROUPE' && (
        <>
          <div style={{ padding:'12px 16px 4px', fontSize:9, fontWeight:600, letterSpacing:2, textTransform:'uppercase', color:'#aaa' }}>Communs</div>
          {NAV_COMMUNS.map(item => (
            <NavLink key={item.to} to={item.to} onClick={onItemClick}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:10, padding:'9px 16px',
                fontSize:13, color:isActive?'#1a1a1a':'#888780', textDecoration:'none',
                background:isActive?'#F1EFE8':'transparent', fontWeight:isActive?600:400,
                borderLeft:`2px solid ${isActive?color:'transparent'}`,
              })}>
              <item.icon size={15}/>{item.label}
            </NavLink>
          ))}
        </>
      )}

      {/* Portail en bas */}
      <div style={{ height:1, background:'#e8e7e1', margin:'8px 16px' }}/>
      <button onClick={()=>{ navigate('/portail'); setSidebarOpen(false); }}
        style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 16px', fontSize:13, color:'#888', background:'transparent', border:'none', cursor:'pointer', width:'100%', textAlign:'left' }}>
        <Home size={15}/> Changer d'espace
      </button>
    </>
  );

  return (
    <div className="app-layout">
      {/* ── TOPBAR ──────────────────────────────────────── */}
      <header className="app-topbar" style={{ borderBottom:`2px solid ${color}20` }}>
        <button className="hamburger-btn" onClick={()=>setSidebarOpen(!sidebarOpen)}
          style={{ background:'none', border:'none', cursor:'pointer', padding:6, color:'#555', display:'flex', alignItems:'center' }}>
          {sidebarOpen ? <X size={20}/> : <Menu size={20}/>}
        </button>

        {/* Logo */}
        <div className="topbar-logo" style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:'#E87722', fontWeight:900 }}>2</span>
          <span style={{ color:'#1a3f6f', fontWeight:900 }}>iG</span>
          <span style={{ fontSize:9, fontWeight:500, color:'#888', letterSpacing:2, textTransform:'uppercase' }}>ERP</span>
        </div>

        {/* Sélecteur filiale */}
        <div style={{ position:'relative', flexShrink:0 }}>
          <button onClick={()=>setFilialeOpen(!filialeOpen)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', background:`${color}12`, border:`1px solid ${color}30`, borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:600, color }}>
            <span>{filInfo.icon}</span>
            <span className="filiale-label" style={{ maxWidth:100, overflow:'hidden', textOverflow:'ellipsis' }}>
              {filInfo.label}
            </span>
            <ChevronDown size={11}/>
          </button>
          {filialeOpen && (
            <>
              <div onClick={()=>setFilialeOpen(false)} style={{ position:'fixed', inset:0, zIndex:199 }}/>
              <div style={{ position:'absolute', top:'100%', left:0, marginTop:4, background:'white', border:'0.5px solid #e8e7e1', borderRadius:12, padding:4, zIndex:200, minWidth:200, boxShadow:'0 8px 32px rgba(0,0,0,0.12)' }}>
                <div style={{ padding:'4px 12px 6px', fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#aaa' }}>Changer d'espace</div>
                {filialesAccessibles.map(f=>(
                  <button key={f.key} onClick={()=>changerFiliale(f)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', border:'none', background:filiale===f.key?`${f.color}10`:'transparent', cursor:'pointer', width:'100%', textAlign:'left', fontSize:13, borderRadius:8, color:filiale===f.key?f.color:'#555', fontWeight:filiale===f.key?700:400 }}>
                    <span style={{ fontSize:16 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontWeight:600 }}>{f.label}</div>
                      {filiale===f.key && <div style={{ fontSize:10, color:f.color }}>Espace actuel</div>}
                    </div>
                    {filiale===f.key && <span style={{ marginLeft:'auto', fontSize:10, color:f.color }}>✓</span>}
                  </button>
                ))}
                {/* Aller au portail */}
                <div style={{ height:1, background:'#e8e7e1', margin:'4px 8px' }}/>
                <button onClick={()=>{ setFilialeOpen(false); navigate('/portail'); }}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', width:'100%', textAlign:'left', fontSize:12, borderRadius:8, color:'#888' }}>
                  <Home size={13}/> Retour au portail
                </button>
              </div>
            </>
          )}
        </div>

        {/* Recherche */}
        <div className="topbar-search" style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#F1EFE8', border:`0.5px solid ${searchOpen?color:'#e8e7e1'}`, borderRadius:20, padding:'6px 12px' }}>
            <Search size={13} color="#888" style={{ flexShrink:0 }}/>
            <input ref={searchRef} value={search} onChange={e=>handleSearch(e.target.value)}
              onFocus={()=>search.length>=3&&setSearchOpen(true)}
              placeholder="Rechercher… (Ctrl+K)"
              style={{ border:'none', background:'transparent', fontSize:12, outline:'none', width:'100%', minWidth:0 }}/>
            {search && <button onClick={()=>{setSearch('');setSearchResults(null);setSearchOpen(false);}} style={{ background:'none', border:'none', cursor:'pointer', color:'#888', padding:0, flexShrink:0 }}>✕</button>}
          </div>
          {searchOpen && (searchLoading||searchResults) && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'white', border:'0.5px solid #e8e7e1', borderRadius:10, zIndex:300, maxHeight:360, overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.12)' }}>
              {searchLoading
                ? <div style={{ padding:'12px 16px', fontSize:13, color:'#888' }}>Recherche…</div>
                : searchResults?.nbResultats===0
                  ? <div style={{ padding:'12px 16px', fontSize:13, color:'#888' }}>Aucun résultat</div>
                  : Object.entries(searchResults?.resultats||{}).map(([entite,items])=>{
                      if(!items?.length) return null;
                      return (
                        <div key={entite}>
                          <div style={{ padding:'6px 16px 2px', fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'#aaa' }}>{ENTITE_LABELS[entite]}</div>
                          {items.map((item,i)=>{
                            const label=`${item.prenom||''} ${item.nom||item.immatriculation||''}`.trim()||item.numero||item.code||item.reference||'—';
                            return (
                              <div key={i} onClick={()=>handleResult(entite,item)}
                                style={{ padding:'8px 16px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13 }}
                                onMouseEnter={e=>e.currentTarget.style.background='#F1EFE8'}
                                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                {label}<ChevronRight size={12} color="#ccc"/>
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

        <NotifCentre color={color}/>
        {/* User + infos + logout */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:`${color}15`, border:`1.5px solid ${color}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color, flexShrink:0 }}>
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div style={{ lineHeight:1.2 }} className="user-info">
            <div style={{ fontSize:12, fontWeight:600 }}>{user?.prenom} {user?.nom}</div>
            <div style={{ fontSize:10, color:'#888' }}>{user?.role}</div>
          </div>
          <button onClick={handleLogout} title="Déconnexion"
            style={{ background:'none', border:'none', cursor:'pointer', color:'#888', padding:4, display:'flex', alignItems:'center' }}>
            <LogOut size={16}/>
          </button>
        </div>
      </header>

      {/* Overlay mobile */}
      <div className={`sidebar-overlay ${sidebarOpen?'open':''}`} onClick={()=>setSidebarOpen(false)}/>

      {/* ── SIDEBAR ─────────────────────────────────────── */}
      <aside className={`app-sidebar ${sidebarOpen?'open':''}`}>
        <NavItems onItemClick={()=>setSidebarOpen(false)}/>
        <div style={{ height:40 }}/>
      </aside>

      {/* ── MAIN ────────────────────────────────────────── */}
      <main className="app-main">
        <Outlet/>
      </main>
    </div>
  );
}
