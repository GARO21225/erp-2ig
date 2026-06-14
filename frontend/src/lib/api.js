import axios from 'axios';
import { useAuthStore } from '../store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

// ── AUTH
export const authAPI = {
  creerDepuisEmploye: (data) => api.post('/auth/creer-depuis-employe', data),
  resetPassword: (id) => api.post(`/auth/utilisateurs/${id}/reset-password`),
  historisation: (params) => api.get('/auth/historisation', { params }),
  getUtilisateurs: (params) => api.get('/auth/utilisateurs', { params }),
  updateRole: (id, data) => api.put(`/auth/utilisateurs/${id}/role`, data),
  desactiverUser: (id) => api.delete(`/auth/utilisateurs/${id}`),
  listUtilisateurs: (params) => api.get('/auth/utilisateurs', { params }),
  updateRole: (id, data) => api.put(`/auth/utilisateurs/${id}/role`, data),
  unlockAccount: (id) => api.post(`/auth/unlock/${id}`),
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  changePassword: (data) => api.put('/auth/password', data),
};

// ── DASHBOARD
export const dashboardAPI = {
  scoreSante: () => api.get('/dashboard/score-sante'),
  groupe: () => api.get('/dashboard/groupe'),
  scoreSante: () => api.get('/dashboard/score-sante'),
};

// ── EMPLOYÉS
export const employesAPI = {
  update: (id, data) => api.put(`/employes/${id}`, data),
  list: (params) => api.get('/employes', { params }),
  get: (id) => api.get(`/employes/${id}`),
  create: (data) => api.post('/employes', data),
  update: (id, data) => api.put(`/employes/${id}`, data),
  addConge: (id, data) => api.post(`/employes/${id}/conges`, data),
  approuveConge: (id, cid, statut) => api.put(`/employes/${id}/conges/${cid}`, { statut }),
  addAvance: (id, data) => api.post(`/employes/${id}/avances`, data),
  addEvaluation: (id, data) => api.post(`/employes/${id}/evaluations`, data),
  genererFiche: (id, data) => api.post(`/employes/${id}/paie`, data),
  rotations: (params) => api.get('/employes/rotations/semaine', { params }),
  saveRotations: (data) => api.post('/employes/rotations', data),
};

// ── FINANCE
export const financeAPI = {
  caisses: (params) => api.get('/finance/caisses', { params }),
  createCaisse: (data) => api.post('/finance/caisses', data),
  stats: (params) => api.get('/finance/stats', { params }),
  encaissements: (params) => api.get('/finance/encaissements', { params }),
  createEncaissement: (data) => api.post('/finance/encaissements', data),
  addEncaissement: (data) => api.post('/finance/encaissements', data),
  decaissements: (params) => api.get('/finance/decaissements', { params }),
  createDecaissement: (data) => api.post('/finance/decaissements', data),
  addDecaissement: (data) => api.post('/finance/decaissements', data),
  validerDecaissement: (id, data) => api.put(`/finance/decaissements/${id}/valider`, data),
  rapport: (params) => api.get('/finance/rapport', { params }),
  pilotage: (params) => api.get('/finance/pilotage', { params }),
  topClassements: (params) => api.get('/finance/pilotage', { params }),
};

// ── STOCKS
export const stocksAPI = {
  seedYakro: () => api.post('/stocks/seed-yakro'),
  produits: (params) => api.get('/stocks/produits', { params }),
  createProduit: (data) => api.post('/stocks/produits', data),
  mouvements: (params) => api.get('/stocks/mouvements', { params }),
  addMouvement: (data) => api.post('/stocks/mouvements', data),
  achats: () => api.get('/stocks/achats'),
  createAchat: (data) => api.post('/stocks/achats', data),
  reception: (id, data) => api.put(`/stocks/achats/${id}/reception`, data),
};

// ── YAKRO GRILL
export const yakroAPI = {
  tables: () => api.get('/yakro/tables'),
  updateTable: (id, statut) => api.put(`/yakro/tables/${id}/statut`, { statut }),
  createTable: (data) => api.post('/yakro/tables', data),
  updateTableFull: (id, data) => api.put(`/yakro/tables/${id}`, data),
  deleteTable: (id) => api.delete(`/yakro/tables/${id}`),
  commandes: (params) => api.get('/yakro/commandes', { params }),
  caisse: () => api.get('/yakro/commandes/caisse-detail'),
  createCommande: (data) => api.post('/yakro/commandes', data),
  updateStatut: (id, statut) => api.put(`/yakro/commandes/${id}/statut`, { statut }),
  payer: (id, data) => api.post(`/yakro/commandes/${id}/payer`, data),
  annuler: (id) => api.delete(`/yakro/commandes/${id}`),
  menu: (params) => api.get('/yakro/menu', { params }),
  createMenu: (data) => api.post('/yakro/menu', data),
  updateMenu: (id, data) => api.put(`/yakro/menu/${id}`, data),
  deleteMenu: (id) => api.delete(`/yakro/menu/${id}`),
  seedMenu: () => api.post('/yakro/menu/seed'),
  reservations: (params) => api.get('/yakro/reservations', { params }),
  createReservation: (data) => api.post('/yakro/reservations', data),
  updateReservation: (id, statut) => api.put(`/yakro/reservations/${id}/statut`, { statut }),
  // Dashboard
  dashboard: (periode) => api.get('/yakro/dashboard', { params: { periode } }),
  // Tables enrichi
  assignerServeur: (id, data) => api.put(`/yakro/tables/${id}/assigner-serveur`, data),
  cloturerTable: (id) => api.put(`/yakro/tables/${id}/cloturer`),
  transfererTable: (data) => api.post('/yakro/tables/transferer', data),
  historiqueServeurs: () => api.get('/yakro/tables/historique-serveurs'),
  // Dépenses Yakro
  depensesYakro: (params) => api.get('/yakro/depenses', { params }),
  createDepenseYakro: (data) => api.post('/yakro/depenses', data),
  validerDepenseYakro: (id) => api.put(`/yakro/depenses/${id}/valider`),
  payerDepenseYakro: (id, data) => api.put(`/yakro/depenses/${id}/payer`, data),
  statsDepensesYakro: () => api.get('/yakro/depenses/stats'),
  categoriesDepensesYakro: () => api.get('/yakro/depenses/categories'),
  // Session caisse
  sessionCaisseActive: () => api.get('/yakro/caisse-session/session-active'),
  ouvrirCaisse: (montant) => api.post('/yakro/caisse-session/ouvrir', { montantOuverture: montant }),
  cloturerCaisse: (data) => api.post('/yakro/caisse-session/cloturer', data),
  historiqueCaisse: () => api.get('/yakro/caisse-session/historique'),
  // Annulations & Remises
  annulationsYakro: (params) => api.get('/yakro/caisse-session/annulations', { params }),
  remisesYakro: (params) => api.get('/yakro/caisse-session/remises', { params }),
  createAnnulation: (data) => api.post('/yakro/caisse-session/annulations', data),
  createRemise: (data) => api.post('/yakro/caisse-session/remises', data),
  historique: (params) => api.get('/yakro/commandes/historique', { params }),
  genererFacture: (commandeId) => api.post('/yakro/factures/generer', { commandeId }),
  getFacture: (id) => api.get(`/yakro/factures/${id}`),
  listFactures: (params) => api.get('/yakro/factures', { params }),
  creerRetour: (data) => api.post('/yakro/factures/retours', data),
  validerRetour: (id) => api.put(`/yakro/factures/retours/${id}/valider`),
  listeRetours: (params) => api.get('/yakro/factures/retours/liste', { params }),
};

// ── TOPTELSIG
export const toptelsigAPI = {
  projets: () => api.get('/toptelsig/projets'),
  getProjet: (id) => api.get(`/toptelsig/projets/${id}`),
  createProjet: (data) => api.post('/toptelsig/projets', data),
  updateProjet: (id, data) => api.put(`/toptelsig/projets/${id}`, data),
  updateLot: (id, data) => api.put(`/toptelsig/lots/${id}`, data),
  deleteLot: (id) => api.delete(`/toptelsig/lots/${id}`),
  importLots: (projetId, file) => { const fd = new FormData(); fd.append('fichier', file); fd.append('projetId', projetId); return api.post('/toptelsig/lots/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  templateLots: () => api.get('/toptelsig/lots/template', { responseType: 'blob' }),
  categoriesDepenses: () => api.get('/toptelsig/projets/categories-depenses'),

  lots: (params) => api.get('/toptelsig/lots', { params }),
  createLot: (data) => api.post('/toptelsig/lots', data),
  createLotsBatch: (data) => api.post('/toptelsig/lots/batch', data),

  souscripteurs: (params) => api.get('/toptelsig/souscripteurs', { params }),
  souscripteursDashboard: (params) => api.get('/toptelsig/souscripteurs/dashboard', { params }),
  souscripteur: (id) => api.get(`/toptelsig/souscripteurs/${id}`),
  createSouscripteur: (data) => api.post('/toptelsig/souscripteurs', data),
  updateSouscripteur: (id, data) => api.put(`/toptelsig/souscripteurs/${id}`, data),
  addPaiement: (id, data) => api.post(`/toptelsig/souscripteurs/${id}/paiements`, data),
  souscripteursTemplate: () => `${api.defaults.baseURL}/toptelsig/souscripteurs/template`,
  importSouscripteurs: (file) => { const fd = new FormData(); fd.append('fichier', file); return api.post('/toptelsig/souscripteurs/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  getSouscripteur: (id) => api.get(`/toptelsig/souscripteurs/${id}`),
  ventesListe: (params) => api.get('/toptelsig/ventes', { params }),
  planifierEcheancier: (venteId, data) => api.post(`/toptelsig/ventes/${venteId}/echeanciers`, data),
  createSouscripteur: (data) => api.post('/toptelsig/souscripteurs', data),
  updateSouscripteur: (id, data) => api.put(`/toptelsig/souscripteurs/${id}`, data),
  addPaiement: (id, data) => api.post(`/toptelsig/souscripteurs/${id}/paiements`, data),

  ventes: (params) => api.get('/toptelsig/ventes', { params }),
  createVente: (data) => api.post('/toptelsig/ventes', data),
  retards: () => api.get('/toptelsig/ventes/retards'),

  prescripteurs: (params) => api.get('/toptelsig/prescripteurs', { params }),
  projetComplet: (projetId) => api.get(`/toptelsig/projet-complet/${projetId}`),
  seedPhasesProjet: (projetId) => api.post(`/toptelsig/projet-complet/seed-phases/${projetId}`),
  seedPhasesAll: () => api.post('/toptelsig/projet-complet/seed-phases-all'),
  gestionProjet: (projetId) => api.get(`/toptelsig/gestion-projet/projet/${projetId}`),
  dashboardProjet: (projetId) => api.get(`/toptelsig/gestion-projet/dashboard/${projetId}`),
  createPhase: (data) => api.post('/toptelsig/gestion-projet/phases', data),
  updatePhase: (id, data) => api.put(`/toptelsig/gestion-projet/phases/${id}`, data),
  createActivite: (data) => api.post('/toptelsig/gestion-projet/activites', data),
  createLivrable: (data) => api.post('/toptelsig/gestion-projet/livrables', data),
  updateLivrable: (id, data) => api.put(`/toptelsig/gestion-projet/livrables/${id}`, data),
  createTache: (data) => api.post('/toptelsig/gestion-projet/taches', data),
  updateTache: (id, data) => api.put(`/toptelsig/gestion-projet/taches/${id}`, data),
  depenses: (params) => api.get('/toptelsig/depenses', { params }),
  crmProspects: (params) => api.get('/toptelsig/crm/prospects', { params }),
  crmDashboard: () => api.get('/toptelsig/crm/dashboard'),
  crmTemplateImport: () => api.get('/toptelsig/crm/template-import', { responseType: 'blob' }),
  crmProposerLot: (data) => api.post('/toptelsig/crm/proposer-lot', data),
  crmRelances: (id) => api.get(`/toptelsig/crm/${id}/relances`),
  crmAddRelance: (id, data) => api.post(`/toptelsig/crm/${id}/relances`, data),
  crmUpdate: (id, data) => api.put(`/toptelsig/crm/${id}`, data),
  crmProspect: (id) => api.get(`/toptelsig/crm/${id}`),
  crmConvertir: (data) => api.post('/toptelsig/crm/convertir-en-souscripteur', data),
  crmStatutProjet: (id, data) => api.put(`/toptelsig/crm/prospects/${id}/statut-projet`, data),
  crmTags: (id, tags) => api.put(`/toptelsig/crm/prospects/${id}/tags`, { tags }),
  createProspect: (data) => api.post('/toptelsig/crm/prospects', data),
  exportDepenses: (params) => `${api.defaults.baseURL}/toptelsig/depenses/export?${new URLSearchParams(params || {}).toString()}`,
  createDepense: (data) => api.post('/toptelsig/depenses', data),
  validerDepense: (id) => api.put(`/toptelsig/depenses/${id}/valider`),
  statsDepenses: (params) => api.get('/toptelsig/depenses/stats', { params }),
};

// ── LIYA
export const liyaAPI = {
  livraisons: (params) => api.get('/liya/livraisons', { params }),
  exportLivraisonsXlsx: (params) => `${api.defaults.baseURL}/liya/livraisons/export?${new URLSearchParams(params || {}).toString()}`,
  stats: () => api.get('/liya/livraisons/stats'),
  createLivraison: (data) => api.post('/liya/livraisons', data),
  updateStatut: (id, statut) => api.put(`/liya/livraisons/${id}/statut`, { statut }),
  addPosition: (id, data) => api.post(`/liya/livraisons/${id}/position`, data),
  positions: (id) => api.get(`/liya/livraisons/${id}/positions`),

  motos: () => api.get('/liya/motos'),
  motosTemplate: () => `${api.defaults.baseURL}/liya/motos/template`,
  importMotos: (file) => { const fd = new FormData(); fd.append('fichier', file); return api.post('/liya/motos/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  exportMotos: () => `${api.defaults.baseURL}/liya/motos/export`,
  createMoto: (data) => api.post('/liya/motos', data),
  updateMoto: (id, data) => api.put(`/liya/motos/${id}`, data),
  addMaintenance: (id, data) => api.post(`/liya/motos/${id}/maintenances`, data),
  addPlein: (id, data) => api.post(`/liya/motos/${id}/pleins`, data),
  historique: (id) => api.get(`/liya/motos/${id}/historique`),
  affecterLivreur: (id, data) => api.put(`/liya/motos/${id}/affecter-livreur`, data),

  // Stock 3PL
  stock3pl: (params) => api.get('/liya/stock3pl', { params }),
  createStock3pl: (data) => api.post('/liya/stock3pl', data),
  sortirStock3pl: (id, data) => api.put(`/liya/stock3pl/${id}/sortie`, data),
  updateStock3pl: (id, data) => api.put(`/liya/stock3pl/${id}`, data),
  deleteStock3pl: (id) => api.delete(`/liya/stock3pl/${id}`),
};

export default api;

// ── RECHERCHE GLOBALE
export const rechercheAPI = {
  global: (q) => api.get('/recherche', { params: { q } }),
};

// ── PRESCRIPTEURS
export const prescripteursAPI = {
  list: (params) => api.get('/toptelsig/prescripteurs', { params }),
  get: (id) => api.get(`/toptelsig/prescripteurs/${id}`),
  create: (data) => api.post('/toptelsig/prescripteurs', data),
  update: (id, data) => api.put(`/toptelsig/prescripteurs/${id}`, data),
  desactiver: (id) => api.put(`/toptelsig/prescripteurs/${id}/desactiver`),
  commissions: (id, params) => api.get(`/toptelsig/prescripteurs/${id}/commissions`, { params }),
  payerCommission: (prescId, commId, data) => api.put(`/toptelsig/prescripteurs/${prescId}/commissions/${commId}/payer`, data),
};

// ── DÉPENSES v2 (workflow 3 niveaux)
export const depensesAPIv2 = {
  list: (params) => api.get('/toptelsig/depenses', { params }),
  create: (data) => api.post('/toptelsig/depenses', data),
  update: (id, data) => api.put(`/toptelsig/depenses/${id}`, data),
  workflow: (id, action, extra) => api.put(`/toptelsig/depenses/${id}/workflow`, { action, ...extra }),
  validerN1: (id) => api.put(`/toptelsig/depenses/${id}/valider-n1`),
  validerFinale: (id) => api.put(`/toptelsig/depenses/${id}/valider-finale`),
  payer: (id, data) => api.put(`/toptelsig/depenses/${id}/payer`, data),
  rejeter: (id, motif) => api.put(`/toptelsig/depenses/${id}/rejeter`, { motif }),
  stats: (params) => api.get('/toptelsig/depenses/stats', { params }),
  categories: () => api.get('/toptelsig/depenses/categories'),
  typesBeneficiaires: () => api.get('/toptelsig/depenses/types-beneficiaires'),
  phasesProjet: (projetId) => api.get(`/toptelsig/gestion-projet/projet/${projetId}`).then(d => d?.phases || []),
};

// ── STOCK 3PL LiYA
export const stock3plAPI = {
  list: (params) => api.get('/liya/stock3pl', { params }),
  create: (data) => api.post('/liya/stock3pl', data),
  sortie: (id, data) => api.put(`/liya/stock3pl/${id}/sortie`, data),
  rapport: (params) => api.get('/liya/stock3pl/rapport', { params }),
};

// ── ALERTES & DASHBOARD compléments
export const alertesAPI = {
  critiques: () => api.get('/dashboard/alertes'),
};

// Complément employesAPI
export const rotationsAPI = {
  generer: (data) => api.post('/employes/rotations/generer', data),
  semaine: (params) => api.get('/employes/rotations/semaine', { params }),
};

export const documentsAPI = {
  upload: (formData) => api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list: (params) => api.get('/documents', { params }),
  delete: (id) => api.delete(`/documents/${id}`),
  viewUrl: (id) => `${api.defaults.baseURL}/documents/${id}`,
};

export function getApiBaseUrl() {
  return api.defaults.baseURL || 'http://localhost:4000/api';
}

export const partenairesLiyaAPI = {
  list: (params) => api.get('/liya/partenaires', { params }),
  create: (data) => api.post('/liya/partenaires', data),
  update: (id, data) => api.put(`/liya/partenaires/${id}`, data),
  delete: (id) => api.delete(`/liya/partenaires/${id}`),
};

export const facturationAPI = {
  generer: (lotId, type, paiementId) => api.post('/toptelsig/facturation/generer', { lotId, type, paiementId }),
  historique: (lotId) => api.get(`/toptelsig/facturation/historique/${lotId}`),
  document: (id) => api.get(`/toptelsig/facturation/document/${id}`),
  params: (filiale) => api.get('/toptelsig/facturation/params', { params: { filiale } }),
  updateParams: (filiale, data) => api.put('/toptelsig/facturation/params', { filiale, ...data }),
};
