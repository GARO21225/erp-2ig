import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { useAuthStore } from './store';
import OfflineIndicator from './components/ui/OfflineIndicator';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import PortailPage from './pages/PortailPage';
import GestionProjetPage from './pages/toptelsig/GestionProjetPage';
import CRMPage from './pages/toptelsig/CRMPage';
import DashboardToptelsig from './pages/toptelsig/DashboardToptelsig';
import TablesPage from './pages/yakro/TablesPage';
import AssignationsPage from './pages/yakro/AssignationsPage';
import HistorisationPage from './pages/groupe/HistorisationPage';
import UtilisateursPage from './pages/groupe/UtilisateursPage';
import DashboardGroupe from './pages/groupe/DashboardGroupe';
import ParametresEntreprisePage from './pages/groupe/ParametresEntreprisePage';
import RHPage from './pages/groupe/RHPage';
import FinancePage from './pages/groupe/FinancePage';
import StocksPage from './pages/groupe/StocksPage';
import POS from './pages/yakro/POS';
import CommandesYakro from './pages/yakro/CommandesYakro';
import MenuPage from './pages/yakro/MenuPage';
import ReservationsYakro from './pages/yakro/ReservationsYakro';
import DashboardYakro from './pages/yakro/DashboardYakro';
import DepensesYakroPage from './pages/yakro/DepensesYakroPage';
import GestionCaissePage from './pages/yakro/GestionCaissePage';
import CaisseYakro from './pages/yakro/CaisseYakro';
import ProjetsPage from './pages/toptelsig/ProjetsPage';
import SouscripteursPage from './pages/toptelsig/SouscripteursPage';
import ProspectDetailPage from './pages/toptelsig/ProspectDetailPage';
import SouscripteurDetail from './pages/toptelsig/SouscripteurDetail';
import VentesPage from './pages/toptelsig/VentesPage';
import DepensesPage from './pages/toptelsig/DepensesPage';
import PrescripteursPage from './pages/toptelsig/PrescripteursPage';
import CampagnesPage from './pages/toptelsig/CampagnesPage';
import LivraisonsPage from './pages/liya/LivraisonsPage';
import MotosPage from './pages/liya/MotosPage';
import CarteLivraison from './pages/liya/CarteLivraison';
import Stock3PLPage from './pages/liya/Stock3PLPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      // Garde les données en mémoire 24h — assez pour qu'une coupure réseau
      // d'une journée terrain n'efface pas ce qui a déjà été consulté
      gcTime: 24 * 60 * 60 * 1000,
    }
  }
});

// Persistance dans localStorage : ce qui a été chargé une fois reste
// consultable même après fermeture de l'app ou coupure totale du réseau.
// On ne persiste QUE les requêtes de lecture (GET) métier — jamais l'auth.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'erp-2ig-cache-offline',
});

function PrivateRoute({ children }) {
  const isAuth = useAuthStore(s => s.isAuth());
  return isAuth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        // Sécurité : on ne persiste jamais les requêtes liées à l'authentification
        // ou aux sessions, même si elles passent par React Query un jour.
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = JSON.stringify(query.queryKey).toLowerCase();
            if (key.includes('auth') || key.includes('session') || key.includes('password')) return false;
            return query.state.status === 'success';
          },
        },
      }}
    >
      <OfflineIndicator />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="portail" element={<PortailPage />} />
            <Route path="dashboard" element={<DashboardGroupe />} />
            <Route path="rh" element={<RHPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="stocks" element={<StocksPage />} />
            <Route path="utilisateurs" element={<UtilisateursPage />} />
            <Route path="historisation" element={<HistorisationPage />} />
            <Route path="parametres-entreprise" element={<ParametresEntreprisePage />} />
            <Route path="yakro/dashboard" element={<DashboardYakro />} />
            <Route path="yakro/depenses" element={<DepensesYakroPage />} />
            <Route path="yakro/gestion-caisse" element={<GestionCaissePage />} />
            <Route path="yakro/pos" element={<POS />} />
            <Route path="yakro/commandes" element={<CommandesYakro />} />
            <Route path="yakro/menu" element={<MenuPage />} />
            <Route path="yakro/tables" element={<TablesPage />} />
            <Route path="yakro/assignations" element={<AssignationsPage />} />
            <Route path="yakro/reservations" element={<ReservationsYakro />} />
            <Route path="yakro/caisse" element={<CaisseYakro />} />
            <Route path="toptelsig/gestion-projet" element={<GestionProjetPage />} />
            <Route path="toptelsig/prospects" element={<CRMPage />} />
            <Route path="toptelsig/dashboard" element={<DashboardToptelsig />} />
            <Route path="toptelsig/projets" element={<ProjetsPage />} />
            <Route path="toptelsig/souscripteurs" element={<SouscripteursPage />} />
            <Route path="toptelsig/prospects/:id" element={<ProspectDetailPage />} />
            <Route path="toptelsig/souscripteurs/:id" element={<SouscripteurDetail />} />
            <Route path="toptelsig/ventes" element={<VentesPage />} />
            <Route path="toptelsig/depenses" element={<DepensesPage />} />
            <Route path="toptelsig/prescripteurs" element={<PrescripteursPage />} />
            <Route path="toptelsig/campagnes" element={<CampagnesPage />} />
            <Route path="liya/livraisons" element={<LivraisonsPage />} />
            <Route path="liya/motos" element={<MotosPage />} />
            <Route path="liya/carte" element={<CarteLivraison />} />
            <Route path="liya/stock3pl" element={<Stock3PLPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}
