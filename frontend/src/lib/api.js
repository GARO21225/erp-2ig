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
  listUtilisateurs: (params) => api.get('/auth/utilisateurs', { params }).then(r => r.data),
  updateRole: (id, data) => api.put(`/auth/utilisateurs/${id}/role`, data).then(r => r.data),
  unlockAccount: (id) => api.post(`/auth/unlock/${id}`).then(r => r.data),
  register: (data) => api.post('/auth/register', data).then(r => r.data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  changePassword: (data) => api.put('/auth/password', data),
};

// ── DASHBOARD
export const dashboardAPI = {
  scoreSante: () => api.get('/dashboard/score-sante').then(r => r.data),
  groupe: () => api.get('/dashboard/groupe'),
  scoreSante: () => api.get('/dashboard/score-sante'),
};

// ── EMPLOYÉS
export const employesAPI = {
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
  encaissements: (params) => api.get('/finance/encaissements', { params }),
  addEncaissement: (data) => api.post('/finance/encaissements', data),
  decaissements: (params) => api.get('/finance/decaissements', { params }),
  addDecaissement: (data) => api.post('/finance/decaissements', data),
  validerDecaissement: (id, data) => api.put(`/finance/decaissements/${id}/valider`, data),
  rapport: (params) => api.get('/finance/rapport', { params }),
};

// ── STOCKS
export const stocksAPI = {
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
  createTable: (data) => api.post('/yakro/tables', data).then(r => r.data),
  updateTableFull: (id, data) => api.put(`/yakro/tables/${id}`, data).then(r => r.data),
  deleteTable: (id) => api.delete(`/yakro/tables/${id}`).then(r => r.data),
  commandes: (params) => api.get('/yakro/commandes', { params }),
  caisse: () => api.get('/yakro/commandes/caisse'),
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
};

// ── TOPTELSIG
export const toptelsigAPI = {
  projets: () => api.get('/toptelsig/projets'),
  getProjet: (id) => api.get(`/toptelsig/projets/${id}`),
  createProjet: (data) => api.post('/toptelsig/projets', data),
  updateProjet: (id, data) => api.put(`/toptelsig/projets/${id}`, data),
  categoriesDepenses: () => api.get('/toptelsig/projets/categories-depenses'),

  lots: (params) => api.get('/toptelsig/lots', { params }),
  createLot: (data) => api.post('/toptelsig/lots', data),
  createLotsBatch: (data) => api.post('/toptelsig/lots/batch', data),

  souscripteurs: (params) => api.get('/toptelsig/souscripteurs', { params }),
  souscripteursTemplate: () => `${api.defaults.baseURL}/toptelsig/souscripteurs/template`,
  importSouscripteurs: (file) => { const fd = new FormData(); fd.append('fichier', file); return api.post('/toptelsig/souscripteurs/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  getSouscripteur: (id) => api.get(`/toptelsig/souscripteurs/${id}`),
  createSouscripteur: (data) => api.post('/toptelsig/souscripteurs', data),
  updateSouscripteur: (id, data) => api.put(`/toptelsig/souscripteurs/${id}`, data),
  addPaiement: (id, data) => api.post(`/toptelsig/souscripteurs/${id}/paiements`, data),

  ventes: (params) => api.get('/toptelsig/ventes', { params }),
  createVente: (data) => api.post('/toptelsig/ventes', data),
  retards: () => api.get('/toptelsig/ventes/retards'),

  depenses: (params) => api.get('/toptelsig/depenses', { params }),
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
  validerN1: (id) => api.put(`/toptelsig/depenses/${id}/valider-n1`),
  validerFinale: (id) => api.put(`/toptelsig/depenses/${id}/valider-finale`),
  payer: (id, data) => api.put(`/toptelsig/depenses/${id}/payer`, data),
  rejeter: (id, motif) => api.put(`/toptelsig/depenses/${id}/rejeter`, { motif }),
  stats: (params) => api.get('/toptelsig/depenses/stats', { params }),
  categories: () => api.get('/toptelsig/depenses/categories'),
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
  upload: (formData) => api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  list: (params) => api.get('/documents', { params }).then(r => r.data),
  delete: (id) => api.delete(`/documents/${id}`).then(r => r.data),
  viewUrl: (id) => `${api.defaults.baseURL}/documents/${id}`,
};

export function getApiBaseUrl() {
  return api.defaults.baseURL || 'http://localhost:4000/api';
}
