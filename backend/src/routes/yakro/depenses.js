const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale, requireRole } = require('../../middleware/auth');
const yakro = requireFiliale('YAKRO_GRILL');

const CATEGORIES_DEPENSE = [
  'Achats marchandises','Boissons','Viandes','Poissons','Légumes',
  'Gaz','Électricité','Eau','Transport','Salaires','Entretien','Marketing','Divers'
];

// GET / — Liste dépenses
router.get('/', auth, yakro, async (req, res) => {
  try {
    const { statut, dateDebut } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (dateDebut) where.date = { gte: new Date(dateDebut) };
    else { const d = new Date(); d.setDate(d.getDate()-30); where.date = { gte: d }; }
    const [data, total] = await Promise.all([
      prisma.depenseYakro.findMany({ where, orderBy: { createdAt:'desc' }, take: 200 }),
      prisma.depenseYakro.aggregate({ _sum: { montant: true }, where }),
    ]);
    res.json({ data, total: total._sum.montant || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /categories
router.get('/categories', auth, (req, res) => res.json(CATEGORIES_DEPENSE));

// POST /
router.post('/', auth, yakro, async (req, res) => {
  try {
    const { categorie, description, montant, beneficiaire, typePaiement, notes } = req.body;
    if (!categorie || !description || !montant) return res.status(400).json({ error: 'categorie, description, montant requis' });
    const d = await prisma.depenseYakro.create({
      data: { categorie, description, montant: Number(montant), beneficiaire, typePaiement, notes, creePar: req.user.id, creeParNom: `${req.user.prenom} ${req.user.nom}` }
    });
    res.status(201).json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/valider
router.put('/:id/valider', auth, requireRole('DG','DIRECTEUR','MANAGER'), async (req, res) => {
  try {
    const d = await prisma.depenseYakro.update({
      where: { id: req.params.id },
      data: { statut: 'VALIDEE', validePar: req.user.id, valideParNom: `${req.user.prenom} ${req.user.nom}` }
    });
    res.json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/payer
router.put('/:id/payer', auth, requireRole('DG','DIRECTEUR','COMPTABLE'), async (req, res) => {
  try {
    const d = await prisma.depenseYakro.update({
      where: { id: req.params.id },
      data: { statut: 'PAYEE', payePar: req.user.id, payeParNom: `${req.user.prenom} ${req.user.nom}`, reference: req.body.reference }
    });
    res.json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /stats
router.get('/stats', auth, yakro, async (req, res) => {
  try {
    const d = new Date(); d.setHours(0,0,0,0);
    const [jour, mois, parCat] = await Promise.all([
      prisma.depenseYakro.aggregate({ _sum:{ montant:true }, where:{ date:{ gte:d } } }),
      prisma.depenseYakro.aggregate({ _sum:{ montant:true }, where:{ date:{ gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
      prisma.depenseYakro.groupBy({ by:['categorie'], _sum:{ montant:true }, orderBy:{ _sum:{ montant:'desc' } }, take:10 }),
    ]);
    res.json({ jour: jour._sum.montant||0, mois: mois._sum.montant||0, parCategorie: parCat.map(c=>({ categorie:c.categorie, montant:c._sum.montant||0 })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
