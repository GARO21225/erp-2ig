/**
 * Assistant ERP — moteur de questions-réponses SANS appel à une IA externe.
 *
 * L'intégration initiale appelait directement l'API Anthropic depuis le
 * navigateur du client, ce qui ne peut pas fonctionner (pas de clé API
 * exposable côté frontend sans risque de sécurité, et aucune clé n'était
 * configurée). Plutôt que de dépendre d'un service payant pour un besoin
 * qui est en réalité un calcul sur des données déjà en base, ce module
 * répond aux questions du cahier des charges initial par de vraies
 * requêtes Prisma : pas de coût récurrent, pas de dépendance externe,
 * réponse instantanée et garantie correcte (calculée, pas générée).
 *
 * Chaque question prédéfinie (boutons de suggestion côté frontend) a
 * son propre calcul. Pas de NLP générique : si une question hors de
 * cette liste est posée, l'assistant le dit clairement plutôt que
 * d'improviser une réponse fausse.
 */
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');

const fmtF = (n) => `${Math.round(n || 0).toLocaleString('fr')} F`;

// ── Catalogue des questions disponibles, par filiale ─────────────────────────
// Sert à la fois à afficher les suggestions côté frontend et à router
// la question posée vers le bon calcul (par identifiant, pas par texte libre).
const QUESTIONS = {
  GROUPE: [
    { id: 'ca_mois', label: 'Quel est le CA total ce mois ?' },
    { id: 'projets_budget_depasse', label: 'Quels projets dépassent leur budget ?' },
    { id: 'souscripteurs_retard', label: 'Combien de souscripteurs sont en retard ?' },
  ],
  TOPTELSIG: [
    { id: 'clients_impayes', label: 'Quels clients ont des impayés ?' },
    { id: 'meilleur_commercial', label: 'Quel commercial a le meilleur taux de conversion ?' },
    { id: 'lots_disponibles', label: 'Quels lots sont disponibles ?' },
  ],
  YAKRO_GRILL: [
    { id: 'ca_jour_yakro', label: 'Quel est le CA du jour ?' },
    { id: 'produits_sous_seuil', label: 'Quels produits sont sous seuil ?' },
    { id: 'meilleur_serveur', label: 'Quel serveur a généré le plus de CA ?' },
  ],
  LIYA: [
    { id: 'livraisons_attente', label: 'Combien de livraisons en attente ?' },
    { id: 'motos_assurance', label: 'Quelles motos ont l\'assurance qui expire ?' },
    { id: 'partenaire_top_stock', label: 'Quel partenaire a le plus de stock ?' },
  ],
};

router.get('/questions', auth, (req, res) => {
  res.json(QUESTIONS);
});

// ── Calculs ────────────────────────────────────────────────────────────────

async function caMois() {
  const debut = new Date(); debut.setDate(1); debut.setHours(0, 0, 0, 0);
  const [foncier, yakro] = await Promise.all([
    prisma.paiementFoncier.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: debut } } }),
    prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: debut } } }),
  ]);
  const total = (foncier._sum.montant || 0) + (yakro._sum.montant || 0);
  return `Le CA total depuis le 1er de ce mois est de ${fmtF(total)} (TOPTELSIG : ${fmtF(foncier._sum.montant)} + Yakro Grill : ${fmtF(yakro._sum.montant)}).`;
}

async function projetsBudgetDepasse() {
  const projets = await prisma.projetFoncier.findMany({
    where: { budgetTotal: { not: null } },
    include: { depenses: { where: { statut: { in: ['PAYEE', 'JUSTIFIEE', 'CLOTUREE'] } }, select: { montant: true } } },
  });
  const enDepassement = projets
    .map(p => ({ nom: p.nom, budget: p.budgetTotal, depense: p.depenses.reduce((s, d) => s + d.montant, 0) }))
    .filter(p => p.depense > p.budget);
  if (enDepassement.length === 0) return 'Aucun projet ne dépasse son budget actuellement.';
  return `${enDepassement.length} projet(s) dépassent leur budget :\n` +
    enDepassement.map(p => `• ${p.nom} : ${fmtF(p.depense)} dépensés pour un budget de ${fmtF(p.budget)} (dépassement de ${fmtF(p.depense - p.budget)})`).join('\n');
}

async function souscripteursRetard() {
  const retards = await prisma.echeancier.findMany({
    where: { statut: 'RETARD' },
    include: { vente: { include: { souscripteur: { select: { nom: true, prenom: true } } } } },
  });
  if (retards.length === 0) return 'Aucun souscripteur en retard de paiement actuellement.';
  const parSouscripteur = {};
  retards.forEach(e => {
    const key = `${e.vente.souscripteur.prenom} ${e.vente.souscripteur.nom}`;
    parSouscripteur[key] = (parSouscripteur[key] || 0) + (e.montant - e.montantPaye);
  });
  const nb = Object.keys(parSouscripteur).length;
  const top5 = Object.entries(parSouscripteur).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `${nb} souscripteur(s) ont au moins une échéance en retard, pour ${retards.length} échéance(s) au total.\n` +
    `Les plus importants :\n` + top5.map(([nom, montant]) => `• ${nom} : ${fmtF(montant)} en retard`).join('\n');
}

async function clientsImpayes() {
  const ventes = await prisma.venteFoncier.findMany({
    where: { statut: { not: 'SOLDE' } },
    include: { souscripteur: { select: { nom: true, prenom: true, telephone: true } }, paiements: true, lot: { select: { numero: true } } },
  });
  const impayes = ventes
    .map(v => ({ nom: `${v.souscripteur.prenom} ${v.souscripteur.nom}`, tel: v.souscripteur.telephone, lot: v.lot.numero, restant: v.prixVente - v.paiements.reduce((s, p) => s + p.montant, 0) }))
    .filter(v => v.restant > 0)
    .sort((a, b) => b.restant - a.restant);
  if (impayes.length === 0) return 'Aucun client avec un impayé actuellement — toutes les ventes sont soldées.';
  const top10 = impayes.slice(0, 10);
  return `${impayes.length} vente(s) avec un solde restant à payer, pour un total de ${fmtF(impayes.reduce((s, v) => s + v.restant, 0))}.\n` +
    `Les 10 plus importants :\n` + top10.map(v => `• ${v.nom} (lot ${v.lot}, ${v.tel}) : ${fmtF(v.restant)} restant`).join('\n');
}

async function meilleurCommercial() {
  const ventes = await prisma.venteFoncier.findMany({ select: { souscripteur: { select: { commercialNom: true } } } });
  const prospectsParCommercial = await prisma.souscripteur.groupBy({ by: ['commercialNom'], _count: { id: true }, where: { commercialNom: { not: null } } });
  const conversionsParCommercial = {};
  ventes.forEach(v => {
    const c = v.souscripteur?.commercialNom;
    if (c) conversionsParCommercial[c] = (conversionsParCommercial[c] || 0) + 1;
  });
  const taux = prospectsParCommercial
    .map(p => ({ nom: p.commercialNom, prospects: p._count.id, conversions: conversionsParCommercial[p.commercialNom] || 0 }))
    .map(c => ({ ...c, taux: c.prospects > 0 ? Math.round(c.conversions / c.prospects * 100) : 0 }))
    .filter(c => c.prospects >= 3) // évite les faux taux de 100% sur 1 seul prospect
    .sort((a, b) => b.taux - a.taux);
  if (taux.length === 0) return 'Pas assez de données pour calculer un taux de conversion fiable par commercial (minimum 3 prospects suivis).';
  const meilleur = taux[0];
  return `${meilleur.nom} a le meilleur taux de conversion : ${meilleur.taux}% (${meilleur.conversions} vente(s) sur ${meilleur.prospects} prospect(s) suivis).\n` +
    (taux.length > 1 ? `\nClassement complet :\n` + taux.slice(0, 5).map((c, i) => `${i + 1}. ${c.nom} : ${c.taux}% (${c.conversions}/${c.prospects})`).join('\n') : '');
}

async function lotsDisponibles() {
  const lots = await prisma.lot.findMany({ where: { statut: 'DISPONIBLE' }, include: { projet: { select: { nom: true } } } });
  if (lots.length === 0) return 'Aucun lot disponible actuellement — tout est réservé ou vendu.';
  const parProjet = {};
  lots.forEach(l => { parProjet[l.projet.nom] = (parProjet[l.projet.nom] || 0) + 1; });
  return `${lots.length} lot(s) disponible(s) au total :\n` +
    Object.entries(parProjet).map(([nom, n]) => `• ${nom} : ${n} lot(s)`).join('\n');
}

async function caJourYakro() {
  const debut = new Date(); debut.setHours(0, 0, 0, 0);
  const result = await prisma.paiementYakro.aggregate({ _sum: { montant: true }, _count: { id: true }, where: { createdAt: { gte: debut } } });
  return `Le CA du jour pour Yakro Grill est de ${fmtF(result._sum.montant)} (${result._count.id} paiement(s) enregistré(s)).`;
}

async function produitsSousSeuil() {
  const produits = await prisma.produit.findMany({
    where: { actif: true, filiale: 'YAKRO_GRILL' },
    include: { stocks: { select: { quantite: true } } },
  });
  const sousSeuils = produits
    .map(p => ({ nom: p.nom, total: p.stocks.reduce((s, st) => s + st.quantite, 0), seuil: p.stockAlert }))
    .filter(p => p.total <= p.seuil);
  if (sousSeuils.length === 0) return 'Aucun produit sous le seuil d\'alerte actuellement.';
  return `${sousSeuils.length} produit(s) sous le seuil d'alerte :\n` +
    sousSeuils.map(p => `• ${p.nom} : ${p.total} en stock (seuil : ${p.seuil})`).join('\n');
}

async function meilleurServeur() {
  const debut = new Date(); debut.setDate(debut.getDate() - 30);
  const commandes = await prisma.commandeYakro.findMany({
    where: { statut: 'PAYEE', createdAt: { gte: debut }, serveurNom: { not: null } },
    select: { serveurNom: true, total: true },
  });
  const parServeur = {};
  commandes.forEach(c => {
    parServeur[c.serveurNom] = (parServeur[c.serveurNom] || 0) + (c.total || 0);
  });
  const classement = Object.entries(parServeur).sort((a, b) => b[1] - a[1]);
  if (classement.length === 0) return 'Pas assez de données sur les 30 derniers jours pour identifier un serveur.';
  const [nom, ca] = classement[0];
  return `${nom} a généré le plus de CA sur les 30 derniers jours : ${fmtF(ca)}.\n` +
    (classement.length > 1 ? `\nClassement :\n` + classement.slice(0, 5).map(([n, c], i) => `${i + 1}. ${n} : ${fmtF(c)}`).join('\n') : '');
}

async function livraisonsAttente() {
  const livraisons = await prisma.livraison.findMany({ where: { statut: 'EN_ATTENTE' } });
  if (livraisons.length === 0) return 'Aucune livraison en attente actuellement.';
  return `${livraisons.length} livraison(s) en attente de prise en charge, pour un montant total de ${fmtF(livraisons.reduce((s, l) => s + (l.montant || 0), 0))}.`;
}

async function motosAssurance() {
  const dans30j = new Date(); dans30j.setDate(dans30j.getDate() + 30);
  const motos = await prisma.moto.findMany({ where: { dateExpirationAssurance: { not: null, lte: dans30j } } });
  if (motos.length === 0) return 'Aucune moto n\'a une assurance qui expire dans les 30 prochains jours.';
  const today = new Date();
  return `${motos.length} moto(s) avec une assurance qui expire bientôt :\n` +
    motos.map(m => {
      const expiree = new Date(m.dateExpirationAssurance) <= today;
      return `• ${m.immatriculation} : ${expiree ? 'EXPIRÉE le' : 'expire le'} ${new Date(m.dateExpirationAssurance).toLocaleDateString('fr')}`;
    }).join('\n');
}

async function partenaireTopStock() {
  const partenaires = await prisma.partenaire.findMany({
    where: { actif: true },
    include: { stocks3pl: { where: { statut: 'EN_STOCK' }, select: { quantite: true } } },
  });
  const classement = partenaires
    .map(p => ({ nom: p.nom, total: p.stocks3pl.reduce((s, st) => s + st.quantite, 0) }))
    .filter(p => p.total > 0)
    .sort((a, b) => b.total - a.total);
  if (classement.length === 0) return 'Aucun partenaire n\'a de stock actif actuellement.';
  return `${classement[0].nom} a le plus de stock en dépôt : ${classement[0].total} article(s).\n` +
    (classement.length > 1 ? `\nClassement :\n` + classement.slice(0, 5).map((p, i) => `${i + 1}. ${p.nom} : ${p.total} article(s)`).join('\n') : '');
}

const HANDLERS = {
  ca_mois: caMois,
  projets_budget_depasse: projetsBudgetDepasse,
  souscripteurs_retard: souscripteursRetard,
  clients_impayes: clientsImpayes,
  meilleur_commercial: meilleurCommercial,
  lots_disponibles: lotsDisponibles,
  ca_jour_yakro: caJourYakro,
  produits_sous_seuil: produitsSousSeuil,
  meilleur_serveur: meilleurServeur,
  livraisons_attente: livraisonsAttente,
  motos_assurance: motosAssurance,
  partenaire_top_stock: partenaireTopStock,
};

// ── POST /query — Répondre à une question prédéfinie ──────────────────────
router.post('/query', auth, async (req, res) => {
  try {
    const { questionId } = req.body;
    const handler = HANDLERS[questionId];
    if (!handler) {
      return res.json({
        reponse: 'Cette question n\'est pas encore disponible. Choisissez une question parmi les suggestions proposées — l\'assistant répond uniquement à partir de calculs vérifiés sur vos données, pas par génération de texte libre.',
      });
    }
    const reponse = await handler();
    res.json({ reponse });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
