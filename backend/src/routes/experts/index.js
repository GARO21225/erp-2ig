// ── EXPERTS ─────────────────────────────────────────────────────────────
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth } = require('../../middleware/auth');

// ── GET /experts — liste avec filtres
router.get('/', auth, async (req, res) => {
  try {
    const { specialite, statut, q } = req.query;
    const where = {};
    if (specialite) where.specialite = specialite;
    if (statut) where.statut = statut;
    if (q) where.OR = [
      { nom: { contains: q, mode: 'insensitive' } },
      { prenom: { contains: q, mode: 'insensitive' } },
      { cabinet: { contains: q, mode: 'insensitive' } },
      { numAgrement: { contains: q, mode: 'insensitive' } },
    ];

    const experts = await prisma.expert.findMany({
      where,
      orderBy: { nom: 'asc' },
      include: {
        _count: { select: { missions: true } },
        missions: { where: { statut: { in: ['EN_ATTENTE', 'EN_COURS'] } }, select: { id: true, statut: true } },
      },
    });
    res.json(experts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /experts/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const [total, actifs, missionsEnCours, missionsTerminees, montantTotal] = await Promise.all([
      prisma.expert.count(),
      prisma.expert.count({ where: { statut: 'ACTIF' } }),
      prisma.missionExpert.count({ where: { statut: { in: ['EN_ATTENTE', 'EN_COURS'] } } }),
      prisma.missionExpert.count({ where: { statut: 'TERMINEE' } }),
      prisma.missionExpert.aggregate({ _sum: { montant: true } }),
    ]);
    res.json({ total, actifs, missionsEnCours, missionsTerminees, montantTotal: montantTotal._sum.montant || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /experts/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const expert = await prisma.expert.findUnique({
      where: { id: req.params.id },
      include: { missions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!expert) return res.status(404).json({ error: 'Expert introuvable' });
    res.json(expert);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /experts
router.post('/', auth, async (req, res) => {
  try {
    const { nom, prenom, specialite, cabinet, telephone, email, numAgrement, tarifJour, notes } = req.body;
    if (!nom || !prenom) return res.status(400).json({ error: 'Nom et prénom obligatoires' });
    const expert = await prisma.expert.create({
      data: { nom, prenom, specialite: specialite || 'AUTRE', cabinet, telephone, email, numAgrement, tarifJour: tarifJour ? Number(tarifJour) : null, notes },
    });
    res.status(201).json(expert);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /experts/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { nom, prenom, specialite, cabinet, telephone, email, numAgrement, tarifJour, statut, notes } = req.body;
    const expert = await prisma.expert.update({
      where: { id: req.params.id },
      data: { nom, prenom, specialite, cabinet, telephone, email, numAgrement, tarifJour: tarifJour ? Number(tarifJour) : null, statut, notes },
    });
    res.json(expert);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /experts/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await prisma.expert.delete({ where: { id: req.params.id } });
    res.json({ message: 'Expert supprimé' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /experts/missions/all — toutes les missions
router.get('/missions/all', auth, async (req, res) => {
  try {
    const { statut, expertId } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (expertId) where.expertId = expertId;
    const missions = await prisma.missionExpert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { expert: { select: { nom: true, prenom: true, specialite: true } } },
    });
    res.json(missions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /experts/:id/missions
router.post('/:id/missions', auth, async (req, res) => {
  try {
    const { titre, projetNom, description, dateDebut, dateFin, montant, rapport } = req.body;
    if (!titre) return res.status(400).json({ error: 'Titre de mission obligatoire' });
    const mission = await prisma.missionExpert.create({
      data: {
        expertId: req.params.id,
        titre,
        projetNom,
        description,
        dateDebut: dateDebut ? new Date(dateDebut) : null,
        dateFin: dateFin ? new Date(dateFin) : null,
        montant: montant ? Number(montant) : null,
        rapport,
      },
      include: { expert: { select: { nom: true, prenom: true } } },
    });
    res.status(201).json(mission);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /experts/missions/:missionId
router.put('/missions/:missionId', auth, async (req, res) => {
  try {
    const { titre, projetNom, description, dateDebut, dateFin, montant, statut, rapport } = req.body;
    const mission = await prisma.missionExpert.update({
      where: { id: req.params.missionId },
      data: {
        titre, projetNom, description,
        dateDebut: dateDebut ? new Date(dateDebut) : undefined,
        dateFin: dateFin ? new Date(dateFin) : undefined,
        montant: montant !== undefined ? Number(montant) : undefined,
        statut, rapport,
      },
      include: { expert: { select: { nom: true, prenom: true } } },
    });
    res.json(mission);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
