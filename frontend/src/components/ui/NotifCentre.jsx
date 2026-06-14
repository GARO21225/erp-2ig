/**
 * Centre de Notifications — Cloche dans la topbar
 * Alertes temps réel depuis /dashboard/alertes
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { alertesAPI } from '../../lib/api';
import { Bell } from 'lucide-react';

const GRAVITE = {
  CRITIQUE: { bg:'#FCEBEB', color:'#A32D2D', badge:'#A32D2D' },
  ATTENTION: { bg:'#FAEEDA', color:'#BA7517', badge:'#BA7517' },
  INFO:      { bg:'#EEF3FB', color:'#1a3f6f', badge:'#1a3f6f' },
};

const FILIALE_ROUTE = {
  TOPTELSIG: '/toptelsig/ventes',
  YAKRO_GRILL: '/yakro/dashboard',
  LIYA: '/liya/motos',
  GROUPE: '/dashboard',
};

export default function NotifCentre({ color = '#1a3f6f' }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['alertes-notif'],
    queryFn: alertesAPI.critiques,
    staleTime: 60000,
    refetchInterval: 120000, // refresh toutes les 2 minutes
  });

  const alertes = data?.alertes || [];
  const critiques = data?.critiques || 0;

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
              <span style={{ fontSize:11, color:'#888' }}>{alertes.length} alerte(s)</span>
            </div>
            <div style={{ maxHeight:360, overflowY:'auto' }}>
              {alertes.length === 0 ? (
                <div style={{ padding:20, textAlign:'center', color:'#888', fontSize:13 }}>✅ Aucune alerte</div>
              ) : alertes.map((a, i) => {
                const st = GRAVITE[a.gravite] || GRAVITE.INFO;
                return (
                  <div key={i} onClick={()=>{ navigate(FILIALE_ROUTE[a.filiale]||'/dashboard'); setOpen(false); }}
                    style={{ padding:'10px 16px', borderBottom:'0.5px solid #f0efe9', cursor:'pointer', background:'white', display:'flex', gap:10, alignItems:'flex-start' }}
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
              <button onClick={()=>{ navigate('/dashboard'); setOpen(false); }}
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
