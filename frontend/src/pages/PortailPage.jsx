/**
 * PORTAIL ENTREPRISE — Page d'accueil après connexion
 * Sélection d'espace + dashboard adapté au rôle
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';

const ESPACES = [
  {
    id: 'GROUPE',
    label: 'Groupe 2IG',
    desc: 'Commandement, Finance, RH, Accès',
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
    path: '/toptelsig/prospects',
    roles: ['DG','DIRECTEUR','MANAGER','RESP_FONCIER','COMMERCIAL','COMPTABLE'],
  },
  {
    id: 'YAKRO_GRILL',
    label: 'Yakro Grill',
    desc: 'Restaurant · Plan de salle · Caisse · Stocks',
    icon: '🍽',
    color: '#8B1A1A',
    bg: 'linear-gradient(135deg, #8B1A1A 0%, #c0392b 100%)',
    path: '/yakro/pos',
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
  COMMERCIAL:'Commercial', CAISSIER:'Caissier', SERVEUR:'Serveur',
  MAGASINIER:'Magasinier', RESP_LIVRAISON:'Responsable Livraison', LIVREUR:'Livreur',
  EMPLOYE:'Employé',
};

export default function PortailPage() {
  const navigate = useNavigate();
  const { user, filiale, setFiliale, dernierEspace, setDernierEspace } = useAuthStore();

  // Mémoire du dernier espace — redirection automatique
  useEffect(() => {
    if (dernierEspace && dernierEspace !== 'PORTAIL') {
      const espace = ESPACES.find(e => e.id === dernierEspace);
      if (espace) {
        setFiliale(dernierEspace);
        navigate(espace.path);
      }
    }
  }, []);

  const choisirEspace = (espace) => {
    setFiliale(espace.id);
    if (setDernierEspace) setDernierEspace(espace.id);
    navigate(espace.path);
  };

  const espacesDispo = ESPACES.filter(e =>
    user?.role === 'DG' ||
    user?.filiale === 'GROUPE' ||
    e.roles.includes(user?.role) ||
    e.id === user?.filiale
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1b2a 0%, #1a3f6f 50%, #0d2a1a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Inter', sans-serif",
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48, color: 'white' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
        <h1 style={{ margin: 0, fontFamily: 'Syne', fontWeight: 900, fontSize: 36, letterSpacing: -1 }}>
          Groupe 2IG
        </h1>
        <p style={{ margin: '8px 0 4px', opacity: 0.8, fontSize: 16 }}>
          Bienvenue, <strong>{user?.prenom} {user?.nom}</strong>
        </p>
        <p style={{ margin: 0, opacity: 0.6, fontSize: 13 }}>
          {ROLE_LABELS[user?.role] || user?.role} · Choisissez votre espace de travail
        </p>
      </div>

      {/* Cartes espaces */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(espacesDispo.length, 2)}, 1fr)`,
        gap: 20,
        width: '100%', maxWidth: 860,
      }}>
        {espacesDispo.map(espace => (
          <button key={espace.id} onClick={() => choisirEspace(espace)}
            style={{
              background: espace.bg,
              border: 'none', borderRadius: 16,
              padding: '32px 28px',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'white',
              transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'; }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{espace.icon}</div>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 22, marginBottom: 6 }}>
              {espace.label}
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>{espace.desc}</div>
            <div style={{
              position: 'absolute', right: 20, top: 20,
              fontSize: 10, background: 'rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '3px 10px', fontWeight: 600,
            }}>
              Accéder →
            </div>
          </button>
        ))}
      </div>

      {/* Bouton voir toutes les entreprises (DG) */}
      {espacesDispo.length < ESPACES.length && (
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 24 }}>
          Accès limité à votre filiale
        </p>
      )}
    </div>
  );
}
