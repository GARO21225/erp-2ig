// ── FINANCE ──────────────────────────────
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/finance/caisses
router.get('/caisses', auth, async (req, res) => {
  try {
    const { filiale } = req.query;
    const where = req.user.filiale === 'GROUPE' ? {} : { filiale: req.user.filiale };
    if (filiale) where.filiale = filiale;

    const caisses = await prisma.caisse.findMany({
      where,
      include: {
        _count: { select: { encaissements: true, decaissements: true } }
      }
    });
    res.json(caisses);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/caisses', auth, requireRole('DG', 'COMPTABLE'), async (req, res) => {
  try {
    const caisse = await prisma.caisse.create({ data: req.body });
    res.status(201).json(caisse);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Encaissements
router.get('/encaissements', auth, async (req, res) => {
  try {
    const { filiale, dateDebut, dateFin, page = 1, limit = 30 } = req.query;
    const where = {};
    if (filiale) where.filiale = filiale;
    else if (req.user.filiale !== 'GROUPE') where.filiale = req.user.filiale;
    if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin) where.createdAt.lte = new Date(dateFin);
    }

    const [total, data, totalMontant] = await Promise.all([
      prisma.encaissement.count({ where }),
      prisma.encaissement.findMany({
        where, skip: (page - 1) * limit, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { caisse: { select: { nom: true } } }
      }),
      prisma.encaissement.aggregate({ _sum: { montant: true }, where })
    ]);

    res.json({ data, total, totalMontant: totalMontant._sum.montant || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/encaissements', auth, requireRole('DG', 'COMPTABLE', 'MANAGER'), async (req, res) => {
  try {
    const [enc] = await prisma.$transaction([
      prisma.encaissement.create({ data: { ...req.body, montant: Number(req.body.montant), operateurId: req.user.id } }),
      prisma.caisse.update({ where: { id: req.body.caisseId }, data: { solde: { increment: Number(req.body.montant) } } })
    ]);
    res.status(201).json(enc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Décaissements
router.get('/decaissements', auth, async (req, res) => {
  try {
    const { filiale, valide, page = 1, limit = 30 } = req.query;
    const where = {};
    if (filiale) where.filiale = filiale;
    else if (req.user.filiale !== 'GROUPE') where.filiale = req.user.filiale;
    if (valide !== undefined) where.valide = valide === 'true';

    const [total, data] = await Promise.all([
      prisma.decaissement.count({ where }),
      prisma.decaissement.findMany({
        where, skip: (page - 1) * limit, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { caisse: { select: { nom: true } } }
      })
    ]);
    res.json({ data, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/decaissements', auth, async (req, res) => {
  try {
    const dec = await prisma.decaissement.create({
      data: { ...req.body, montant: Number(req.body.montant) }
    });
    res.status(201).json(dec);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/decaissements/:id/valider', auth, requireRole('DG', 'DIRECTEUR', 'COMPTABLE'), async (req, res) => {
  try {
    const [dec] = await prisma.$transaction([
      prisma.decaissement.update({
        where: { id: req.params.id },
        data: { valide: true, validePar: req.user.id }
      }),
      prisma.caisse.update({
        where: { id: req.body.caisseId },
        data: { solde: { decrement: Number(req.body.montant) } }
      })
    ]);
    res.json(dec);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rapport financier consolidé
router.get('/rapport', auth, async (req, res) => {
  try {
    const { annee = new Date().getFullYear(), mois } = req.query;
    const debut = mois
      ? new Date(annee, mois - 1, 1)
      : new Date(annee, 0, 1);
    const fin = mois
      ? new Date(annee, mois, 0, 23, 59, 59)
      : new Date(annee, 11, 31, 23, 59, 59);

    const [encParFiliale, decParFiliale, encParType] = await Promise.all([
      prisma.encaissement.groupBy({
        by: ['filiale'],
        _sum: { montant: true },
        where: { createdAt: { gte: debut, lte: fin } }
      }),
      prisma.decaissement.groupBy({
        by: ['filiale'],
        _sum: { montant: true },
        where: { createdAt: { gte: debut, lte: fin }, valide: true }
      }),
      prisma.encaissement.groupBy({
        by: ['typePaiement'],
        _sum: { montant: true },
        where: { createdAt: { gte: debut, lte: fin } }
      }),
    ]);

    const rapport = {};
    for (const e of encParFiliale) {
      rapport[e.filiale] = { encaissements: e._sum.montant || 0, decaissements: 0 };
    }
    for (const d of decParFiliale) {
      if (!rapport[d.filiale]) rapport[d.filiale] = { encaissements: 0, decaissements: 0 };
      rapport[d.filiale].decaissements = d._sum.montant || 0;
    }
    for (const k of Object.keys(rapport)) {
      rapport[k].resultat = rapport[k].encaissements - rapport[k].decaissements;
    }

    res.json({ rapport, encParType, periode: { debut, fin } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

// POST /finance/caisses/:id/correction — Correction d'écart de caisse
router.post('/caisses/:id/correction', auth, requireRole('DG', 'COMPTABLE'), async (req, res) => {
  try {
    const { montantReel, motif } = req.body;
    if (montantReel === undefined || !motif) return res.status(400).json({ error: 'montantReel et motif obligatoires' });
    const caisse = await prisma.caisse.findUnique({ where: { id: req.params.id } });
    if (!caisse) return res.status(404).json({ error: 'Caisse introuvable' });
    const ecart = Number(montantReel) - caisse.solde;
    await prisma.$transaction(async (tx) => {
      await tx.caisse.update({ where: { id: req.params.id }, data: { solde: Number(montantReel) } });
      // Créer un mouvement correctif
      if (ecart !== 0) {
        const data = { caisseId: req.params.id, filiale: caisse.filiale, montant: Math.abs(ecart), typePaiement: 'ESPECES', motif: `Correction caisse: ${motif}`, categorie: 'CORRECTION_CAISSE' };
        if (ecart > 0) {
          await tx.encaissement.create({ data: { ...data, operateurId: req.user.id } });
        } else {
          await tx.decaissement.create({ data: { ...data, valide: true, validePar: req.user.id } });
        }
      }
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: caisse.filiale, action: 'UPDATE', entite: 'Caisse', entiteId: caisse.id, entiteLabel: `Correction écart: ${ecart > 0 ? '+' : ''}${ecart.toLocaleString('fr')} F — ${motif}`, avant: { solde: caisse.solde }, apres: { solde: Number(montantReel), ecart, motif } } });
    });
    res.json({ message: 'Correction caisse effectuée', ecart, nouveauSolde: Number(montantReel) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /finance/decaissements/:id/annuler — Annuler un décaissement non validé
router.post('/decaissements/:id/annuler', auth, requireRole('DG', 'COMPTABLE'), async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif d\'annulation obligatoire' });
    const dec = await prisma.decaissement.findUnique({ where: { id: req.params.id } });
    if (!dec) return res.status(404).json({ error: 'Décaissement introuvable' });
    if (dec.valide) return res.status(400).json({ error: 'Décaissement déjà validé — annulation impossible sans correction caisse' });
    // Soft delete via champ motif annulation
    await prisma.decaissement.update({ where: { id: req.params.id }, data: { valide: false, motif: `ANNULE: ${motif} | ${dec.motif}` } });
    res.json({ message: 'Décaissement annulé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /finance/caisses/:id/journal — Journal de caisse (chronologique)
router.get('/caisses/:id/journal', auth, async (req, res) => {
  try {
    const { dateDebut, dateFin, page = 1, limit = 50 } = req.query;
    const where = { caisseId: req.params.id };
    if (dateDebut || dateFin) { where.createdAt = {}; if (dateDebut) where.createdAt.gte = new Date(dateDebut); if (dateFin) where.createdAt.lte = new Date(dateFin); }
    const [encaissements, decaissements] = await Promise.all([
      prisma.encaissement.findMany({ where, orderBy: { createdAt: 'desc' }, take: Number(limit) }),
      prisma.decaissement.findMany({ where, orderBy: { createdAt: 'desc' }, take: Number(limit) })
    ]);
    const journal = [
      ...encaissements.map(e => ({ ...e, sens: 'CREDIT', signeMontant: +e.montant })),
      ...decaissements.map(d => ({ ...d, sens: 'DEBIT', signeMontant: -d.montant })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, Number(limit));
    res.json(journal);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/finance/stats — KPI finance avec courbe
router.get('/stats', auth, async (req, res) => {
  try {
    const { periode = 'mois', filiale } = req.query;
    const now = new Date();
    let debut;
    if (periode === 'aujourd') { debut = new Date(now); debut.setHours(0,0,0,0); }
    else if (periode === 'semaine') { debut = new Date(now); debut.setDate(now.getDate()-7); }
    else if (periode === 'mois') { debut = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (periode === 'trimestre') { debut = new Date(now); debut.setMonth(now.getMonth()-3); }
    else debut = new Date(2020, 0, 1);

    const whereBase = { createdAt: { gte: debut } };
    if (filiale && req.user.filiale !== 'GROUPE') whereBase.filiale = req.user.filiale;
    else if (filiale) whereBase.filiale = filiale;

    const [encTotal, decTotal, encParJour, decParJour, decParCateg] = await Promise.all([
      prisma.encaissement.aggregate({ _sum: { montant: true }, where: whereBase }),
      prisma.decaissement.aggregate({ _sum: { montant: true }, where: whereBase }),
      prisma.encaissement.groupBy({ by: ['createdAt'], _sum: { montant: true }, where: whereBase, orderBy: { createdAt: 'asc' } }),
      prisma.decaissement.groupBy({ by: ['createdAt'], _sum: { montant: true }, where: whereBase, orderBy: { createdAt: 'asc' } }),
      prisma.decaissement.groupBy({ by: ['categorie'], _sum: { montant: true }, where: whereBase, orderBy: { _sum: { montant: 'desc' } }, take: 6 }),
    ]);

    // Construire courbe 7 jours
    const courbeMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.toLocaleDateString('fr', { weekday: 'short', day: 'numeric' });
      courbeMap[k] = { jour: k, encaissements: 0, decaissements: 0 };
    }
    encParJour.forEach(e => {
      const k = new Date(e.createdAt).toLocaleDateString('fr', { weekday: 'short', day: 'numeric' });
      if (courbeMap[k]) courbeMap[k].encaissements += e._sum.montant || 0;
    });
    decParJour.forEach(e => {
      const k = new Date(e.createdAt).toLocaleDateString('fr', { weekday: 'short', day: 'numeric' });
      if (courbeMap[k]) courbeMap[k].decaissements += e._sum.montant || 0;
    });

    // Répartition par type de paiement
    const encParPaiement = await prisma.encaissement.groupBy({
      by: ['typePaiement'], _sum: { montant: true }, where: whereBase,
      orderBy: { _sum: { montant: 'desc' } }
    });

    res.json({
      totalEncaissements: encTotal._sum.montant || 0,
      totalDecaissements: decTotal._sum.montant || 0,
      courbe: Object.values(courbeMap),
      parCategorie: decParCateg.map(d => ({ categorie: d.categorie || 'Autre', montant: d._sum.montant || 0 })),
      parTypePaiement: encParPaiement.map(e => ({
        name: e.typePaiement?.replace('_', ' ') || 'Autre',
        value: e._sum.montant || 0
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
