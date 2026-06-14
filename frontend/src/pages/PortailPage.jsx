/**
 * PORTAIL ENTREPRISE — Page d'accueil après connexion
 * Sélection d'espace + redirection vers le bon dashboard
 * Mémorise le dernier espace dans le store persisté
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';

const ESPACES = [
  {
    id: 'GROUPE',
    label: 'Groupe 2iG',
    desc: 'Commandement · Finance · RH · Accès & Rôles',
    icon: '🏛',
    color: '#1a3f6f',
    bg: 'linear-gradient(135deg, #1a3f6f 0%, #2d5fa0 100%)',
    path: '/dashboard',
    roles: ['DG','DIRECTEUR','MANAGER','RH','COMPTABLE','EMPLOYE'],
  },
  {
    id: 'TOPTELSIG',
    label: 'TOPTELSIG',
    desc: 'Immobilier Foncier · CRM · Lots · Souscripteurs',
    icon: '🏘',
    color: '#27500A',
    bg: 'linear-gradient(135deg, #27500A 0%, #4a8a1a 100%)',
    path: '/toptelsig/dashboard',
    roles: ['DG','DIRECTEUR','MANAGER','RESP_FONCIER','COMMERCIAL','COMPTABLE'],
  },
  {
    id: 'YAKRO_GRILL',
    label: 'Yakro Grill',
    desc: 'Restaurant · Plan de salle · Caisse · Stocks',
    icon: '🍽',
    color: '#8B1A1A',
    bg: 'linear-gradient(135deg, #8B1A1A 0%, #c0392b 100%)',
    path: '/yakro/dashboard',
    roles: ['DG','DIRECTEUR','MANAGER','CAISSIER','SERVEUR','MAGASINIER'],
  },
  {
    id: 'LIYA',
    label: 'LiYA Logistics',
    desc: 'Livraisons · Motos · Stock 3PL · Partenaires',
    icon: '🚚',
    color: '#E85D04',
    bg: 'linear-gradient(135deg, #E85D04 0%, #f5831f 100%)',
    path: '/liya/livraisons',
    roles: ['DG','DIRECTEUR','MANAGER','RESP_LIVRAISON','LIVREUR','MAGASINIER'],
  },
];

const ROLE_LABELS = {
  DG:'Directeur Général', DIRECTEUR:'Directeur', MANAGER:'Manager',
  RH:'Responsable RH', COMPTABLE:'Comptable', RESP_FONCIER:'Responsable Foncier',
  COMMERCIAL:'Commercial Foncier', CAISSIER:'Caissier', SERVEUR:'Serveur',
  MAGASINIER:'Magasinier', RESP_LIVRAISON:'Responsable Livraison', LIVREUR:'Livreur',
  EMPLOYE:'Employé',
};

export default function PortailPage() {
  const navigate = useNavigate();
  const { user, filiale, setFiliale, dernierEspace, setDernierEspace } = useAuthStore();
  const [hovered, setHovered] = useState(null);
  const [autoRedirect, setAutoRedirect] = useState(null);

  const role = user?.role || 'EMPLOYE';

  // Filiales accessibles selon le rôle
  const espacesDispo = ESPACES.filter(e => {
    if (role === 'DG' || user?.filiale === 'GROUPE') return true;
    if (user?.filiale === e.id) return true;
    if (e.id === 'GROUPE') return ['DIRECTEUR','MANAGER','COMPTABLE','RH'].includes(role);
    return e.roles.includes(role);
  });

  // Si un seul espace accessible → rediriger directement
  useEffect(() => {
    if (espacesDispo.length === 1) {
      choisirEspace(espacesDispo[0]);
      return;
    }
    // Mémoriser dernier espace utilisé
    if (dernierEspace && dernierEspace !== 'PORTAIL') {
      const espace = espacesDispo.find(e => e.id === dernierEspace);
      if (espace) {
        setAutoRedirect(espace);
        // Compte à rebours de 3s puis rediriger
        const t = setTimeout(() => choisirEspace(espace), 3000);
        return () => clearTimeout(t);
      }
    }
  }, []);

  const choisirEspace = (espace) => {
    setFiliale(espace.id);
    if (setDernierEspace) setDernierEspace(espace.id);
    navigate(espace.path);
  };

  return (
    <div style={{
      minHeight:'100vh', position:'relative', overflow:'hidden',
      background:'linear-gradient(135deg, #0d1b2a 0%, #1a3f6f 50%, #0d2a1a 100%)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:24, fontFamily:"'Inter', sans-serif",
    }}>
      {/* Fond décoratif */}
      <div style={{ position:'absolute', top:-100, right:-100, width:400, height:400, borderRadius:'50%', background:'rgba(255,255,255,0.02)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:-150, left:-100, width:500, height:500, borderRadius:'50%', background:'rgba(255,255,255,0.02)', pointerEvents:'none' }}/>

      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:48, color:'white', zIndex:1 }}>
        <div style={{ fontSize:18, fontWeight:900, letterSpacing:3, opacity:0.6, marginBottom:8 }}>GROUPE</div>
        <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:900, fontSize:42, letterSpacing:-2 }}>
          2<span style={{ color:'#E87722' }}>i</span>G
        </h1>
        <div style={{ width:60, height:2, background:'linear-gradient(to right, #E87722, #1a3f6f)', margin:'12px auto', borderRadius:2 }}/>
        <p style={{ margin:'8px 0 4px', opacity:0.8, fontSize:18 }}>
          Bienvenue, <strong>{user?.prenom} {user?.nom}</strong>
        </p>
        <p style={{ margin:0, opacity:0.5, fontSize:13 }}>
          {ROLE_LABELS[role] || role} · Choisissez votre espace de travail
        </p>
      </div>

      {/* Notification de redirection automatique */}
      {autoRedirect && (
        <div style={{ background:'rgba(255,255,255,0.1)', backdropFilter:'blur(10px)', borderRadius:10, padding:'10px 20px', marginBottom:24, color:'white', fontSize:13, display:'flex', alignItems:'center', gap:10, zIndex:1 }}>
          <span style={{ fontSize:18 }}>{autoRedirect.icon}</span>
          Redirection automatique vers <strong>{autoRedirect.label}</strong> dans 3s…
          <button onClick={()=>setAutoRedirect(null)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:6, color:'white', padding:'2px 8px', cursor:'pointer', fontSize:11 }}>
            Annuler
          </button>
        </div>
      )}

      {/* Grille des espaces */}
      <div style={{
        display:'grid',
        gridTemplateColumns:espacesDispo.length <= 2 ? '1fr 1fr' : 'repeat(2, 1fr)',
        gap:20, width:'100%', maxWidth:880, zIndex:1,
      }}>
        {espacesDispo.map(espace => (
          <button key={espace.id} onClick={()=>choisirEspace(espace)}
            onMouseEnter={()=>setHovered(espace.id)}
            onMouseLeave={()=>setHovered(null)}
            style={{
              background: espace.bg,
              border: hovered===espace.id ? `2px solid rgba(255,255,255,0.4)` : '2px solid transparent',
              borderRadius:16, padding:'28px 24px',
              cursor:'pointer', textAlign:'left', color:'white',
              transform: hovered===espace.id ? 'translateY(-6px) scale(1.01)' : 'none',
              boxShadow: hovered===espace.id ? '0 20px 60px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.25)',
              transition:'all 0.2s ease',
              position:'relative', overflow:'hidden',
            }}>
            {/* Badge dernier espace */}
            {dernierEspace === espace.id && (
              <div style={{ position:'absolute', top:12, right:12, fontSize:9, background:'rgba(255,255,255,0.2)', borderRadius:8, padding:'2px 8px', fontWeight:600, letterSpacing:1 }}>
                DERNIER UTILISÉ
              </div>
            )}
            {/* Fond décoratif card */}
            <div style={{ position:'absolute', bottom:-20, right:-20, fontSize:80, opacity:0.1 }}>{espace.icon}</div>

            <div style={{ fontSize:36, marginBottom:12, position:'relative' }}>{espace.icon}</div>
            <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:22, marginBottom:6, position:'relative' }}>{espace.label}</div>
            <div style={{ fontSize:12, opacity:0.8, lineHeight:1.5, position:'relative' }}>{espace.desc}</div>

            {/* Flèche */}
            <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:6, fontSize:12, opacity:hovered===espace.id?1:0.6, transition:'opacity 0.2s', position:'relative' }}>
              Accéder <span style={{ fontSize:16 }}>→</span>
            </div>
          </button>
        ))}
      </div>

      {/* Info bas */}
      {espacesDispo.length < ESPACES.length && (
        <p style={{ color:'rgba(255,255,255,0.3)', fontSize:11, marginTop:24, zIndex:1 }}>
          Accès limité à votre filiale · {ROLE_LABELS[role]}
        </p>
      )}
    </div>
  );
}
