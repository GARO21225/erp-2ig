// ── LIVRAISONS LIYA ──────────────────────────────
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const liya = requireFiliale('LIYA');

router.get('/', auth, liya, async (req, res) => {
  try {
    const { statut, date, motoId, chauffeurId, dateDebut, dateFin, page = 1, limit = 30 } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (motoId) where.motoId = motoId;
    if (chauffeurId) where.chauffeurId = chauffeurId;
    if (date) {
      const d = new Date(date);
      where.createdAt = {
        gte: new Date(d.setHours(0, 0, 0, 0)),
        lte: new Date(d.setHours(23, 59, 59, 999))
      };
    } else if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin) where.createdAt.lte = new Date(dateFin);
    }

    const [total, livraisons] = await Promise.all([
      prisma.livraison.count({ where }),
      prisma.livraison.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          moto: { select: { immatriculation: true, marque: true } },
          chauffeur: { select: { nom: true, prenom: true, telephone: true } },
        }
      })
    ]);

    res.json({ data: livraisons, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stats du jour
router.get('/stats', auth, liya, async (req, res) => {
  try {
    const today = new Date();
    const debut = new Date(today.setHours(0, 0, 0, 0));

    const [total, livrees, enCours, echecs, caJour] = await Promise.all([
      prisma.livraison.count({ where: { createdAt: { gte: debut } } }),
      prisma.livraison.count({ where: { statut: 'LIVRE', createdAt: { gte: debut } } }),
      prisma.livraison.count({ where: { statut: { in: ['EN_ATTENTE', 'PRISE_EN_CHARGE', 'EN_ROUTE'] } } }),
      prisma.livraison.count({ where: { statut: 'ECHEC', createdAt: { gte: debut } } }),
      prisma.livraison.aggregate({
        _sum: { montant: true },
        where: { paye: true, createdAt: { gte: debut } }
      }),
    ]);

    const tauxReussite = total > 0 ? Math.round((livrees / total) * 100) : 0;

    res.json({ total, livrees, enCours, echecs, caJour: caJour._sum.montant || 0, tauxReussite });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, liya, async (req, res) => {
  try {
    const { motoId, chauffeurId } = req.body;

    // Fix 5 — Vérifier que la moto est disponible
    if (motoId) {
      const moto = await prisma.moto.findUnique({ where: { id: motoId } });
      if (!moto) return res.status(404).json({ error: 'Moto introuvable' });
      if (moto.statut !== 'DISPONIBLE') {
        return res.status(400).json({
          error: `Moto ${moto.immatriculation} non disponible (statut : ${moto.statut})`
        });
      }
    }

    // Vérifier que le chauffeur n'a pas de livraison EN_ROUTE
    if (chauffeurId) {
      const enCours = await prisma.livraison.findFirst({
        where: { chauffeurId, statut: { in: ['PRISE_EN_CHARGE', 'EN_ROUTE'] } }
      });
      if (enCours) {
        return res.status(400).json({
          error: `Ce livreur a déjà une livraison en cours (${enCours.numero})`
        });
      }
    }

    const numero = `LY-${Date.now()}`;
    const livraison = await prisma.livraison.create({
      data: { ...req.body, numero, montant: Number(req.body.montant || 0) },
      include: { moto: true, chauffeur: true }
    });

    // Mettre moto en livraison
    if (motoId) {
      await prisma.moto.update({ where: { id: motoId }, data: { statut: 'EN_LIVRAISON' } });
    }

    res.status(201).json(livraison);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/statut', auth, liya, async (req, res) => {
  try {
    const data = { statut: req.body.statut };
    if (req.body.statut === 'LIVRE') data.dateFin = new Date();
    if (req.body.statut === 'PRISE_EN_CHARGE') data.dateDebut = new Date();

    const livraison = await prisma.livraison.update({
      where: { id: req.params.id },
      data,
      include: { moto: true }
    });

    // Libérer la moto si terminé
    if (['LIVRE', 'ECHEC', 'ANNULE'].includes(req.body.statut) && livraison.motoId) {
      await prisma.moto.update({ where: { id: livraison.motoId }, data: { statut: 'DISPONIBLE' } });
    }

    res.json(livraison);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Position GPS
router.post('/:id/position', auth, async (req, res) => {
  try {
    const pos = await prisma.positionGPS.create({
      data: { livraisonId: req.params.id, ...req.body }
    });
    res.status(201).json(pos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/positions', auth, async (req, res) => {
  try {
    const positions = await prisma.positionGPS.findMany({
      where: { livraisonId: req.params.id },
      orderBy: { timestamp: 'asc' }
    });
    res.json(positions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// PUT /:id/echec — Déclarer un échec avec motif obligatoire
router.put('/:id/echec', auth, liya, async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif d\'échec obligatoire (client absent, adresse incorrecte, refus, etc.)' });

    const livraison = await prisma.livraison.findUnique({ where: { id: req.params.id } });
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable' });
    if (!['PRISE_EN_CHARGE', 'EN_ROUTE'].includes(livraison.statut)) return res.status(400).json({ error: `Échec impossible — statut actuel: ${livraison.statut}` });

    await prisma.$transaction(async (tx) => {
      await tx.livraison.update({ where: { id: req.params.id }, data: { statut: 'ECHEC', dateFin: new Date(), notes: `${livraison.notes || ''} | ECHEC: ${motif}` } });
      if (livraison.motoId) await tx.moto.update({ where: { id: livraison.motoId }, data: { statut: 'DISPONIBLE' } });
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'LIYA', action: 'UPDATE', entite: 'Livraison', entiteId: livraison.id, entiteLabel: `Échec ${livraison.numero}: ${motif}`, avant: { statut: livraison.statut }, apres: { statut: 'ECHEC', motif } } });
    });
    res.json({ message: 'Livraison marquée comme échec', motif });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/reassigner — Réassigner moto/livreur après échec ou incident
router.put('/:id/reassigner', auth, liya, async (req, res) => {
  try {
    const { motoId, chauffeurId, motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif de réassignation obligatoire' });

    const livraison = await prisma.livraison.findUnique({ where: { id: req.params.id } });
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable' });
    if (livraison.statut === 'LIVREE') return res.status(400).json({ error: 'Livraison déjà livrée' });

    if (motoId) {
      const moto = await prisma.moto.findUnique({ where: { id: motoId } });
      if (!moto || moto.statut !== 'DISPONIBLE') return res.status(400).json({ error: `Moto non disponible (statut: ${moto?.statut})` });
    }

    await prisma.$transaction(async (tx) => {
      // Libérer l'ancienne moto
      if (livraison.motoId && livraison.motoId !== motoId) await tx.moto.update({ where: { id: livraison.motoId }, data: { statut: 'DISPONIBLE' } });
      // Assigner nouvelle moto
      if (motoId) await tx.moto.update({ where: { id: motoId }, data: { statut: 'EN_LIVRAISON' } });
      await tx.livraison.update({ where: { id: req.params.id }, data: { motoId: motoId || livraison.motoId, chauffeurId: chauffeurId || livraison.chauffeurId, statut: 'ASSIGNEE', notes: `${livraison.notes || ''} | RÉASSIGNATION: ${motif}` } });
    });
    res.json({ message: 'Livraison réassignée' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/incident — Déclarer incident (accident, panne) avec maintenance auto
router.post('/:id/incident', auth, liya, async (req, res) => {
  try {
    const { type, description, motoId: motoIdParam } = req.body;
    if (!type || !description) return res.status(400).json({ error: 'Type et description d\'incident obligatoires' });

    const livraison = await prisma.livraison.findUnique({ where: { id: req.params.id } });
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable' });

    const motoId = motoIdParam || livraison.motoId;

    await prisma.$transaction(async (tx) => {
      // Livraison → ECHEC
      await tx.livraison.update({ where: { id: req.params.id }, data: { statut: 'ECHEC', dateFin: new Date(), notes: `${livraison.notes || ''} | INCIDENT ${type}: ${description}` } });
      // Moto → HORS_SERVICE ou MAINTENANCE
      if (motoId) {
        const statutMoto = type === 'ACCIDENT' ? 'HORS_SERVICE' : 'MAINTENANCE';
        await tx.moto.update({ where: { id: motoId }, data: { statut: statutMoto } });
        await tx.maintenanceMoto.create({ data: { motoId, type: type === 'ACCIDENT' ? 'AUTRE' : 'AUTRE', description: `INCIDENT: ${description}`, cout: 0, statut: 'EN_COURS' } });
      }
    });
    res.json({ message: 'Incident déclaré, moto mise hors service, livraison marquée en échec' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /export — Export Excel livraisons
router.get('/export', auth, liya, async (req, res) => {
  try {
    const { dateDebut, dateFin, statut } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (dateDebut || dateFin) { where.createdAt = {}; if (dateDebut) where.createdAt.gte = new Date(dateDebut); if (dateFin) where.createdAt.lte = new Date(dateFin); }
    const livraisons = await prisma.livraison.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10000,
      include: { chauffeur: { select: { nom: true, prenom: true } } } });
    const xlsx = require('xlsx');
    const data = livraisons.map(l => ({
      Numéro: l.numero, Client: l.clientNom, Téléphone: l.clientTel,
      'Adresse prise': l.adressePrise, 'Adresse livraison': l.adresseLivraison,
      Statut: l.statut, Montant: l.montant, Payé: l.paye ? 'Oui' : 'Non',
      Livreur: l.chauffeur ? `${l.chauffeur.prenom} ${l.chauffeur.nom}` : '—',
      Date: new Date(l.createdAt).toLocaleString('fr'),
    }));
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Livraisons');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="livraisons_${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
