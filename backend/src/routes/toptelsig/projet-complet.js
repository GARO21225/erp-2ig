/**
 * TOPTELSIG — Projet Complet (optimisé)
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

const PHASES_DEFAULT = [
  'Coutumier & Acquisition Foncière','Topographie & Études','Administratif & Dossiers',
  'Lotissement & Bornage','Ouverture de Voies & Viabilisation','DTC & Services Techniques',
  'Assainissement & Environnement','Enquêtes & Commissions','Travaux de Construction',
  'Transport & Déplacements','Personnel','Commercial & Marketing',
  'Fournitures & Fonctionnement','Frais Financiers','Autres Dépenses',
];

// ── POST /seed-phases/:projetId ───────────────────────────────────────────────
router.post('/seed-phases/:projetId', auth, toptelsig, async (req, res) => {
  try {
    const existing = await prisma.phaseFoncier.count({ where: { projetId: req.params.projetId } });
    if (existing > 0) return res.json({ message: `${existing} phases déjà présentes`, created: 0 });
    await prisma.phaseFoncier.createMany({
      data: PHASES_DEFAULT.map((nom, i) => ({ projetId: req.params.projetId, nom, ordre: i + 1, statut: 'A_FAIRE', avancement: 0 }))
    });
    res.json({ created: PHASES_DEFAULT.length, message: `${PHASES_DEFAULT.length} phases créées` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /seed-phases-all ─────────────────────────────────────────────────────
router.post('/seed-phases-all', auth, toptelsig, async (req, res) => {
  try {
    const projets = await prisma.projetFoncier.findMany({ select: { id: true, nom: true } });
    let total = 0;
    const results = [];
    for (const p of projets) {
      const existing = await prisma.phaseFoncier.count({ where: { projetId: p.id } });
      if (existing === 0) {
        await prisma.phaseFoncier.createMany({
          data: PHASES_DEFAULT.map((nom, i) => ({ projetId: p.id, nom, ordre: i + 1, statut: 'A_FAIRE', avancement: 0 }))
        });
        total += PHASES_DEFAULT.length;
        results.push({ projet: p.nom, created: PHASES_DEFAULT.length });
      } else {
        results.push({ projet: p.nom, created: 0, existing });
      }
    }
    res.json({ results, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /:id — Données complètes optimisées ───────────────────────────────────
router.get('/:id', auth, toptelsig, async (req, res) => {
  try {
    const pid = req.params.id;

    // Toutes les requêtes en parallèle — SANS boucle séquentielle
    const [
      projet,
      lots,
      phases,
      souscripteurs,
      paiementsAgg,
      paiementsParMode,
      depenses,
      relancesParCanal,
      retardsEch,
    ] = await Promise.all([
      prisma.projetFoncier.findUnique({ where: { id: pid } }),

      prisma.lot.findMany({
        where: { projetId: pid },
        orderBy: [{ ilot: 'asc' }, { numero: 'asc' }],
        include: {
          vente: {
            include: {
              souscripteur: { select: { id:true, prenom:true, nom:true, telephone:true, statut:true, commercialNom:true, sourceAcquisition:true } },
              echeanciers: { orderBy: { numero: 'asc' } },
              paiements: { select: { montant:true, createdAt:true, typePaiement:true } },
            }
          },
          reservations: { include: { souscripteur: { select: { prenom:true, nom:true, telephone:true } } }, take: 1 }
        }
      }),

      prisma.phaseFoncier.findMany({
        where: { projetId: pid },
        orderBy: { ordre: 'asc' },
        include: {
          activites: {
            orderBy: { createdAt: 'asc' },
            include: { taches: { orderBy: { createdAt: 'asc' } } }
          },
          livrables: { orderBy: { createdAt: 'asc' } },
          depenses: { select: { id:true, montant:true, statut:true, categorie:true }, take: 20 }
        }
      }),

      prisma.souscripteur.findMany({
        where: { ventes: { some: { lot: { projetId: pid } } } },
        orderBy: { createdAt: 'desc' },
        include: { relances: { orderBy: { dateRelance: 'desc' }, take: 1 } }
      }),

      prisma.paiementFoncier.aggregate({
        _sum: { montant: true }, _count: { id: true },
        where: { vente: { lot: { projetId: pid } } }
      }),

      prisma.paiementFoncier.groupBy({
        by: ['typePaiement'],
        _sum: { montant: true }, _count: { id: true },
        where: { vente: { lot: { projetId: pid } } }
      }),

      prisma.depenseFoncier.findMany({
        where: { projetId: pid },
        orderBy: { date: 'desc' },
        select: { id:true, montant:true, statut:true, categorie:true, description:true, date:true, phaseId:true }
      }),

      prisma.relanceCRM.groupBy({
        by: ['canal'], _count: { id: true },
        where: { souscripteur: { ventes: { some: { lot: { projetId: pid } } } } }
      }),

      prisma.echeancier.count({
        where: { statut: 'RETARD', vente: { lot: { projetId: pid } } }
      }),
    ]);

    if (!projet) return res.status(404).json({ error: 'Projet introuvable' });

    // KPI calculés côté serveur
    const lotsVendus   = lots.filter(l => l.statut === 'VENDU').length;
    const lotsDispos   = lots.filter(l => l.statut === 'DISPONIBLE').length;
    const lotsReserves = lots.filter(l => l.statut === 'RESERVE').length;
    const caPrevu      = lots.filter(l => l.vente).reduce((s, l) => s + l.vente.prixVente, 0);
    const caEnc        = paiementsAgg._sum.montant || 0;
    const depPayees    = depenses.filter(d => d.statut === 'PAYEE').reduce((s, d) => s + d.montant, 0);
    const depEngagees  = depenses.filter(d => ['EN_ATTENTE','VALIDEE_N1','VALIDEE_FINALE'].includes(d.statut)).reduce((s, d) => s + d.montant, 0);
    const resultatBrut = caEnc - depPayees;
    const marge        = caEnc > 0 ? Math.round(resultatBrut / caEnc * 100) : 0;
    const roi          = depPayees > 0 ? Math.round(resultatBrut / depPayees * 100) : 0;

    const nbProspects  = souscripteurs.filter(s => ['PROSPECT','CONTACTE','INTERESSE','NEGOCIE'].includes(s.statut)).length;
    const nbClients    = souscripteurs.filter(s => s.statut === 'CLIENT').length;
    const nbRelances   = relancesParCanal.reduce((s, r) => s + r._count.id, 0);

    const nbPhases     = phases.length;
    const nbActivites  = phases.reduce((s, p) => s + p.activites.length, 0);
    const nbTaches     = phases.reduce((s, p) => s + p.activites.reduce((a, ac) => a + ac.taches.length, 0), 0);
    const nbLivrables  = phases.reduce((s, p) => s + p.livrables.length, 0);
    const nbLivValides = phases.reduce((s, p) => s + p.livrables.filter(l => l.statut === 'VALIDE').length, 0);
    const nbLivRetard  = phases.reduce((s, p) => s + p.livrables.filter(l => l.datePrevue && new Date(l.datePrevue) < new Date() && l.statut !== 'VALIDE').length, 0);

    // Calcul avancement automatique basé sur phases
    // Règle : moyenne des avancements des phases + bonus si lots vendus
    const avancementPhases = nbPhases > 0
      ? Math.round(phases.reduce((s, p) => s + (p.avancement || 0), 0) / nbPhases)
      : 0;
    const avancementLots = lots.length > 0
      ? Math.round(lotsVendus / lots.length * 30) // max 30% du score commercial
      : 0;
    const avancementCalcule = Math.min(
      Math.round(avancementPhases * 0.7 + avancementLots),
      100
    );

    // Mettre à jour le projet si l'avancement a changé (en arrière-plan, sans bloquer)
    if (nbPhases > 0 && Math.abs((projet.avancement || 0) - avancementCalcule) > 2) {
      prisma.projetFoncier.update({
        where: { id: pid },
        data: { avancement: avancementCalcule }
      }).catch(() => {}); // silencieux
    }

    // Encaissements mensuels : UNE SEULE requête (pas de boucle)
    const debut12mois = new Date(); debut12mois.setMonth(debut12mois.getMonth() - 11); debut12mois.setDate(1); debut12mois.setHours(0,0,0,0);
    const paiementsMensuels = await prisma.paiementFoncier.findMany({
      where: { vente: { lot: { projetId: pid } }, createdAt: { gte: debut12mois } },
      select: { montant: true, createdAt: true }
    });

    // Agréger par mois côté JS
    const moisMap = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const k = d.toLocaleDateString('fr', { month: 'short', year: '2-digit' });
      moisMap[k] = 0;
    }
    paiementsMensuels.forEach(p => {
      const k = new Date(p.createdAt).toLocaleDateString('fr', { month: 'short', year: '2-digit' });
      if (moisMap[k] !== undefined) moisMap[k] += p.montant;
    });
    const encMensuels = Object.entries(moisMap).map(([mois, montant]) => ({ mois, montant }));

    // Dépenses par phase
    const depParPhase = phases.map(ph => ({
      phase: ph.nom.length > 22 ? ph.nom.slice(0, 22) + '…' : ph.nom,
      montant: ph.depenses.reduce((s, d) => s + d.montant, 0),
      budget: ph.budgetPrevu || 0,
    })).filter(p => p.montant > 0 || p.budget > 0);

    res.json({
      projet: { ...projet, avancement: avancementCalcule || projet.avancement || 0 },
      kpi: {
        commercial: { totalLots: lots.length, lotsDispos, lotsReserves, lotsVendus, tauxComm: lots.length > 0 ? Math.round(lotsVendus / lots.length * 100) : 0 },
        finances:   { caPrevu, caEnc, resteAEncaisser: caPrevu - caEnc, depPayees, depEngagees, resultatBrut, marge, roi },
        crm:        { nbProspects, nbClients, nbRelances, nbSouscripteurs: souscripteurs.length, tauxConv: souscripteurs.length > 0 ? Math.round(nbClients / souscripteurs.length * 100) : 0 },
        projet:     { nbPhases, nbActivites, nbTaches, nbLivrables, nbLivValides, nbLivRetard },
        retardsEch,
      },
      lots,
      phases,
      souscripteurs,
      depenses,
      graphiques: {
        encMensuels,
        depParPhase,
        paiementsParMode: paiementsParMode.map(p => ({ mode: p.typePaiement?.replace(/_/g, ' ') || 'Autre', montant: p._sum.montant || 0, nb: p._count.id })),
      },
    });
  } catch (e) {
    console.error('[projet-complet] Erreur:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
