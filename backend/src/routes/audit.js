const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth, requireRole } = require('../middleware/auth');

router.get('/logs', auth, requireRole('DG', 'DIRECTEUR', 'COMPTABLE', 'RH'), async (req, res) => {
  try {
    const { periode = 'semaine', filiale, action, entite, page = 1, limit = 50 } = req.query;
    const where = {};

    // Filtre période
    const now = new Date();
    if (periode === 'aujourd') {
      where.createdAt = { gte: new Date(now.setHours(0,0,0,0)) };
    } else if (periode === 'semaine') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      where.createdAt = { gte: d };
    } else if (periode === 'mois') {
      where.createdAt = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }

    if (filiale) where.filiale = filiale;
    if (action) where.action = action;
    if (entite) where.entite = entite;
    // Isolation filiale pour les non-DG
    if (req.user.filiale !== 'GROUPE') where.filiale = req.user.filiale;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      })
    ]);

    res.json({ data: logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
