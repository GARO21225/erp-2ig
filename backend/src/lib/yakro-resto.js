/**
 * Yakro Grill multi-restaurants — contexte restaurant, profils & permissions, paramètres.
 * Un utilisateur travaille toujours "dans" un restaurant : en-tête X-Restaurant-Id (ou ?restaurantId=).
 */
const prisma = require('./prisma');

// ── Catalogue des permissions ───────────────────────────────────────────────
const PERMISSIONS = [
  { cle: 'commande.creer',     groupe: 'Commandes', label: 'Prendre une commande' },
  { cle: 'commande.encaisser', groupe: 'Commandes', label: 'Encaisser' },
  { cle: 'commande.annuler',   groupe: 'Commandes', label: 'Annuler une commande' },
  { cle: 'commande.remise',    groupe: 'Commandes', label: 'Accorder une remise' },
  { cle: 'commande.rembourser',groupe: 'Commandes', label: 'Rembourser' },
  { cle: 'caisse.session',     groupe: 'Caisse',    label: 'Ouvrir / clôturer la caisse' },
  { cle: 'caisse.voir',        groupe: 'Caisse',    label: 'Voir la caisse et les encaissements' },
  { cle: 'menu.voir',          groupe: 'Menu',      label: 'Voir le menu' },
  { cle: 'menu.gerer',         groupe: 'Menu',      label: 'Modifier le menu commun' },
  { cle: 'prix.gerer',         groupe: 'Menu',      label: 'Fixer les prix du restaurant' },
  { cle: 'tables.gerer',       groupe: 'Salle',     label: 'Configurer les tables' },
  { cle: 'reservations.gerer', groupe: 'Salle',     label: 'Gérer les réservations' },
  { cle: 'cuisine.voir',      groupe: 'Commandes', label: 'Écran cuisine / bar (marquer les plats prêts)' },
  { cle: 'depenses.saisir',    groupe: 'Dépenses',  label: 'Saisir une dépense' },
  { cle: 'depenses.valider',   groupe: 'Dépenses',  label: 'Valider ou rejeter une dépense (DG)' },
  { cle: 'depenses.decaisser', groupe: 'Dépenses',  label: 'Décaisser une dépense (comptable)' },
  { cle: 'depenses.cloturer',  groupe: 'Dépenses',  label: 'Clôturer une dépense (comptable)' },
  { cle: 'rapports.voir',      groupe: 'Pilotage',  label: 'Voir tableaux de bord et rapports' },
  { cle: 'pointage.voir',      groupe: 'Personnel', label: 'Voir les pointages du personnel' },
  { cle: 'pointage.gerer',     groupe: 'Personnel', label: 'Afficher le QR de pointage et corriger les pointages' },
  { cle: 'parametres.gerer',   groupe: 'Administration', label: 'Paramétrer le restaurant' },
  { cle: 'equipe.gerer',       groupe: 'Administration', label: "Gérer l'équipe et les accès" },
  { cle: 'restaurants.gerer',  groupe: 'Administration', label: 'Créer / désactiver des restaurants' },
];
const TOUTES = PERMISSIONS.map(p => p.cle);

const PROFILS_DEFAUT = [
  { code: 'GERANT', nom: 'Gérant', description: 'Pilote un restaurant au quotidien',
    permissions: TOUTES.filter(c => c !== 'restaurants.gerer') },
  { code: 'CAISSIER', nom: 'Caissier', description: 'Encaisse et gère la caisse',
    permissions: ['commande.creer','commande.encaisser','commande.remise','caisse.session','caisse.voir','menu.voir','reservations.gerer','depenses.saisir'] },
  { code: 'SERVEUR', nom: 'Serveur', description: 'Prend les commandes en salle',
    permissions: ['commande.creer','menu.voir','reservations.gerer'] },
  { code: 'BARMAN', nom: 'Barman / Cuisine', description: 'Prépare les commandes',
    permissions: ['commande.creer','menu.voir','cuisine.voir'] },
  { code: 'COMPTABLE', nom: 'Comptable', description: 'Suit caisse, dépenses et rapports',
    permissions: ['caisse.voir','depenses.saisir','depenses.decaisser','depenses.cloturer','rapports.voir','menu.voir'] },
];

// Rôle ERP → profil par défaut (utilisateur sans affectation explicite)
const ROLE_PROFIL = { MANAGER: 'GERANT', CAISSIER: 'CAISSIER', SERVEUR: 'SERVEUR', BARMAN: 'BARMAN', COMPTABLE: 'COMPTABLE' };
const ROLES_ADMIN = ['DG', 'DIRECTEUR'];

// ── Catalogue des paramètres d'un restaurant ────────────────────────────────
const PARAMETRES = [
  { cle: 'paiement_especes',   groupe: 'Modes de paiement', label: 'Espèces',       type: 'bool', defaut: '1' },
  { cle: 'paiement_om',        groupe: 'Modes de paiement', label: 'Orange Money',  type: 'bool', defaut: '1' },
  { cle: 'paiement_wave',      groupe: 'Modes de paiement', label: 'Wave',          type: 'bool', defaut: '1' },
  { cle: 'paiement_mtn',       groupe: 'Modes de paiement', label: 'MTN Money',     type: 'bool', defaut: '1' },
  { cle: 'paiement_moov',      groupe: 'Modes de paiement', label: 'Moov Money',    type: 'bool', defaut: '0' },
  { cle: 'paiement_banque',    groupe: 'Modes de paiement', label: 'Banque / carte',type: 'bool', defaut: '0' },
  { cle: 'numero_om',          groupe: 'Numéros de réception', label: 'Numéro Orange Money', type: 'text', defaut: '' },
  { cle: 'numero_wave',        groupe: 'Numéros de réception', label: 'Numéro Wave',         type: 'text', defaut: '' },
  { cle: 'numero_mtn',         groupe: 'Numéros de réception', label: 'Numéro MTN Money',    type: 'text', defaut: '' },
  { cle: 'qr_om',   groupe: 'QR codes de paiement', label: 'QR code Orange Money', type: 'image', defaut: '' },
  { cle: 'qr_wave', groupe: 'QR codes de paiement', label: 'QR code Wave',         type: 'image', defaut: '' },
  { cle: 'qr_mtn',  groupe: 'QR codes de paiement', label: 'QR code MTN Money',    type: 'image', defaut: '' },
  { cle: 'qr_moov', groupe: 'QR codes de paiement', label: 'QR code Moov Money',   type: 'image', defaut: '' },
  { cle: 'logo_om',   groupe: 'Logos affichés sous les QR codes', label: 'Logo Orange Money', type: 'image', defaut: '' },
  { cle: 'logo_wave', groupe: 'Logos affichés sous les QR codes', label: 'Logo Wave',         type: 'image', defaut: '' },
  { cle: 'logo_mtn',  groupe: 'Logos affichés sous les QR codes', label: 'Logo MTN Money',    type: 'image', defaut: '' },
  { cle: 'logo_moov', groupe: 'Logos affichés sous les QR codes', label: 'Logo Moov Money',   type: 'image', defaut: '' },
  { cle: 'service_actif',      groupe: 'Service', label: 'Sur place', type: 'bool', defaut: '1' },
  { cle: 'emporter_actif',     groupe: 'Service', label: 'À emporter', type: 'bool', defaut: '1' },
  { cle: 'livraison_actif',    groupe: 'Service', label: 'Livraison', type: 'bool', defaut: '0' },
  { cle: 'couverts_obligatoires', groupe: 'Service', label: 'Nombre de couverts obligatoire', type: 'bool', defaut: '0' },
  { cle: 'remise_max_pct',     groupe: 'Tarification', label: 'Remise maximale autorisée (%)', type: 'number', defaut: '20' },
  { cle: 'session_obligatoire',groupe: 'Caisse', label: 'Session de caisse ouverte obligatoire pour encaisser', type: 'bool', defaut: '0' },
];
const defautsParametres = () => Object.fromEntries(PARAMETRES.map(p => [p.cle, p.defaut]));

async function parametresDe(restaurantId) {
  const out = defautsParametres();
  if (!restaurantId) return out;
  const rows = await prisma.parametreRestaurantYakro.findMany({ where: { restaurantId } });
  for (const r of rows) out[r.cle] = r.valeur;
  return out;
}

// ── Profils & restaurant par défaut ─────────────────────────────────────────
async function assurerProfilsDefaut() {
  for (const p of PROFILS_DEFAUT) {
    await prisma.profilYakro.upsert({
      where: { code: p.code },
      update: {},
      create: { ...p, systeme: true },
    });
  }
  // Profils système : ils reçoivent les nouvelles permissions du circuit des dépenses
  for (const code of ['COMPTABLE', 'BARMAN']) {
    const pr = await prisma.profilYakro.findUnique({ where: { code } });
    const voulu = PROFILS_DEFAUT.find(x => x.code === code).permissions.filter(c => ['depenses.decaisser', 'depenses.cloturer', 'cuisine.voir'].includes(c));
    const m = voulu.filter(c => !pr.permissions.includes(c));
    if (pr.systeme && m.length) await prisma.profilYakro.update({ where: { id: pr.id }, data: { permissions: [...pr.permissions, ...m] } });
  }
  // Nouvelles permissions du catalogue : le profil Gérant (système) les reçoit automatiquement
  const gerant = await prisma.profilYakro.findUnique({ where: { code: 'GERANT' } });
  const defaut = PROFILS_DEFAUT.find(x => x.code === 'GERANT').permissions;
  const manque = defaut.filter(c => !gerant.permissions.includes(c));
  if (gerant.systeme && manque.length) {
    await prisma.profilYakro.update({ where: { id: gerant.id }, data: { permissions: [...gerant.permissions, ...manque] } });
  }
}

/** Crée le restaurant historique si aucun n'existe et y rattache les anciennes données. */
async function assurerRestaurantDefaut() {
  let resto = await prisma.restaurantYakro.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!resto) {
    resto = await prisma.restaurantYakro.create({ data: { code: 'YAKRO', nom: 'Yakro Grill', ville: 'Yamoussoukro' } });
    // Une seule fois : les comptes Yakro existants sont affectés au restaurant historique avec le profil de leur rôle
    const users = await prisma.utilisateur.findMany({ where: { actif: true, filiale: 'YAKRO_GRILL', role: { notIn: ROLES_ADMIN } }, select: { id: true, role: true } });
    for (const u of users) {
      const profil = await prisma.profilYakro.findUnique({ where: { code: ROLE_PROFIL[u.role] || 'SERVEUR' } });
      if (profil) await prisma.accesRestaurantYakro.create({ data: { utilisateurId: u.id, restaurantId: resto.id, profilId: profil.id } }).catch(() => {});
    }
  }
  const sansResto = { where: { restaurantId: null }, data: { restaurantId: resto.id } };
  await Promise.all([
    prisma.tableRestaurant.updateMany(sansResto),
    prisma.commandeYakro.updateMany(sansResto),
    prisma.sessionCaisseYakro.updateMany(sansResto),
    prisma.depenseYakro.updateMany(sansResto),
    prisma.caisse.updateMany({ where: { restaurantId: null, filiale: 'YAKRO_GRILL' }, data: { restaurantId: resto.id } }),
  ]);
  return resto;
}

// ── Résolution du restaurant courant + permissions ──────────────────────────
async function accesDe(user) {
  const restaurants = await prisma.restaurantYakro.findMany({ where: { actif: true }, orderBy: { createdAt: 'asc' } });
  if (ROLES_ADMIN.includes(user.role) || user.filiale === 'GROUPE') {
    return restaurants.map(r => ({ restaurant: r, permissions: new Set(TOUTES) }));
  }
  const acces = await prisma.accesRestaurantYakro.findMany({ where: { utilisateurId: user.id }, include: { profil: true } });
  if (acces.length) {
    const parId = new Map(restaurants.map(r => [r.id, r]));
    return acces.filter(a => parId.has(a.restaurantId))
      .map(a => ({ restaurant: parId.get(a.restaurantId), permissions: new Set(a.profil.permissions), profil: a.profil.code }));
  }
  // Non affecté : aucun accès. Seul un administrateur (DG / Directeur / Groupe) affecte un utilisateur à un restaurant.
  return [];
}

/** Middleware (après auth) : renseigne req.restaurantId, req.restaurant, req.permissions. */
const resto = async (req, res, next) => {
  try {
    const demande = req.headers['x-restaurant-id'] || req.query.restaurantId || req.body?.restaurantId;
    const liste = await accesDe(req.user);
    if (!liste.length) {
      if (await prisma.restaurantYakro.count() === 0) {
        // Aucun restaurant configuré : mode historique non cloisonné
        req.restaurantId = null; req.restaurant = null; req.permissions = new Set(TOUTES);
        return next();
      }
      return res.status(403).json({ error: "Aucun restaurant ne vous est affecté — contactez l'administrateur" });
    }
    // Restaurant demandé non accessible (ex. mémorisé par un autre compte) : un employé retombe sur le sien.
    // Un administrateur qui demande un restaurant inexistant/désactivé reçoit aussi le premier accessible.
    const choisi = (demande && liste.find(a => a.restaurant.id === demande)) || liste[0];
    req.restaurantId = choisi.restaurant.id;
    req.restaurant = choisi.restaurant;
    req.permissions = choisi.permissions;
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
};

/** Exige une permission dans le restaurant courant (à placer après `resto`). */
const can = (...perms) => (req, res, next) => {
  if (perms.some(p => req.permissions?.has(p))) return next();
  return res.status(403).json({ error: `Permission requise : ${perms.join(' ou ')}` });
};

/** Filtre Prisma de cloisonnement ({} si aucun restaurant configuré). */
const sc = (req) => (req.restaurantId ? { restaurantId: req.restaurantId } : {});

/** Prix et disponibilité par plat pour un restaurant : Map(menuId → {prix, disponible}). */
async function prixDe(restaurantId) {
  if (!restaurantId) return new Map();
  const rows = await prisma.prixRestaurantYakro.findMany({ where: { restaurantId } });
  return new Map(rows.map(r => [r.menuId, { prix: r.prix, disponible: r.disponible }]));
}

/** Applique les prix du restaurant sur une liste de plats du menu commun. */
function appliquerPrix(items, prix) {
  return items.map(i => {
    const o = prix.get(i.id);
    return o ? { ...i, prixBase: i.prix, prix: o.prix, disponible: i.disponible && o.disponible } : { ...i, prixBase: i.prix };
  });
}

const MODE_PARAM = { ESPECES: 'paiement_especes', ORANGE_MONEY: 'paiement_om', MTN_MONEY: 'paiement_mtn', MOOV_MONEY: 'paiement_moov', WAVE: 'paiement_wave', BANQUE: 'paiement_banque' };
const TYPE_PARAM = { SUR_PLACE: 'service_actif', EMPORTER: 'emporter_actif', LIVRAISON: 'livraison_actif' };

module.exports = {
  MODE_PARAM, TYPE_PARAM,
  PERMISSIONS, TOUTES, PROFILS_DEFAUT, PARAMETRES, ROLES_ADMIN,
  parametresDe, assurerProfilsDefaut, assurerRestaurantDefaut,
  accesDe, resto, can, sc, prixDe, appliquerPrix,
};
