import { useQueryClient } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { useRestoStore } from '../../store';
import { useYakro } from '../../lib/useYakro';

/** Choix du restaurant Yakro Grill dans la barre du haut (masqué s'il n'y en a qu'un). */
export default function SelecteurRestaurant() {
  const qc = useQueryClient();
  const setRestaurant = useRestoStore(s => s.setRestaurant);
  const { restaurants, courant } = useYakro();
  if (restaurants.length < 2) return null;

  const changer = (id) => {
    setRestaurant(id);
    // Toutes les données affichées dépendent du restaurant : on recharge tout
    qc.invalidateQueries({ predicate: q => q.queryKey[0] !== 'yakro-moi' });
  };

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#FDF2F2', border: '1px solid #8B1A1A30', borderRadius: 20, flexShrink: 0, minWidth: 0 }}>
      <Store size={13} color="#8B1A1A" style={{ flexShrink: 0 }} />
      <select value={courant?.id || ''} onChange={e => changer(e.target.value)}
        aria-label="Restaurant"
        style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600, color: '#8B1A1A', outline: 'none', cursor: 'pointer', maxWidth: 150, textOverflow: 'ellipsis' }}>
        {restaurants.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
      </select>
    </label>
  );
}
