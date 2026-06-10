const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

// GET /crm/prospects — Pipeline CRM avec stats relances
router.get('/prospects', auth, toptelsig, async (req, res) => {
  try {
    const { statut, commercial, search } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (commercial) where.commercialId = commercial;
    if (search) where.OR = [
      { nom: { contains: search, mode: 'insensitive' } },
      { prenom: { contains: search, mode: 'insensitive' } },
      { telephone: { contains: search } },
    ];

    const prospects = await prisma.souscripteur.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        relances: { orderBy: { dateRelance: 'desc' } },
        ventes: { select: { id:true, statut:true, prixVente:true, dateVente:true } },
        prescripteur: { select: { prenom:true, nom:true } },
      }
    });

    // Enrichir avec stats relances
    const enriched = prospects.map(p => {
      const relances = p.relances || [];
      const derniere = relances[0];
      const planifiee = relances.find(r => r.statut === 'planifiee' && r.prochain && new Date(r.prochain) > new Date());
      const enRetard = relances.find(r => r.statut === 'planifiee' && r.prochain && new Date(r.prochain) < new Date());
      const parCanal = relances.reduce((acc, r) => { acc[r.canal] = (acc[r.canal]||0)+1; return acc; }, {});
      return {
        ...p,
        _crm: {
          nbRelances: relances.length,
          derniereRelance: derniere ? { date: derniere.dateRelance, canal: derniere.canal, commercial: derniere.commercialNom, resultat: derniere.resultat } : null,
          prochaineRelance: planifiee ? planifiee.prochain : null,
          enRetardRelance: !!enRetard,
          parCanal,
          aConverti: p.statut === 'CLIENT',
          nbVentes: p.ventes?.length || 0,
        }
      };
    });

    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /crm/:id/relances — Ajouter une relance
router.post('/:id/relances', auth, toptelsig, async (req, res) => {
  try {
    const { canal, notes, resultat, prochain, dureeMin } = req.body;
    if (!canal) return res.status(400).json({ error: 'canal requis' });

    const relance = await prisma.relanceCRM.create({
      data: {
        souscripteurId: req.params.id,
        commercial: req.user.id,
        commercialNom: `${req.user.prenom} ${req.user.nom}`,
        canal, notes, resultat, dureeMin: dureeMin ? Number(dureeMin) : null,
        prochain: prochain ? new Date(prochain) : null,
        statut: prochain ? 'planifiee' : 'effectuee',
        dateRelance: new Date(),
      }
    });

    // Si résultat = converti → passer en CLIENT
    let souscripteurConverti = null;
    if (resultat === 'converti') {
      souscripteurConverti = await prisma.souscripteur.update({
        where: { id: req.params.id },
        data: { statut: 'CLIENT', canalConversion: canal, commercialId: req.user.id, commercialNom: `${req.user.prenom} ${req.user.nom}`, raisonConversion: req.body.notes?.slice(0,100) }
      });
    }
    if (resultat === 'perdu' && req.body.raisonPerte) {
      await prisma.souscripteur.update({ where: { id: req.params.id }, data: { statut: 'PERDU', raisonPerte: req.body.raisonPerte } });
    }

    // AuditLog
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'CREATE', entite: 'RelanceCRM', entiteId: relance.id, entiteLabel: `${canal} — ${resultat || 'en attente'}` } });

    res.status(201).json({ ...relance, souscripteurConverti: souscripteurConverti ? { id: souscripteurConverti.id, statut: souscripteurConverti.statut } : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /crm/:id/relances — Timeline d'un prospect
router.get('/:id/relances', auth, toptelsig, async (req, res) => {
  try {
    const relances = await prisma.relanceCRM.findMany({
      where: { souscripteurId: req.params.id },
      orderBy: { dateRelance: 'desc' }
    });
    res.json(relances);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /crm/:id — Modifier prospect (statut, commercial, source...)
router.put('/:id', auth, toptelsig, async (req, res) => {
  try {
    const { statut, commercialId, commercialNom, sourceAcquisition, raisonPerte, raisonConversion, canalConversion } = req.body;
    const data = {};
    if (statut) data.statut = statut;
    if (commercialId !== undefined) data.commercialId = commercialId;
    if (commercialNom !== undefined) data.commercialNom = commercialNom;
    if (sourceAcquisition !== undefined) data.sourceAcquisition = sourceAcquisition;
    if (raisonPerte !== undefined) data.raisonPerte = raisonPerte;
    if (raisonConversion !== undefined) data.raisonConversion = raisonConversion;
    if (canalConversion !== undefined) data.canalConversion = canalConversion;
    const updated = await prisma.souscripteur.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /crm/dashboard — KPI CRM
router.get('/dashboard', auth, toptelsig, async (req, res) => {
  try {
    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      nbTotal, nbProspects, nbContactes, nbInteresses, nbClients, nbPerdus,
      nbRelancesMois, relancesParCanal, alertesRelance, conversions,
    ] = await Promise.all([
      prisma.souscripteur.count(),
      prisma.souscripteur.count({ where: { statut: 'PROSPECT' } }),
      prisma.souscripteur.count({ where: { statut: 'CONTACTE' } }),
      prisma.souscripteur.count({ where: { statut: { in: ['INTERESSE', 'NEGOCIE'] } } }),
      prisma.souscripteur.count({ where: { statut: 'CLIENT' } }),
      prisma.souscripteur.count({ where: { statut: 'PERDU' } }),
      prisma.relanceCRM.count({ where: { dateRelance: { gte: debutMois } } }),
      prisma.relanceCRM.groupBy({ by: ['canal'], _count: { id: true }, where: { dateRelance: { gte: debutMois } } }),
      prisma.relanceCRM.findMany({ where: { statut: 'planifiee', prochain: { lte: now } }, include: { souscripteur: { select: { prenom:true, nom:true, telephone:true } } }, take: 10, orderBy: { prochain: 'asc' } }),
      prisma.souscripteur.findMany({ where: { statut: 'CLIENT', updatedAt: { gte: debutMois } }, select: { prenom:true, nom:true, commercialNom:true, canalConversion:true, raisonConversion:true, updatedAt:true }, take: 5, orderBy: { updatedAt: 'desc' } }),
    ]);

    const tauxConv = nbTotal > 0 ? Math.round(nbClients/nbTotal*100) : 0;
    const pipeline = [
      { statut:'PROSPECT', count:nbProspects, color:'#888' },
      { statut:'CONTACTÉ', count:nbContactes, color:'#BA7517' },
      { statut:'INTÉRESSÉ', count:nbInteresses, color:'#1a3f6f' },
      { statut:'CLIENT', count:nbClients, color:'#27500A' },
      { statut:'PERDU', count:nbPerdus, color:'#A32D2D' },
    ];

    res.json({
      kpi: { nbTotal, nbProspects, nbClients, nbPerdus, tauxConversion: tauxConv, nbRelancesMois },
      pipeline,
      relancesParCanal: relancesParCanal.map(r => ({ canal: r.canal, count: r._count.id })),
      alertesRelance,
      conversions,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
