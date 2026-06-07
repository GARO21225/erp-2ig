// ── TABLES
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const yakro = requireFiliale('YAKRO_GRILL');

router.get('/', auth, yakro, async (req, res) => {
  try {
    const tables = await prisma.tableRestaurant.findMany({
      orderBy: { numero: 'asc' },
      include: {
        commandes: {
          where: { statut: { in: ['EN_COURS', 'CUISINE', 'PRETE', 'SERVIE'] } },
          take: 1,
          include: { lignes: { include: { produit: true } } }
        },
        reservations: {
          where: {
            statut: 'CONFIRMEE',
            dateHeure: { gte: new Date(), lte: new Date(Date.now() + 4 * 3600000) }
          },
          take: 1
        }
      }
    });
    res.json(tables);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, yakro, async (req, res) => {
  try {
    const table = await prisma.tableRestaurant.create({ data: req.body });
    res.status(201).json(table);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/statut', auth, yakro, async (req, res) => {
  try {
    const table = await prisma.tableRestaurant.update({
      where: { id: req.params.id },
      data: { statut: req.body.statut }
    });
    res.json(table);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
