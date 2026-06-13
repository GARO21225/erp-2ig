import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      filiale: 'GROUPE',
      dernierEspace: null, // Mémoriser le dernier espace visité

      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null, dernierEspace: null }),
      setFiliale: (filiale) => set({ filiale }),
      setDernierEspace: (espace) => set({ dernierEspace: espace }),
      isAuth: () => !!get().token,
    }),
    {
      name: '2ig-auth',
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        dernierEspace: s.dernierEspace,
      })
    }
  )
);

export const useUIStore = create((set) => ({
  sidebarOpen: true,
  modalStack: [],
  notifications: [],

  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  pushModal: (modal) => set(s => ({ modalStack: [...s.modalStack, modal] })),
  popModal: () => set(s => ({ modalStack: s.modalStack.slice(0, -1) })),
  addNotif: (notif) => set(s => ({ notifications: [notif, ...s.notifications].slice(0, 20) })),
}));

if (typeof window !== 'undefined') {
  setTimeout(() => {
    const { useAuthStore } = require('./index');
    window.__authStore = useAuthStore.getState();
    useAuthStore.subscribe(state => { window.__authStore = state; });
  }, 0);
}
