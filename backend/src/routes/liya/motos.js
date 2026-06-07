const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const liya = requireFiliale('LIYA');

router.get('/', auth, liya, async (req, res) => {
  try {
    const motos = await prisma.moto.findMany({
      orderBy: { immatriculation: 'asc' },
      include: {
        livraisons: { where: { statut: 'EN_ROUTE' }, take: 1, include: { chauffeur: true } },
        maintenances: { where: { statut: 'EN_COURS' }, take: 1 },
        pleins: { orderBy: { date: 'desc' }, take: 1 }
      }
    });
    res.json(motos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, liya, async (req, res) => {
  try {
    const moto = await prisma.moto.create({ data: req.body });
    res.status(201).json(moto);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', auth, liya, async (req, res) => {
  try {
    const moto = await prisma.moto.update({ where: { id: req.params.id }, data: req.body });
    res.json(moto);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Maintenance
router.post('/:id/maintenances', auth, liya, async (req, res) => {
  try {
    const m = await prisma.maintenanceMoto.create({
      data: { ...req.body, motoId: req.params.id, cout: Number(req.body.cout || 0) }
    });
    if (req.body.statut === 'EN_COURS') {
      await prisma.moto.update({ where: { id: req.params.id }, data: { statut: 'MAINTENANCE' } });
    }
    res.status(201).json(m);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/maintenances/:mid', auth, liya, async (req, res) => {
  try {
    const m = await prisma.maintenanceMoto.update({
      where: { id: req.params.mid },
      data: req.body
    });
    if (req.body.statut === 'TERMINE') {
      await prisma.moto.update({ where: { id: req.params.id }, data: { statut: 'DISPONIBLE' } });
    }
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Carburant
router.post('/:id/pleins', auth, liya, async (req, res) => {
  try {
    const plein = await prisma.pleinCarburant.create({
      data: { ...req.body, motoId: req.params.id, litres: Number(req.body.litres), montant: Number(req.body.montant) }
    });
    await prisma.moto.update({
      where: { id: req.params.id },
      data: { kilometrage: Number(req.body.kilometrage), dernierePlein: new Date() }
    });

    // Décaisser carburant
    const caisse = await prisma.caisse.findFirst({ where: { filiale: 'LIYA', actif: true } });
    if (caisse) {
      await prisma.$transaction([
        prisma.decaissement.create({
          data: {
            caisseId: caisse.id, filiale: 'LIYA',
            montant: Number(req.body.montant),
            typePaiement: 'ESPECES',
            motif: `Carburant moto ${req.params.id}`,
            categorie: 'CARBURANT', valide: true, validePar: req.user.id,
          }
        }),
        prisma.caisse.update({ where: { id: caisse.id }, data: { solde: { decrement: Number(req.body.montant) } } })
      ]);
    }

    res.status(201).json(plein);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/historique', auth, liya, async (req, res) => {
  try {
    const [maintenances, pleins, livraisons] = await Promise.all([
      prisma.maintenanceMoto.findMany({ where: { motoId: req.params.id }, orderBy: { date: 'desc' } }),
      prisma.pleinCarburant.findMany({ where: { motoId: req.params.id }, orderBy: { date: 'desc' } }),
      prisma.livraison.findMany({
        where: { motoId: req.params.id }, orderBy: { createdAt: 'desc' }, take: 20,
        select: { numero: true, statut: true, clientNom: true, createdAt: true, montant: true }
      }),
    ]);
    res.json({ maintenances, pleins, livraisons });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
