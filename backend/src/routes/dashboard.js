const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');

// ── GET /api/dashboard/groupe — Données complètes DG
router.get('/groupe', auth, async (req, res) => {
  try {
    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const debutSemaine = new Date(now); debutSemaine.setDate(now.getDate() - 6); debutSemaine.setHours(0,0,0,0);
    const hier = new Date(now); hier.setDate(now.getDate() - 1); hier.setHours(0,0,0,0);
    const today = new Date(now); today.setHours(0,0,0,0);

    const [
      caYakroMois, caYakroHier, caYakroAujourd,
      nbCommandes, nbCommandesPayees,
      caisses, nbEmployes, nbEmployesParFiliale,
      lotsVendus, lotsDispo, lotsTotal, projetsActifs,
      retards, nbSouscripteurs,
      livJour, livSemaine, livTaux, motosActives, motosTotal,
      encaissementsParJour, encaissementsParFiliale,
    ] = await Promise.all([
      prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: debutMois } } }),
      prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: hier, lt: today } } }),
      prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: today } } }),
      prisma.commandeYakro.count({ where: { createdAt: { gte: today } } }),
      prisma.commandeYakro.count({ where: { statut: 'PAYEE', createdAt: { gte: today } } }),
      prisma.caisse.findMany({ where: { actif: true } }),
      prisma.employe.count({ where: { statut: 'ACTIF' } }),
      prisma.employe.groupBy({ by: ['filiale'], _count: { id: true }, where: { statut: 'ACTIF' } }),
      prisma.lot.count({ where: { statut: 'VENDU' } }),
      prisma.lot.count({ where: { statut: 'DISPONIBLE' } }),
      prisma.lot.count(),
      prisma.projetFoncier.count({ where: { statut: 'EN_COURS' } }),
      prisma.echeancier.count({ where: { statut: 'RETARD' } }),
      prisma.souscripteur.count(),
      prisma.livraison.count({ where: { createdAt: { gte: today } } }),
      prisma.livraison.count({ where: { createdAt: { gte: debutSemaine } } }),
      prisma.livraison.count({ where: { statut: 'LIVRE', createdAt: { gte: debutSemaine } } }),
      prisma.moto.count({ where: { statut: 'DISPONIBLE' } }),
      prisma.moto.count(),
      // Évolution CA sur 7 jours
      prisma.paiementYakro.groupBy({ by: ['createdAt'], _sum: { montant: true }, where: { createdAt: { gte: debutSemaine } } }),
      // CA par filiale
      prisma.encaissement.groupBy({ by: ['filiale'], _sum: { montant: true }, where: { createdAt: { gte: debutMois } } }),
    ]);

    // Construire courbe CA 7 jours
    const caParJour = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('fr', { weekday: 'short', day: 'numeric' });
      caParJour[key] = 0;
    }
    encaissementsParJour.forEach(e => {
      const key = new Date(e.createdAt).toLocaleDateString('fr', { weekday: 'short', day: 'numeric' });
      if (caParJour[key] !== undefined) caParJour[key] += e._sum.montant || 0;
    });
    const courbeCA = Object.entries(caParJour).map(([jour, ca]) => ({ jour, ca }));

    // CA par filiale pour camembert
    const caFilialeMap = { YAKRO_GRILL: 0, TOPTELSIG: 0, LIYA: 0 };
    encaissementsParFiliale.forEach(e => { caFilialeMap[e.filiale] = (e._sum.montant || 0); });
    caFilialeMap['YAKRO_GRILL'] = Math.max(caFilialeMap['YAKRO_GRILL'], caYakroMois._sum.montant || 0);
    const camembertCA = Object.entries(caFilialeMap).map(([name, value]) => ({ name: name.replace('_', ' '), value }));

    // Employés par filiale
    const empParFiliale = nbEmployesParFiliale.map(e => ({
      filiale: e.filiale.replace('_', ' '), count: e._count.id
    }));

    const tresorerie = caisses.reduce((s, c) => s + c.solde, 0);
    const tauxLiv = livSemaine > 0 ? Math.round(livTaux / livSemaine * 100) : 0;

    res.json({
      ca: {
        mois: caYakroMois._sum.montant || 0,
        hier: caYakroHier._sum.montant || 0,
        aujourdhui: caYakroAujourd._sum.montant || 0,
        evolution: Math.round(((caYakroAujourd._sum.montant || 0) - (caYakroHier._sum.montant || 0)) / Math.max(caYakroHier._sum.montant || 1, 1) * 100),
      },
      tresorerie,
      commandes: { total: nbCommandes, payees: nbCommandesPayees, tauxConversion: nbCommandes > 0 ? Math.round(nbCommandesPayees / nbCommandes * 100) : 0 },
      employes: { actifs: nbEmployes, parFiliale: empParFiliale },
      toptelsig: { lotsVendus, lotsDispo, lotsTotal, projetsActifs, retards, souscripteurs: nbSouscripteurs, tauxVente: lotsTotal > 0 ? Math.round(lotsVendus / lotsTotal * 100) : 0 },
      liya: { livraisonsJour: livJour, livraisonsSemaine: livSemaine, motosActives, motosTotal, tauxReussite: tauxLiv },
      graphiques: { courbeCA, camembertCA, empParFiliale },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/dashboard/alertes
router.get('/alertes', auth, async (req, res) => {
  try {
    const today = new Date();
    const dans30j = new Date(); dans30j.setDate(today.getDate() + 30);
    const alertes = [];

    const [motosAss, motosV, caisses, retards, stocksBas] = await Promise.all([
      prisma.moto.findMany({ where: { dateExpirationAssurance: { not: null, lte: dans30j } }, select: { id:true, immatriculation:true, dateExpirationAssurance:true } }),
      prisma.moto.findMany({ where: { dateVisiteTechnique: { not: null, lte: dans30j } }, select: { id:true, immatriculation:true, dateVisiteTechnique:true } }),
      prisma.caisse.findMany({ where: { actif: true } }),
      prisma.echeancier.count({ where: { statut: 'RETARD' } }),
      prisma.produit.findMany({ select: { id:true, nom:true, filiale:true, stockAlert:true, stocks: { select: { quantite: true } } } }),
    ]);

    motosAss.forEach(m => alertes.push({ type:'ASSURANCE_MOTO', gravite: new Date(m.dateExpirationAssurance) <= today ? 'CRITIQUE':'ATTENTION', message:`Assurance ${m.immatriculation} ${new Date(m.dateExpirationAssurance) <= today?'expirée':'expire bientôt'}`, detail: new Date(m.dateExpirationAssurance).toLocaleDateString('fr'), filiale:'LIYA', entiteId:m.id }));
    motosV.forEach(m => alertes.push({ type:'VISITE_TECHNIQUE', gravite: new Date(m.dateVisiteTechnique) <= today ? 'CRITIQUE':'ATTENTION', message:`Visite technique ${m.immatriculation}`, detail: new Date(m.dateVisiteTechnique).toLocaleDateString('fr'), filiale:'LIYA', entiteId:m.id }));

    // Caisses : alerter seulement si solde a déjà eu des mouvements
    const caisseIdsAvecMvt = new Set((await prisma.encaissement.groupBy({ by: ['caisseId'], _count:{ id:true } })).map(e => e.caisseId));
    caisses.filter(c => c.solde < 50000 && caisseIdsAvecMvt.has(c.id)).forEach(c => alertes.push({ type:'CAISSE_FAIBLE', gravite: c.solde <= 0?'CRITIQUE':'ATTENTION', message:`Caisse "${c.nom}": ${c.solde.toLocaleString('fr')} F`, detail: c.solde <= 0?'Solde épuisé':'Solde bas', filiale:c.filiale, entiteId:c.id }));
    if (retards > 0) alertes.push({ type:'RETARDS_PAIEMENT', gravite: retards > 5?'CRITIQUE':'ATTENTION', message:`${retards} échéance(s) en retard`, detail:'Paiements fonciers TOPTELSIG', filiale:'TOPTELSIG' });
    stocksBas.filter(p => p.stocks.length > 0 && p.stocks.reduce((s,st) => s+st.quantite,0) <= p.stockAlert).slice(0,3).forEach(p => alertes.push({ type:'STOCK_BAS', gravite:'ATTENTION', message:`Stock bas: ${p.nom}`, filiale:p.filiale, entiteId:p.id }));

    res.json({ alertes, critiques: alertes.filter(a => a.gravite === 'CRITIQUE').length, total: alertes.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/dashboard/score-sante
router.get('/score-sante', auth, async (req, res) => {
  try {
    const [caYakro, livrees, livTotal, lotsVendus, retards] = await Promise.all([
      prisma.paiementYakro.aggregate({ _sum:{ montant:true }, where:{ createdAt:{ gte: new Date(new Date().setDate(1)) } } }),
      prisma.livraison.count({ where:{ statut:'LIVRE' } }),
      prisma.livraison.count(),
      prisma.lot.count({ where:{ statut:'VENDU' } }),
      prisma.echeancier.count({ where:{ statut:'RETARD' } }),
    ]);
    const scores = [
      { filiale:'YAKRO_GRILL', label:'Yakro Grill', score: Math.min(100, 40 + Math.min((caYakro._sum.montant||0)/100000*60, 60)), detail:'Restaurant' },
      { filiale:'TOPTELSIG', label:'TOPTELSIG', score: Math.min(100, 50 + lotsVendus*5 - retards*3), detail:'Foncier' },
      { filiale:'LIYA', label:'LiYA', score: livTotal > 0 ? Math.round(livrees/livTotal*100) : 30, detail:'Livraison' },
    ];
    res.json(scores);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
