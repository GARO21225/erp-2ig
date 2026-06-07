const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const yakro = requireFiliale('YAKRO_GRILL');

router.get('/', auth, yakro, async (req, res) => {
  try {
    const { date, statut } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (date) {
      const d = new Date(date);
      where.dateHeure = {
        gte: new Date(d.setHours(0, 0, 0, 0)),
        lte: new Date(d.setHours(23, 59, 59, 999))
      };
    }
    const reservations = await prisma.reservationYakro.findMany({
      where,
      orderBy: { dateHeure: 'asc' },
      include: { table: true }
    });
    res.json(reservations);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, yakro, async (req, res) => {
  try {
    const resa = await prisma.reservationYakro.create({ data: req.body });
    await prisma.tableRestaurant.update({ where: { id: req.body.tableId }, data: { statut: 'RESERVEE' } });
    res.status(201).json(resa);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/statut', auth, yakro, async (req, res) => {
  try {
    const resa = await prisma.reservationYakro.update({
      where: { id: req.params.id },
      data: { statut: req.body.statut }
    });
    if (['ANNULEE', 'HONOREE'].includes(req.body.statut)) {
      await prisma.tableRestaurant.update({ where: { id: resa.tableId }, data: { statut: 'LIBRE' } });
    }
    res.json(resa);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
