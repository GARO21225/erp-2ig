const router = require('express').Router();
const safe = async (fn) => { try { return await fn(); } catch { return null; } };
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

// GET /api/toptelsig/prescripteurs
router.get('/', auth, toptelsig, async (req, res) => {
  try {
    const { search, actif, page = 1, limit = 20 } = req.query;
    const where = {};
    if (actif !== undefined) where.actif = actif === 'true';
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { telephone: { contains: search } },
        { code: { contains: search } },
      ];
    }
    const [total, data] = await Promise.all([
      prisma.prescripteur.count({ where }),
      prisma.prescripteur.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { nom: 'asc' },
        include: {
          _count: { select: { souscripteurs: true, commissions: true } },
          commissions: {
            select: { montant: true, statut: true },
          }
        }
      })
    ]);

    // Enrichir avec total commissions
    const enriched = data.map(p => ({
      ...p,
      totalCommissionsAttente: p.commissions.filter(c => c.statut === 'EN_ATTENTE').reduce((s, c) => s + c.montant, 0),
      totalCommissionsPaye: p.commissions.filter(c => c.statut === 'PAYEE').reduce((s, c) => s + c.montant, 0),
    }));

    res.json({ data: enriched, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/toptelsig/prescripteurs/:id
router.get('/:id', auth, toptelsig, async (req, res) => {
  try {
    const p = await prisma.prescripteur.findUnique({
      where: { id: req.params.id },
      include: {
        souscripteurs: {
          include: { ventes: { select: { id: true, prixVente: true, statut: true } } }
        },
        commissions: {
          include: { vente: { include: { lot: { include: { projet: true } } } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!p) return res.status(404).json({ error: 'Prescripteur introuvable' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/toptelsig/prescripteurs
router.post('/', auth, toptelsig, async (req, res) => {
  try {
    const code = `PRESC-${Date.now()}`;
    const p = await prisma.prescripteur.create({ data: { ...req.body, code } });
    res.status(201).json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/toptelsig/prescripteurs/:id
router.put('/:id', auth, toptelsig, async (req, res) => {
  try {
    const p = await prisma.prescripteur.update({ where: { id: req.params.id }, data: req.body });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/desactiver
router.put('/:id/desactiver', auth, toptelsig, async (req, res) => {
  try {
    const p = await prisma.prescripteur.update({ where: { id: req.params.id }, data: { actif: false } });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/toptelsig/prescripteurs/:id/commissions
router.get('/:id/commissions', auth, toptelsig, async (req, res) => {
  try {
    const { statut } = req.query;
    const where = { prescripteurId: req.params.id };
    if (statut) where.statut = statut;
    const commissions = await prisma.commission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vente: {
          include: {
            lot: { include: { projet: { select: { nom: true, code: true } } } },
            souscripteur: { select: { nom: true, prenom: true } }
          }
        }
      }
    });
    const total = commissions.reduce((s, c) => s + c.montant, 0);
    res.json({ data: commissions, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/commissions/:commId/payer — Payer une commission
router.put('/:id/commissions/:commId/payer', auth, requireFiliale('TOPTELSIG'), async (req, res) => {
  try {
    const comm = await prisma.commission.update({
      where: { id: req.params.commId },
      data: { statut: 'PAYEE', payeeLe: new Date() }
    });

    // Décaissement
    const caisse = await prisma.caisse.findFirst({ where: { filiale: 'TOPTELSIG', actif: true } });
    if (caisse) {
      await prisma.$transaction([
        prisma.decaissement.create({
          data: {
            caisseId: caisse.id, filiale: 'TOPTELSIG',
            montant: comm.montant, typePaiement: req.body.typePaiement || 'ESPECES',
            reference: req.body.reference,
            motif: `Commission prescripteur ${req.params.id}`,
            categorie: 'COMMISSION', beneficiaire: req.params.id,
            valide: true, validePar: req.user.id,
          }
        }),
        prisma.caisse.update({ where: { id: caisse.id }, data: { solde: { decrement: comm.montant } } })
      ]);
    }

    res.json(comm);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
