const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');

// GET /api/dashboard/groupe
router.get('/groupe', auth, async (req, res) => {
  try {
    const debut = new Date(); debut.setDate(1); debut.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);

    const [
      caYakro, caissesAll, nbEmployes,
      lotsVendus, retards, livraisonsJour,
      motosActives, motosTotal, projetsActifs,
    ] = await Promise.all([
      prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: debut } } }),
      prisma.caisse.findMany({ where: { actif: true } }),
      prisma.employe.count({ where: { statut: 'ACTIF' } }),
      prisma.lot.count({ where: { statut: 'VENDU' } }),
      prisma.echeancier.count({ where: { statut: 'RETARD' } }),
      prisma.livraison.count({ where: { createdAt: { gte: today } } }),
      prisma.moto.count({ where: { statut: 'DISPONIBLE' } }),
      prisma.moto.count(),
      prisma.projetFoncier.count({ where: { statut: 'EN_COURS' } }),
    ]);

    const tresorie = caissesAll.reduce((s, c) => s + c.solde, 0);
    const caGroupe = caYakro._sum.montant || 0;

    // Scores santé filiales
    const scores = {
      yakro: Math.min(100, Math.round(caGroupe > 0 ? 85 : 28)),
      toptelsig: Math.min(100, Math.round(lotsVendus > 0 ? 80 : 28)),
      liya: Math.min(100, Math.round(livraisonsJour > 0 ? 82 : 28)),
    };

    res.json({
      ca: { groupe: caGroupe, yakro: caGroupe },
      tresorerie: tresorie,
      employes: { actifs: nbEmployes },
      yakro: { caJour: caGroupe, tables: 12 },
      toptelsig: { lotsVendus, projetsActifs, retards },
      liya: { livraisonsJour, motosActives, motosTotal },
      scores,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/dashboard/alertes
router.get('/alertes', auth, async (req, res) => {
  try {
    const today = new Date();
    const dans30j = new Date(); dans30j.setDate(today.getDate() + 30);
    const alertes = [];

    // Motos assurance
    const motosAss = await prisma.moto.findMany({
      where: { dateExpirationAssurance: { not: null, lte: dans30j } },
      select: { id: true, immatriculation: true, marque: true, dateExpirationAssurance: true }
    });
    motosAss.forEach(m => {
      const expire = new Date(m.dateExpirationAssurance) <= today;
      alertes.push({ type: 'ASSURANCE_MOTO', gravite: expire ? 'CRITIQUE' : 'ATTENTION',
        message: `Assurance ${m.immatriculation} ${expire ? 'expirée' : 'expire bientôt'}`,
        detail: new Date(m.dateExpirationAssurance).toLocaleDateString('fr'), filiale: 'LIYA', entiteId: m.id });
    });

    // Motos visite technique
    const motosV = await prisma.moto.findMany({
      where: { dateVisiteTechnique: { not: null, lte: dans30j } },
      select: { id: true, immatriculation: true, dateVisiteTechnique: true }
    });
    motosV.forEach(m => {
      const expire = new Date(m.dateVisiteTechnique) <= today;
      alertes.push({ type: 'VISITE_TECHNIQUE', gravite: expire ? 'CRITIQUE' : 'ATTENTION',
        message: `Visite technique ${m.immatriculation} ${expire ? 'expirée' : 'expire bientôt'}`,
        detail: new Date(m.dateVisiteTechnique).toLocaleDateString('fr'), filiale: 'LIYA', entiteId: m.id });
    });

    // Caisses faibles — SEULEMENT si elles ont eu des transactions (ne pas alerter au démarrage)
    const caissesAvecMouvements = await prisma.encaissement.groupBy({
      by: ['caisseId'], _count: { id: true }
    });
    const caisseIdsActives = new Set(caissesAvecMouvements.map(c => c.caisseId));
    const caissesFaibles = await prisma.caisse.findMany({ where: { actif: true, solde: { lt: 50000 } } });
    caissesFaibles
      .filter(c => caisseIdsActives.has(c.id)) // seulement si elle a déjà eu des encaissements
      .forEach(c => alertes.push({
        type: 'CAISSE_FAIBLE', gravite: c.solde <= 0 ? 'CRITIQUE' : 'ATTENTION',
        message: `Caisse "${c.nom}" : ${c.solde.toLocaleString('fr')} F`,
        detail: c.solde <= 0 ? 'Solde épuisé' : 'Solde bas', filiale: c.filiale, entiteId: c.id,
      }));

    // Retards TOPTELSIG
    const retards = await prisma.echeancier.count({ where: { statut: 'RETARD' } });
    if (retards > 0) alertes.push({
      type: 'RETARDS_PAIEMENT', gravite: retards > 5 ? 'CRITIQUE' : 'ATTENTION',
      message: `${retards} échéance(s) en retard`, detail: 'Paiements fonciers TOPTELSIG', filiale: 'TOPTELSIG',
    });

    // Stock bas
    const stocksBas = await prisma.produit.findMany({ select: { id: true, nom: true, filiale: true, stockAlert: true, stocks: { select: { quantite: true } } } });
    stocksBas.filter(p => p.stocks.reduce((s, st) => s + st.quantite, 0) <= p.stockAlert && p.stocks.length > 0)
      .slice(0, 3).forEach(p => alertes.push({
        type: 'STOCK_BAS', gravite: 'ATTENTION',
        message: `Stock bas : ${p.nom}`, detail: `Seuil d'alerte atteint`, filiale: p.filiale, entiteId: p.id,
      }));

    const critiques = alertes.filter(a => a.gravite === 'CRITIQUE').length;
    res.json({ alertes, critiques, total: alertes.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/dashboard/score-sante
router.get('/score-sante', auth, async (req, res) => {
  try {
    const scores = [
      { filiale: 'YAKRO_GRILL', score: 75, label: 'Yakro Grill', detail: 'Restaurant opérationnel' },
      { filiale: 'TOPTELSIG', score: 72, label: 'TOPTELSIG', detail: 'Foncier actif' },
      { filiale: 'LIYA', score: 78, label: 'LiYA', detail: 'Livraisons en cours' },
    ];
    res.json(scores);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
