/**
 * TOPTELSIG — Projet Complet
 * Un seul endpoint qui retourne tout le projet pour l'affichage en onglets
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

const PHASES_DEFAULT = [
  'Coutumier & Acquisition Foncière',
  'Topographie & Études',
  'Administratif & Dossiers',
  'Lotissement & Bornage',
  'Ouverture de Voies & Viabilisation',
  'DTC & Services Techniques',
  'Assainissement & Environnement',
  'Enquêtes & Commissions',
  'Travaux de Construction',
  'Transport & Déplacements',
  'Personnel',
  'Commercial & Marketing',
  'Fournitures & Fonctionnement',
  'Frais Financiers',
  'Autres Dépenses',
];

// POST /projet-complet/seed-phases/:projetId — Créer les 15 phases par défaut
router.post('/seed-phases/:projetId', auth, toptelsig, async (req, res) => {
  try {
    const existing = await prisma.phaseFoncier.count({ where: { projetId: req.params.projetId } });
    if (existing > 0) return res.json({ message: `Phases déjà présentes (${existing})`, created: 0 });

    const phases = await Promise.all(
      PHASES_DEFAULT.map((nom, i) =>
        prisma.phaseFoncier.create({
          data: { projetId: req.params.projetId, nom, ordre: i + 1, statut: 'A_FAIRE', avancement: 0 }
        })
      )
    );
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'CREATE', entite: 'PhaseFoncier', entiteId: req.params.projetId, entiteLabel: '15 phases créées automatiquement' } });
    res.json({ created: phases.length, message: '15 phases créées' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /projet-complet/seed-phases-all — Créer les phases pour TOUS les projets
router.post('/seed-phases-all', auth, toptelsig, async (req, res) => {
  try {
    const projets = await prisma.projetFoncier.findMany({ select: { id: true, nom: true } });
    const results = [];
    for (const projet of projets) {
      const existing = await prisma.phaseFoncier.count({ where: { projetId: projet.id } });
      if (existing === 0) {
        await Promise.all(
          PHASES_DEFAULT.map((nom, i) =>
            prisma.phaseFoncier.create({ data: { projetId: projet.id, nom, ordre: i + 1, statut: 'A_FAIRE', avancement: 0 } })
          )
        );
        results.push({ projet: projet.nom, created: 15 });
      } else {
        results.push({ projet: projet.nom, created: 0, existing });
      }
    }
    res.json({ results, total: results.reduce((s, r) => s + r.created, 0) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /projet-complet/:id — Données complètes pour tous les onglets
router.get('/:id', auth, toptelsig, async (req, res) => {
  try {
    const pid = req.params.id;

    const [projet, lots, phases, souscripteurs, ventes, paiements, depenses, relances] = await Promise.all([
      // Infos projet
      prisma.projetFoncier.findUnique({ where: { id: pid } }),

      // Lots avec toutes les infos commerciales
      prisma.lot.findMany({
        where: { projetId: pid },
        orderBy: [{ ilot: 'asc' }, { numero: 'asc' }],
        include: {
          vente: {
            include: {
              souscripteur: { select: { id: true, prenom: true, nom: true, telephone: true, email: true, statut: true, commercialNom: true, sourceAcquisition: true } },
              echeanciers: { orderBy: { numero: 'asc' } },
              paiements: { select: { montant: true, createdAt: true, typePaiement: true } },
              prescripteur: { select: { prenom: true, nom: true } },
            }
          },
          reservations: { include: { souscripteur: { select: { prenom: true, nom: true, telephone: true } } } }
        }
      }),

      // Phases + activités + tâches + livrables
      prisma.phaseFoncier.findMany({
        where: { projetId: pid },
        orderBy: { ordre: 'asc' },
        include: {
          activites: {
            include: { taches: { orderBy: { createdAt: 'asc' } } }
          },
          livrables: { orderBy: { ordre: 'asc' } },
          depenses: { select: { id: true, montant: true, statut: true, categorie: true, description: true, date: true } }
        }
      }),

      // CRM : souscripteurs liés au projet
      prisma.souscripteur.findMany({
        where: { ventes: { some: { lot: { projetId: pid } } } },
        include: { relances: { orderBy: { dateRelance: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' }
      }),

      // Ventes
      prisma.venteFoncier.findMany({
        where: { lot: { projetId: pid } },
        include: {
          lot: { select: { numero: true, ilot: true, superficie: true } },
          souscripteur: { select: { prenom: true, nom: true, telephone: true, statut: true } },
          echeanciers: true,
        },
        orderBy: { dateVente: 'desc' }
      }),

      // Paiements agrégés
      prisma.paiementFoncier.aggregate({
        _sum: { montant: true },
        _count: { id: true },
        where: { venteFoncier: { lot: { projetId: pid } } }
      }),

      // Dépenses
      prisma.depenseFoncier.findMany({
        where: { projetId: pid },
        orderBy: { date: 'desc' },
        include: { phase: { select: { nom: true } } }
      }),

      // Relances CRM sur ce projet
      prisma.relanceCRM.groupBy({
        by: ['canal'],
        _count: { id: true },
        where: { souscripteur: { ventes: { some: { lot: { projetId: pid } } } } }
      })
    ]);

    if (!projet) return res.status(404).json({ error: 'Projet introuvable' });

    // Calculs KPI
    const lotsVendus = lots.filter(l => l.statut === 'VENDU').length;
    const lotsDispos = lots.filter(l => l.statut === 'DISPONIBLE').length;
    const lotsReserves = lots.filter(l => l.statut === 'RESERVE').length;

    const caPrevu = lots.filter(l => l.vente).reduce((s, l) => s + l.vente.prixVente, 0);
    const caEnc = paiements._sum.montant || 0;
    const depPayees = depenses.filter(d => d.statut === 'PAYEE').reduce((s, d) => s + d.montant, 0);
    const depEngagees = depenses.filter(d => ['EN_ATTENTE','VALIDEE_N1','VALIDEE_FINALE'].includes(d.statut)).reduce((s, d) => s + d.montant, 0);

    const resultatBrut = caEnc - depPayees;
    const marge = caEnc > 0 ? Math.round(resultatBrut / caEnc * 100) : 0;

    // Paiements par mode
    const paiementsParMode = await prisma.paiementFoncier.groupBy({
      by: ['typePaiement'],
      _sum: { montant: true },
      _count: { id: true },
      where: { venteFoncier: { lot: { projetId: pid } } }
    });

    // Encaissements mensuels (12 derniers mois)
    const now = new Date();
    const encMensuels = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const fin = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const agg = await prisma.paiementFoncier.aggregate({
        _sum: { montant: true },
        where: { venteFoncier: { lot: { projetId: pid } }, createdAt: { gte: d, lte: fin } }
      });
      encMensuels.push({ mois: d.toLocaleDateString('fr', { month: 'short', year: '2-digit' }), montant: agg._sum.montant || 0 });
    }

    // Dépenses par phase
    const depParPhase = phases.map(ph => ({
      phase: ph.nom.length > 20 ? ph.nom.slice(0, 20) + '…' : ph.nom,
      montant: ph.depenses.reduce((s, d) => s + d.montant, 0),
      budget: ph.budgetPrevu || 0
    })).filter(p => p.montant > 0 || p.budget > 0);

    // CRM stats
    const nbProspects = await prisma.souscripteur.count({ where: { statut: { in: ['PROSPECT','CONTACTE','INTERESSE','NEGOCIE'] }, ventes: { some: { lot: { projetId: pid } } } } });
    const nbClients = await prisma.souscripteur.count({ where: { statut: 'CLIENT', ventes: { some: { lot: { projetId: pid } } } } });
    const nbRelancesTotal = await prisma.relanceCRM.count({ where: { souscripteur: { ventes: { some: { lot: { projetId: pid } } } } } });
    const retardsEch = ventes.reduce((s, v) => s + v.echeanciers.filter(e => e.statut === 'RETARD').length, 0);

    // Livrables
    const nbLivrables = phases.reduce((s, ph) => s + ph.livrables.length, 0);
    const nbLivValides = phases.reduce((s, ph) => s + ph.livrables.filter(l => l.statut === 'VALIDE').length, 0);
    const nbLivRetard = phases.reduce((s, ph) => s + ph.livrables.filter(l => l.datePrevue && new Date(l.datePrevue) < now && l.statut !== 'VALIDE').length, 0);

    res.json({
      projet,
      kpi: {
        commercial: { totalLots: lots.length, lotsDispos, lotsReserves, lotsVendus, tauxComm: lots.length > 0 ? Math.round(lotsVendus / lots.length * 100) : 0 },
        finances: { caPrevu, caEnc, resteAEncaisser: caPrevu - caEnc, depPayees, depEngagees, resultatBrut, marge, roi: depPayees > 0 ? Math.round(resultatBrut / depPayees * 100) : 0 },
        crm: { nbProspects, nbClients, nbRelances: nbRelancesTotal, nbSouscripteurs: souscripteurs.length, tauxConv: souscripteurs.length > 0 ? Math.round(nbClients / souscripteurs.length * 100) : 0 },
        projet: { nbPhases: phases.length, nbActivites: phases.reduce((s, p) => s + p.activites.length, 0), nbTaches: phases.reduce((s, p) => s + p.activites.reduce((a, ac) => a + ac.taches.length, 0), 0), nbLivrables, nbLivValides, nbLivRetard },
        retardsEch,
      },
      lots,
      phases,
      souscripteurs,
      ventes,
      depenses,
      graphiques: { encMensuels, depParPhase, paiementsParMode: paiementsParMode.map(p => ({ mode: p.typePaiement?.replace(/_/g, ' ') || 'Autre', montant: p._sum.montant || 0, nb: p._count.id })) },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
