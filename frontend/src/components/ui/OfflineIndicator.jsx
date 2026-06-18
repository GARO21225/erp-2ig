import { useState, useEffect } from 'react';

/**
 * Indicateur de statut réseau — bandeau visible en haut de l'écran.
 *
 * Niveau 1 du mode offline : ne permet pas de saisir des données sans
 * réseau, mais prévient clairement l'utilisateur que :
 *  - il est hors-ligne
 *  - ce qu'il voit à l'écran est ce qui a été chargé avant la coupure
 *    (peut ne plus être à jour)
 *  - les actions de création/modification échoueront tant que le
 *    réseau n'est pas revenu
 */
export default function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 4000);
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online && !justReconnected) return null;

  return (
    <div style={{
      width: '100%',
      padding: '7px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600,
      background: online ? '#27500A' : '#A32D2D', color: 'white',
      transition: 'background 0.3s',
    }}>
      {online
        ? '✅ Connexion rétablie — les données se mettent à jour'
        : '📡 Pas de connexion — vous consultez les dernières données chargées. La création ou modification de données est indisponible tant que le réseau n\'est pas revenu.'}
    </div>
  );
}
