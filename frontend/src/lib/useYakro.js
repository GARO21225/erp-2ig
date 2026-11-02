import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { yakroAPI } from './api';
import { useRestoStore } from '../store';

/** Restaurant Yakro courant + droits de l'utilisateur dans ce restaurant. */
export function useYakro() {
  const { restaurantId, setRestaurant } = useRestoStore();
  const { data, isLoading } = useQuery({ queryKey: ['yakro-moi'], queryFn: yakroAPI.moi, staleTime: 60000 });
  const restaurants = data?.restaurants || [];
  const courant = restaurants.find(r => r.id === restaurantId) || restaurants[0] || null;

  // Restaurant mémorisé devenu inaccessible → on prend le premier
  useEffect(() => {
    if (courant && courant.id !== restaurantId) setRestaurant(courant.id);
  }, [courant?.id, restaurantId]);

  const permissions = courant?.permissions || [];
  return {
    isLoading, restaurants, courant,
    peut: (perm) => permissions.includes(perm),
    devise: courant?.devise || 'FCFA',
  };
}
