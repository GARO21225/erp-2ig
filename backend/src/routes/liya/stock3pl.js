const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const liya = requireFiliale('LIYA');

// GET /api/liya/stock3pl
router.get('/', auth, liya, async (req, res) => {
  try {
    const { statut, clientNom, partenaireId, search, page = 1, limit = 100 } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (partenaireId) where.partenaireId = partenaireId;
    if (clientNom) where.clientNom = { contains: clientNom, mode: 'insensitive' };
    if (search) where.OR = [
      { clientNom: { contains: search, mode: 'insensitive' } },
      { article: { contains: search, mode: 'insensitive' } },
    ];

    let total = 0, data = [];
    try {
      [total, data] = await Promise.all([
        prisma.stockClient3PL.count({ where }),
        prisma.stockClient3PL.findMany({
          where,
          skip: (page - 1) * limit,
          take: Number(limit),
          orderBy: { dateEntree: 'desc' },
          include: {
            partenaire: {
              select: { id:true, nom:true, raisonSociale:true, telephone:true, typeActivite:true }
            }
          }
        })
      ]);
    } catch {
      // Fallback sans include partenaire si relation absente
      try {
        [total, data] = await Promise.all([
          prisma.stockClient3PL.count({ where }),
          prisma.stockClient3PL.findMany({
            where, skip: (page - 1) * limit, take: Number(limit),
            orderBy: { dateEntree: 'desc' },
          })
        ]);
      } catch(e2) { return res.status(500).json({ error: e2.message }); }
    }

    // Stats par client
    const statsClient = await prisma.stockClient3PL.groupBy({
      by: ['clientNom'],
      _count: { id: true },
      _sum: { quantite: true },
      where: { statut: 'EN_STOCK' },
    });

    res.json({ data, total, statsClient });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/liya/stock3pl — Nouvelle entrée stock client
router.post('/', auth, liya, async (req, res) => {
  try {
    const { partenaireId, clientNom, clientTel, article, quantite, unite, notes } = req.body;
    if (!article || !quantite) return res.status(400).json({ error: 'article et quantite requis' });
    if (!clientNom && !partenaireId) return res.status(400).json({ error: 'clientNom ou partenaireId requis' });

    const stock = await prisma.stockClient3PL.create({
      data: {
        partenaireId: partenaireId || null,
        clientNom: clientNom || '',
        clientTel: clientTel || null,
        article,
        quantite: Number(quantite),
        unite: unite || 'unité',
        notes: notes || null,
        statut: 'EN_STOCK',
      },
      include: { partenaire: { select: { nom: true, telephone: true } } }
    });
    res.status(201).json(stock);
  } catch (e) {
    console.error('[Stock3PL POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/liya/stock3pl/:id — Sortie partielle ou totale
router.put('/:id/sortie', auth, liya, async (req, res) => {
  try {
    const { quantiteSortie } = req.body;
    const stock = await prisma.stockClient3PL.findUnique({ where: { id: req.params.id } });
    if (!stock) return res.status(404).json({ error: 'Stock introuvable' });

    const qte = Number(quantiteSortie);
    if (qte > stock.quantite) {
      return res.status(400).json({ error: `Quantité sortie (${qte}) supérieure au stock disponible (${stock.quantite})` });
    }

    const nouvelleQte = stock.quantite - qte;
    const statut = nouvelleQte === 0 ? 'SORTI_TOTAL' : 'SORTI_PARTIEL';

    const updated = await prisma.stockClient3PL.update({
      where: { id: req.params.id },
      data: {
        quantite: nouvelleQte,
        statut,
        dateSortie: statut === 'SORTI_TOTAL' ? new Date() : undefined,
      }
    });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/liya/stock3pl/rapport — Rapport mensuel facturable
router.get('/rapport', auth, liya, async (req, res) => {
  try {
    const { mois, annee } = req.query;
    const debut = new Date(annee || new Date().getFullYear(), (mois || new Date().getMonth() + 1) - 1, 1);
    const fin = new Date(debut.getFullYear(), debut.getMonth() + 1, 0, 23, 59, 59);

    const stocks = await prisma.stockClient3PL.findMany({
      where: { dateEntree: { lte: fin }, OR: [{ dateSortie: null }, { dateSortie: { gte: debut } }] }
    });

    // Grouper par client
    const parClient = stocks.reduce((acc, s) => {
      if (!acc[s.clientNom]) acc[s.clientNom] = { client: s.clientNom, telephone: s.clientTel, articles: [] };
      const jours = Math.ceil((Math.min(fin, s.dateSortie || fin) - Math.max(debut, s.dateEntree)) / (1000 * 60 * 60 * 24));
      acc[s.clientNom].articles.push({ ...s, joursStockage: Math.max(0, jours) });
      return acc;
    }, {});

    res.json(Object.values(parClient));
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// PUT /:id/sortir — Marquer comme sorti
router.put('/:id/sortir', auth, liya, async (req, res) => {
  try {
    const item = await prisma.stockClient3pl.update({
      where: { id: req.params.id },
      data: { statut: 'SORTI', dateSortie: new Date() }
    });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
