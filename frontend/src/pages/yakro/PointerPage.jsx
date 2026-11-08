import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, LogOut, AlertTriangle, Loader2 } from 'lucide-react';
import { yakroAPI } from '../../lib/api';
import { useAuthStore, useRestoStore } from '../../store';

const heure = (d) => new Date(d).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });
const dateLongue = (d) => new Date(d).toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const duree = (min) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;

/** Page ouverte par le QR code : enregistre l'entrée ou la sortie et confirme avec date et heure. */
export default function PointerPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const setFiliale = useAuthStore(s => s.setFiliale);
  const setRestaurant = useRestoStore(s => s.setRestaurant);
  const [etat, setEtat] = useState({ statut: 'chargement' });
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return; lance.current = true;
    const q = new URLSearchParams(window.location.search);
    const restaurantId = q.get('r'), jeton = q.get('t');
    // Le lien du QR ne doit pas pouvoir être rejoué en rechargeant la page
    window.history.replaceState({}, '', '/yakro/pointer');
    if (!restaurantId || !jeton) return setEtat({ statut: 'erreur', message: 'QR code incomplet — scannez à nouveau le QR affiché au restaurant.' });
    yakroAPI.pointageScan({ restaurantId, jeton })
      .then(r => { setFiliale('YAKRO_GRILL'); setRestaurant(restaurantId); setEtat({ statut: 'ok', r }); })
      .catch(e => setEtat({ statut: 'erreur', message: e?.error || e?.response?.data?.error || e?.message || 'Pointage impossible', r: e?.response?.data }));
  }, []);

  const entree = etat.r?.action === 'ENTREE';
  const couleur = etat.statut === 'ok' ? (entree ? '#3C7A37' : '#8B1A1A') : '#A32D2D';
  return (
    <div style={{ minHeight: '100dvh', background: '#FAF6F0', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'white', borderRadius: 22, boxShadow: '0 0 0 1px rgba(32,25,21,.09), 0 12px 32px rgba(32,25,21,.1)', overflow: 'hidden' }}>
        <div style={{ background: couleur, color: 'white', padding: '28px 20px', textAlign: 'center' }}>
          {etat.statut === 'chargement' && <Loader2 size={44} style={{ animation: 'spin 1s linear infinite' }} />}
          {etat.statut === 'ok' && (entree ? <LogIn size={44} /> : <LogOut size={44} />)}
          {etat.statut === 'erreur' && <AlertTriangle size={44} />}
          <h1 style={{ margin: '10px 0 0', fontFamily: 'Syne', fontWeight: 800, fontSize: 24 }}>
            {etat.statut === 'chargement' ? 'Pointage en cours…' : etat.statut === 'ok' ? (entree ? 'Entrée enregistrée' : 'Sortie enregistrée') : 'Pointage non enregistré'}
          </h1>
        </div>
        <div style={{ padding: 22, textAlign: 'center' }}>
          {etat.statut === 'ok' && (
            <>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{etat.r.nom}</div>
              <div style={{ color: '#6B5F57', fontSize: 13, marginBottom: 14 }}>{etat.r.restaurant}</div>
              <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 44, lineHeight: 1 }}>{heure(etat.r.at)}</div>
              <div style={{ color: '#6B5F57', fontSize: 14, textTransform: 'capitalize', marginTop: 4 }}>{dateLongue(etat.r.at)}</div>
              {!entree && (
                <div style={{ marginTop: 16, background: '#FAF6F0', borderRadius: 12, padding: 12, fontSize: 13, textAlign: 'left', display: 'grid', gap: 4 }}>
                  <div>Arrivée : <b>{heure(etat.r.entreeLe)}</b> · Départ : <b>{heure(etat.r.at)}</b></div>
                  <div>Temps de présence : <b>{duree(etat.r.dureeMin)}</b></div>
                  <div>Commandes prises : <b>{etat.r.activite?.commandes ?? 0}</b> · {(etat.r.activite?.ca ?? 0).toLocaleString('fr')} F</div>
                </div>
              )}
              {etat.r.oubliPrecedent && <div style={{ marginTop: 12, fontSize: 12, color: '#B97A18' }}>Votre précédente sortie n'avait pas été pointée : le gérant la corrigera.</div>}
            </>
          )}
          {etat.statut === 'erreur' && <p role="alert" style={{ margin: 0, fontSize: 15, color: '#201915' }}>{etat.message}</p>}
          {etat.statut === 'chargement' && <p style={{ margin: 0, color: '#6B5F57' }}>{user?.prenom}, un instant…</p>}
          {etat.statut !== 'chargement' && (
            <button onClick={() => navigate('/yakro/pointage')} style={{ marginTop: 20, width: '100%', minHeight: 52, border: 0, borderRadius: 14, background: '#201915', color: 'white', fontFamily: 'Syne', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Voir mon pointage
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
