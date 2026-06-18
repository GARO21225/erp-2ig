const router = require('express').Router();
const safe = async (fn) => { try { return await fn(); } catch { return null; } };
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const liya = requireFiliale('LIYA');

// Génération code partenaire
const genCode = () => `PAR-${Date.now().toString(36).toUpperCase().slice(-5)}`;

// GET / — Liste partenaires
router.get('/', auth, liya, async (req, res) => {
  try {
    const { actif } = req.query;
    const where = {};
    if (actif !== undefined) where.actif = actif === 'true';
    const partenaires = await prisma.partenaire.findMany({
      where, orderBy: { nom: 'asc' },
      include: { _count: { select: { stocks3pl: true } } }
    });
    res.json(partenaires);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST / — Créer partenaire
router.post('/', auth, liya, async (req, res) => {
  try {
    const { nom, raisonSociale, telephone, email, adresse, typeActivite, notes } = req.body;
    if (!nom || !telephone) return res.status(400).json({ error: 'nom et telephone requis' });
    const p = await prisma.partenaire.create({
      data: { code: genCode(), nom, raisonSociale, telephone, email, adresse, typeActivite, notes }
    });
    res.status(201).json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id — Modifier
router.put('/:id', auth, liya, async (req, res) => {
  try {
    const { nom, raisonSociale, telephone, email, adresse, typeActivite, notes, actif } = req.body;
    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (raisonSociale !== undefined) data.raisonSociale = raisonSociale || null;
    if (telephone !== undefined) data.telephone = telephone;
    if (email !== undefined) data.email = email || null;
    if (adresse !== undefined) data.adresse = adresse || null;
    if (typeActivite !== undefined) data.typeActivite = typeActivite || null;
    if (notes !== undefined) data.notes = notes || null;
    if (actif !== undefined) data.actif = !!actif;
    const p = await prisma.partenaire.update({ where: { id: req.params.id }, data });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id — Désactiver
router.delete('/:id', auth, liya, async (req, res) => {
  try {
    await prisma.partenaire.update({ where: { id: req.params.id }, data: { actif: false } });
    res.json({ message: 'Partenaire désactivé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
