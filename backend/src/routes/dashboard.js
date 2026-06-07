const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');

// GET /api/dashboard/groupe — Vue DG consolidée
router.get('/groupe', auth, async (req, res) => {
  try {
    const today = new Date();
    const debutMois = new Date(today.getFullYear(), today.getMonth(), 1);
    const debutJour = new Date(today.setHours(0, 0, 0, 0));

    // CA du jour Yakro Grill
    const caYakroJour = await prisma.paiementYakro.aggregate({
      _sum: { montant: true },
      where: { createdAt: { gte: debutJour } }
    });

    // Commandes actives Yakro
    const commandesActives = await prisma.commandeYakro.count({
      where: { statut: { in: ['EN_COURS', 'CUISINE', 'PRETE'] } }
    });

    // Tables occupées
    const tablesOccupees = await prisma.tableRestaurant.count({
      where: { statut: 'OCCUPEE' }
    });
    const tablesTotal = await prisma.tableRestaurant.count();

    // Souscripteurs en retard (écheanciers)
    const retards = await prisma.echeancier.count({
      where: { statut: 'RETARD' }
    });

    // Lots vendus ce mois
    const lotsVendusMois = await prisma.venteFoncier.count({
      where: { dateVente: { gte: debutMois } }
    });

    // Livraisons du jour
    const livraisonsJour = await prisma.livraison.count({
      where: { createdAt: { gte: debutJour } }
    });

    // Motos actives
    const motosActives = await prisma.moto.count({ where: { statut: 'EN_LIVRAISON' } });
    const motosTotal = await prisma.moto.count();

    // Encaissements du mois par filiale
    const encMois = await prisma.encaissement.groupBy({
      by: ['filiale'],
      _sum: { montant: true },
      where: { createdAt: { gte: debutMois } }
    });

    // Employés actifs
    const employes = await prisma.employe.groupBy({
      by: ['filiale'],
      _count: { id: true },
      where: { statut: 'ACTIF' }
    });

    // Timeline (30 dernières activités)
    const timeline = await buildTimeline();

    // Score santé
    const scores = await prisma.scoreSante.findMany({
      orderBy: { calculeLe: 'desc' },
      take: 4
    });

    res.json({
      yakro: {
        caJour: caYakroJour._sum.montant || 0,
        commandesActives,
        tablesOccupees,
        tablesTotal,
      },
      toptelsig: {
        retards,
        lotsVendusMois,
        souscripteurs: await prisma.souscripteur.count(),
        projetsActifs: await prisma.projetFoncier.count({ where: { statut: 'EN_COURS' } }),
      },
      liya: {
        livraisonsJour,
        motosActives,
        motosTotal,
        enTransit: await prisma.livraison.count({ where: { statut: 'EN_ROUTE' } }),
      },
      finance: { encaissements: encMois },
      employes,
      timeline,
      scoresSante: scores,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function buildTimeline() {
  const [commandes, paiementsFoncier, livraisons] = await Promise.all([
    prisma.commandeYakro.findMany({
      orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, numero: true, statut: true, total: true, createdAt: true }
    }),
    prisma.paiementFoncier.findMany({
      orderBy: { createdAt: 'desc' }, take: 5,
      include: { souscripteur: { select: { nom: true, prenom: true } }, echeancier: true },
    }),
    prisma.livraison.findMany({
      orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, numero: true, statut: true, clientNom: true, createdAt: true }
    }),
  ]);

  const events = [
    ...commandes.map(c => ({
      id: c.id, type: 'COMMANDE', filiale: 'YAKRO_GRILL',
      label: `Commande POS ${c.numero} — ${c.statut}`,
      montant: c.total, date: c.createdAt,
    })),
    ...paiementsFoncier.map(p => ({
      id: p.id, type: 'PAIEMENT_FONCIER', filiale: 'TOPTELSIG',
      label: `Paiement reçu — ${p.souscripteur.prenom} ${p.souscripteur.nom}`,
      montant: p.montant, date: p.createdAt,
    })),
    ...livraisons.map(l => ({
      id: l.id, type: 'LIVRAISON', filiale: 'LIYA',
      label: `Livraison ${l.numero} — ${l.clientNom}`,
      montant: null, date: l.createdAt,
    })),
  ];

  return events.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
}

// GET /api/dashboard/score-sante
router.get('/score-sante', auth, async (req, res) => {
  try {
    const filiales = ['YAKRO_GRILL', 'TOPTELSIG', 'LIYA'];
    const scores = {};

    for (const filiale of filiales) {
      const score = await calculerScore(filiale);
      scores[filiale] = score;

      await prisma.scoreSante.create({ data: { filiale, ...score } });
    }

    res.json(scores);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function calculerScore(filiale) {
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const encaissements = await prisma.encaissement.aggregate({
    _sum: { montant: true },
    where: { filiale, createdAt: { gte: debutMois } }
  });

  const decaissements = await prisma.decaissement.aggregate({
    _sum: { montant: true },
    where: { filiale, createdAt: { gte: debutMois } }
  });

  const ca = encaissements._sum.montant || 0;
  const charges = decaissements._sum.montant || 0;
  const tresorerie = Math.max(0, ca - charges);

  let retards = 0;
  if (filiale === 'TOPTELSIG') {
    retards = await prisma.echeancier.count({ where: { statut: 'RETARD' } });
  }

  const employes = await prisma.employe.count({ where: { filiale, statut: 'ACTIF' } });

  const scoreCA = Math.min(100, (ca / 5000000) * 100);
  const scoreTreso = Math.min(100, (tresorerie / 2000000) * 100);
  const scoreRetards = Math.max(0, 100 - retards * 10);
  const scoreEmployes = employes > 0 ? 80 : 50;

  const score = (scoreCA * 0.35 + scoreTreso * 0.30 + scoreRetards * 0.20 + scoreEmployes * 0.15);

  return {
    score: Math.round(score),
    tresorerie,
    ca,
    productivite: scoreEmployes,
    stocks: 75,
    retards,
    impayes: retards,
  };
}

module.exports = router;

// GET /api/dashboard/alertes — Alertes critiques temps réel
router.get('/alertes', auth, async (req, res) => {
  try {
    const today = new Date();
    const dans30j = new Date(today);
    dans30j.setDate(today.getDate() + 30);

    const alertes = [];

    // Motos assurance expirée ou proche
    const motosAssurance = await prisma.moto.findMany({
      where: { dateExpirationAssurance: { lte: dans30j } },
      select: { id: true, immatriculation: true, marque: true, dateExpirationAssurance: true }
    });
    motosAssurance.forEach(m => alertes.push({
      type: 'ASSURANCE_MOTO',
      gravite: new Date(m.dateExpirationAssurance) <= today ? 'CRITIQUE' : 'ATTENTION',
      message: `Assurance ${m.immatriculation} ${new Date(m.dateExpirationAssurance) <= today ? 'expirée' : 'expire bientôt'}`,
      detail: new Date(m.dateExpirationAssurance).toLocaleDateString('fr'),
      filiale: 'LIYA', entiteId: m.id,
    }));

    // Motos visite technique expirée
    const motosVisite = await prisma.moto.findMany({
      where: { dateVisiteTechnique: { lte: dans30j } },
      select: { id: true, immatriculation: true, dateVisiteTechnique: true }
    });
    motosVisite.forEach(m => alertes.push({
      type: 'VISITE_TECHNIQUE',
      gravite: new Date(m.dateVisiteTechnique) <= today ? 'CRITIQUE' : 'ATTENTION',
      message: `Visite technique ${m.immatriculation} ${new Date(m.dateVisiteTechnique) <= today ? 'expirée' : 'expire bientôt'}`,
      detail: new Date(m.dateVisiteTechnique).toLocaleDateString('fr'),
      filiale: 'LIYA', entiteId: m.id,
    }));

    // Caisses faibles (< 50 000 FCFA)
    const caissesFaibles = await prisma.caisse.findMany({
      where: { actif: true, solde: { lt: 50000 } },
      select: { id: true, nom: true, filiale: true, solde: true }
    });
    caissesFaibles.forEach(c => alertes.push({
      type: 'CAISSE_FAIBLE',
      gravite: c.solde <= 0 ? 'CRITIQUE' : 'ATTENTION',
      message: `Caisse "${c.nom}" (${c.filiale}) : ${c.solde.toLocaleString('fr')} F`,
      detail: c.solde <= 0 ? 'Solde épuisé' : 'Solde bas',
      filiale: c.filiale, entiteId: c.id,
    }));

    // Échéanciers en retard TOPTELSIG
    const retards = await prisma.echeancier.count({
      where: { statut: 'RETARD', dateEcheance: { lt: today } }
    });
    if (retards > 0) alertes.push({
      type: 'RETARDS_PAIEMENT',
      gravite: retards > 5 ? 'CRITIQUE' : 'ATTENTION',
      message: `${retards} échéance(s) en retard`,
      detail: 'TOPTELSIG — paiements fonciers',
      filiale: 'TOPTELSIG',
    });

    // Stocks bas
    const stocksBas = await prisma.stock.findMany({
      where: {},
      include: { produit: { select: { nom: true, stockAlert: true, filiale: true } } }
    });
    const alertesStock = stocksBas.filter(s => s.quantite <= s.produit.stockAlert);
    if (alertesStock.length > 0) alertes.push({
      type: 'STOCK_BAS',
      gravite: 'ATTENTION',
      message: `${alertesStock.length} produit(s) en alerte stock`,
      detail: alertesStock.slice(0, 3).map(s => s.produit.nom).join(', '),
      filiale: 'GROUPE',
    });

    // Pertes stock anormales ce mois (> 50 000 FCFA)
    const debutMois = new Date(today.getFullYear(), today.getMonth(), 1);
    const pertesStock = await prisma.mouvementStock.findMany({
      where: { type: 'PERTE', createdAt: { gte: debutMois } },
      include: { produit: { select: { prixAchat: true, filiale: true } } }
    });
    const valeurPertes = pertesStock.reduce((s, m) => s + m.quantite * (m.produit.prixAchat || 0), 0);
    if (valeurPertes > 50000) alertes.push({
      type: 'PERTES_STOCK',
      gravite: 'ATTENTION',
      message: `Pertes stock ce mois : ${valeurPertes.toLocaleString('fr')} F`,
      detail: `${pertesStock.length} mouvement(s) de perte`,
      filiale: 'YAKRO_GRILL',
    });

    // Trier par gravité
    const ordre = { CRITIQUE: 0, ATTENTION: 1 };
    alertes.sort((a, b) => (ordre[a.gravite] || 2) - (ordre[b.gravite] || 2));

    res.json({
      total: alertes.length,
      critiques: alertes.filter(a => a.gravite === 'CRITIQUE').length,
      alertes
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
