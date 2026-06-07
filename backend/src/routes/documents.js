// ── GED / DOCUMENTS ──────────────────────────────
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { filiale, entiteType, entiteId } = req.query;
    const where = {};
    if (filiale) where.filiale = filiale;
    if (entiteType) where.entiteType = entiteType;
    if (entiteId) where.entiteId = entiteId;

    const docs = await prisma.document.findMany({
      where,
      orderBy: [{ entiteType: 'asc' }, { createdAt: 'desc' }]
    });
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const doc = await prisma.document.create({
      data: { ...req.body, uploadePar: req.user.id }
    });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ message: 'Supprimé' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
