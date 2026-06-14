/**
 * Centre d'Actions — Affiche ce que l'utilisateur doit faire
 * Connecté aux données réelles : dépenses à valider, relances, stocks, etc.
 */
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store';
import { toptelsigAPI, depensesAPIv2, yakroAPI, liyaAPI } from '../../lib/api';

const ROLE_ACTIONS = {
  DG:           ['depenses_valider','echeanciers_retard','prospects_relancer','stock_bas','motos_assurance'],
  DIRECTEUR:    ['depenses_valider','echeanciers_retard','prospects_relancer','stock_bas'],
  MANAGER:      ['depenses_valider','prospects_relancer','stock_bas'],
  COMMERCIAL:   ['prospects_relancer','echeanciers_retard'],
  COMPTABLE:    ['depenses_valider','echeanciers_retard'],
  CAISSIER:     ['commandes_ouvertes'],
  SERVEUR:      ['commandes_ouvertes'],
  MAGASINIER:   ['stock_bas'],
  RESP_FONCIER: ['prospects_relancer','echeanciers_retard'],
  RESP_LIVRAISON:['livraisons_attente','motos_assurance'],
  LIVREUR:      ['livraisons_attente'],
};

export default function CentreActions({ filiale = 'GROUPE' }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const role = user?.role || 'EMPLOYE';
  const actionsVoulues = ROLE_ACTIONS[role] || [];

  // Charger les données selon la filiale et le rôle
  const { data: depAttente } = useQuery({
    queryKey: ['actions-depenses'],
    queryFn: () => depensesAPIv2.list({ statut: 'VALIDATION_DIR', limit: 5 }),
    staleTime: 60000,
    enabled: actionsVoulues.includes('depenses_valider') && (filiale==='TOPTELSIG'||filiale==='GROUPE'),
  });

  const { data: retards } = useQuery({
    queryKey: ['actions-retards'],
    queryFn: () => toptelsigAPI.ventesListe({ statut_ech: 'RETARD', limit: 5 }),
    staleTime: 60000,
    enabled: actionsVoulues.includes('echeanciers_retard') && (filiale==='TOPTELSIG'||filiale==='GROUPE'),
  });

  const { data: prospectsData } = useQuery({
    queryKey: ['actions-prospects'],
    queryFn: () => toptelsigAPI.crmProspects({ relanceRequise: true, limit: 5 }),
    staleTime: 60000,
    enabled: actionsVoulues.includes('prospects_relancer') && (filiale==='TOPTELSIG'||filiale==='GROUPE'),
  });

  const { data: livAttente } = useQuery({
    queryKey: ['actions-livraisons'],
    queryFn: () => liyaAPI.livraisons({ statut: 'EN_ATTENTE', limit: 5 }),
    staleTime: 30000,
    enabled: actionsVoulues.includes('livraisons_attente') && (filiale==='LIYA'||filiale==='GROUPE'),
  });

  // Construire les actions
  const actions = [];

  const nbDep = (Array.isArray(depAttente) ? depAttente : depAttente?.data || []).length;
  if (nbDep > 0 && actionsVoulues.includes('depenses_valider')) {
    actions.push({ id:'dep', icon:'📋', titre:`${nbDep} dépense(s) à valider`, detail:'En attente de votre validation', urgence:'ATTENTION', route:'/toptelsig/depenses' });
  }

  const retardsArr = Array.isArray(retards) ? retards : (retards?.data || []);
  const nbRetards = retardsArr.reduce((s,v)=>(v.echeanciers||[]).filter(e=>e.statut==='RETARD').length+s,0);
  if (nbRetards > 0 && actionsVoulues.includes('echeanciers_retard')) {
    actions.push({ id:'ret', icon:'⚠️', titre:`${nbRetards} paiement(s) en retard`, detail:'Échéanciers TOPTELSIG', urgence:'CRITIQUE', route:'/toptelsig/ventes' });
  }

  const nbProspects = (Array.isArray(prospectsData) ? prospectsData : prospectsData?.data || []).length;
  if (nbProspects > 0 && actionsVoulues.includes('prospects_relancer')) {
    actions.push({ id:'pros', icon:'📞', titre:`${nbProspects} prospect(s) à relancer`, detail:'CRM TOPTELSIG', urgence:'INFO', route:'/toptelsig/prospects' });
  }

  const nbLiv = (Array.isArray(livAttente) ? livAttente : livAttente?.data || []).length;
  if (nbLiv > 0 && actionsVoulues.includes('livraisons_attente')) {
    actions.push({ id:'liv', icon:'🚚', titre:`${nbLiv} livraison(s) en attente`, detail:'À prendre en charge', urgence:'ATTENTION', route:'/liya/livraisons' });
  }

  if (actions.length === 0) return null;

  const URGENCE_STYLE = {
    CRITIQUE: { bg:'#FCEBEB', color:'#A32D2D', border:'#F7C1C1' },
    ATTENTION: { bg:'#FAEEDA', color:'#BA7517', border:'#F0D4A0' },
    INFO:      { bg:'#EEF3FB', color:'#1a3f6f', border:'#C5D8F4' },
  };

  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, color:'#333' }}>🎯 Centre d'actions</div>
        <span style={{ background:'#A32D2D', color:'white', borderRadius:10, padding:'1px 8px', fontSize:11, fontWeight:600 }}>
          {actions.filter(a=>a.urgence==='CRITIQUE').length > 0 ? `${actions.filter(a=>a.urgence==='CRITIQUE').length} urgent` : `${actions.length}`}
        </span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {actions.map(a => {
          const st = URGENCE_STYLE[a.urgence] || URGENCE_STYLE.INFO;
          return (
            <div key={a.id} onClick={()=>navigate(a.route)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px',
                background:st.bg, borderRadius:9, border:`1px solid ${st.border}`,
                cursor:'pointer', transition:'opacity 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.opacity='0.8'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              <span style={{ fontSize:18, flexShrink:0 }}>{a.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13, color:st.color }}>{a.titre}</div>
                <div style={{ fontSize:11, color:st.color, opacity:0.8 }}>{a.detail}</div>
              </div>
              <span style={{ fontSize:16, color:st.color, opacity:0.6 }}>→</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
