/**
 * Centre de Notifications — Cloche dans la topbar
 * Alertes temps réel depuis /dashboard/alertes
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { alertesAPI } from '../../lib/api';
import { Bell, Volume2, VolumeX } from 'lucide-react';
import { useAuthStore, useRestoStore } from '../../store';
import { useNotifs } from '../../lib/useNotifs';

const GRAVITE = {
  CRITIQUE: { bg:'#FCEBEB', color:'#A32D2D', badge:'#A32D2D' },
  ATTENTION: { bg:'#FAEEDA', color:'#BA7517', badge:'#BA7517' },
  INFO:      { bg:'#EEF3FB', color:'#1a3f6f', badge:'#1a3f6f' },
};

// Tableau de bord de l'espace actif (et non celui du Groupe)
const DASHBOARD_ESPACE = { GROUPE: '/dashboard', YAKRO_GRILL: '/yakro/dashboard', TOPTELSIG: '/toptelsig/dashboard', EXPERTS: '/experts/dashboard', LIYA: '/liya/livraisons' };

const FILIALE_ROUTE = {
  TOPTELSIG: '/toptelsig/ventes',
  YAKRO_GRILL: '/yakro/dashboard',
  LIYA: '/liya/motos',
  GROUPE: '/dashboard',
};

const lireLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
const cleA = (a) => `${a.filiale}|${a.message}|${a.detail || ''}`;

export default function NotifCentre({ color = '#1a3f6f' }) {
  const [open, setOpen] = useState(false);
  const cleLS = `notif_etat_${useAuthStore.getState().user?.id || 'x'}`;
  const [etat, setEtat] = useState(() => lireLS(cleLS)); // { cle: 'lu' | 'efface' }
  const marquer = (cle, v) => setEtat(e => { const n = { ...e, [cle]: v }; try { localStorage.setItem(cleLS, JSON.stringify(n)); } catch { /* ignore */ } return n; });
  const navigate = useNavigate();
  const filialeActive = useAuthStore(s => s.filiale);
  const dashboardEspace = DASHBOARD_ESPACE[filialeActive] || '/dashboard';
  const userId = useAuthStore(s => s.user?.id);
  const restaurantId = useRestoStore(s => s.restaurantId);
  // Notifications personnelles (ce qui m'est assigné) : son + vibration pour chaque nouveauté
  const { items: perso, son, basculer } = useNotifs({ actif: filialeActive === 'YAKRO_GRILL', userId, restaurantId });

  const { data } = useQuery({
    queryKey: ['alertes-notif'],
    queryFn: alertesAPI.critiques,
    staleTime: 60000,
    refetchInterval: 120000, // refresh toutes les 2 minutes
  });

  const toutes = data?.alertes || [];
  const alertes = toutes.filter(a => etat[cleA(a)] !== 'efface');
  const persoVisibles = perso.filter(n => etat[n.id] !== 'efface');
  const nbLues = persoVisibles.filter(n => etat[n.id] === 'lu').length + alertes.filter(a => etat[cleA(a)] === 'lu').length;
  const nonLuesAlertes = alertes.filter(a => etat[cleA(a)] !== 'lu' && a.gravite === 'CRITIQUE').length;
  const critiques = nonLuesAlertes + persoVisibles.filter(n => etat[n.id] !== 'lu').length;
  const effacerLues = () => setEtat(e => {
    const n = { ...e };
    [...persoVisibles.map(x => x.id), ...alertes.map(cleA)].forEach(k => { if (n[k] === 'lu') n[k] = 'efface'; });
    try { localStorage.setItem(cleLS, JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  });

  return (
    <div style={{ position:'relative' }}>
      <button onClick={()=>setOpen(!open)}
        style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:6, color:'#666', display:'flex', alignItems:'center' }}>
        <Bell size={18}/>
        {critiques > 0 && (
          <span style={{ position:'absolute', top:2, right:2, width:16, height:16, background:'#A32D2D', color:'white', borderRadius:'50%', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {critiques > 9 ? '9+' : critiques}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={()=>setOpen(false)} style={{ position:'fixed', inset:0, zIndex:299 }}/>
          <div style={{ position:'absolute', top:'100%', right:0, marginTop:6, width:320, background:'white', border:'0.5px solid #e8e7e1', borderRadius:12, zIndex:300, boxShadow:'0 8px 32px rgba(0,0,0,0.12)', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8e7e1', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13 }}>🔔 Alertes</div>
              <span style={{ fontSize:11, color:'#888', display:'flex', alignItems:'center', gap:8 }}>
                {persoVisibles.length + alertes.length} élément(s)
                {nbLues > 0 && <button type="button" onClick={effacerLues} style={{ fontSize:11, color:'#A32D2D', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>🗑 Effacer les lues ({nbLues})</button>}
                {filialeActive === 'YAKRO_GRILL' && <button type="button" onClick={basculer} aria-pressed={son} aria-label={son ? 'Couper le son et la vibration' : 'Activer le son et la vibration'} title={son ? 'Son et vibration activés' : 'Son coupé'} style={{ background:'none', border:'none', cursor:'pointer', padding:4, color: son ? '#8B1A1A' : '#aaa', display:'flex' }}>{son ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button>}
              </span>
            </div>
            <div style={{ maxHeight:360, overflowY:'auto' }}>
              {persoVisibles.length > 0 && <div style={{ padding:'6px 16px', fontSize:10, fontWeight:700, letterSpacing:.5, color:'#8B1A1A', background:'#FDF2F2' }}>POUR VOUS</div>}
              {persoVisibles.map((n) => (
                <div key={n.id} onClick={()=>{ marquer(n.id, 'lu'); navigate(n.lien || dashboardEspace); setOpen(false); }}
                  style={{ padding:'10px 16px', borderBottom:'0.5px solid #f0efe9', cursor:'pointer', background:'white', display:'flex', gap:10, alignItems:'flex-start', opacity: etat[n.id] === 'lu' ? .5 : 1 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: n.niveau === 'alerte' ? '#A32D2D' : '#BA7517', marginTop:4, flexShrink:0 }}/>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#333' }}>{n.titre}</div>
                    <div style={{ fontSize:11, color:'#666', marginTop:1 }}>{n.detail}</div>
                  </div>
                </div>
              ))}
              {persoVisibles.length > 0 && alertes.length > 0 && <div style={{ padding:'6px 16px', fontSize:10, fontWeight:700, letterSpacing:.5, color:'#888', background:'#F7F7F5' }}>ALERTES</div>}
              {alertes.length === 0 && persoVisibles.length === 0 ? (
                <div style={{ padding:20, textAlign:'center', color:'#888', fontSize:13 }}>✅ Aucune alerte</div>
              ) : alertes.map((a, i) => {
                const st = GRAVITE[a.gravite] || GRAVITE.INFO;
                return (
                  <div key={i} onClick={()=>{ marquer(cleA(a), 'lu'); navigate(FILIALE_ROUTE[a.filiale]||dashboardEspace); setOpen(false); }}
                    style={{ padding:'10px 16px', borderBottom:'0.5px solid #f0efe9', cursor:'pointer', background:'white', display:'flex', gap:10, alignItems:'flex-start', opacity: etat[cleA(a)] === 'lu' ? .5 : 1 }}
                    onMouseEnter={e=>e.currentTarget.style.background='#F7F7F5'}
                    onMouseLeave={e=>e.currentTarget.style.background='white'}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:st.badge, marginTop:4, flexShrink:0 }}/>
                    <div>
                      <div style={{ fontSize:12, fontWeight:500, color:'#333' }}>{a.message}</div>
                      {a.detail && <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{a.detail}</div>}
                      <div style={{ fontSize:10, color:st.color, marginTop:2, fontWeight:600 }}>{a.gravite} · {a.filiale}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding:'8px 16px', borderTop:'1px solid #e8e7e1', textAlign:'center' }}>
              <button onClick={()=>{ navigate(dashboardEspace); setOpen(false); }}
                style={{ fontSize:11, color:'#1a3f6f', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                Voir le tableau de bord →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
