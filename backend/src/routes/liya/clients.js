/**
 * Clients LiYA — clients récurrents SANS stock (ex: une administration
 * qui se fait livrer des repas régulièrement). Volontairement séparé de
 * Partenaire (qui, lui, a du stock 3PL déposé chez LiYA) — décision
 * explicite d'Edgar de ne jamais mélanger les deux notions.
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const liya = requireFiliale('LIYA');

const TYPES_VALIDES = ['ENTREPRISE', 'ADMINISTRATION', 'PARTICULIER', 'AUTRE'];
const genCode = () => `CLI-${Date.now().toString(36).toUpperCase().slice(-5)}`;

// GET / — Liste clients
router.get('/', auth, liya, async (req, res) => {
  try {
    const { actif } = req.query;
    const where = {};
    if (actif !== undefined) where.actif = actif === 'true';
    const clients = await prisma.clientLiYA.findMany({ where, orderBy: { nom: 'asc' } });
    res.json(clients);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST / — Créer client
router.post('/', auth, liya, async (req, res) => {
  try {
    const { nom, typeClient, telephone, email, adresse, notes } = req.body;
    if (!nom || !telephone) return res.status(400).json({ error: 'nom et telephone requis' });
    const c = await prisma.clientLiYA.create({
      data: {
        code: genCode(), nom, telephone,
        typeClient: TYPES_VALIDES.includes(typeClient) ? typeClient : 'ENTREPRISE',
        email: email || null, adresse: adresse || null, notes: notes || null,
      }
    });
    res.status(201).json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id — Modifier
router.put('/:id', auth, liya, async (req, res) => {
  try {
    const { nom, typeClient, telephone, email, adresse, notes, actif } = req.body;
    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (typeClient !== undefined && TYPES_VALIDES.includes(typeClient)) data.typeClient = typeClient;
    if (telephone !== undefined) data.telephone = telephone;
    if (email !== undefined) data.email = email || null;
    if (adresse !== undefined) data.adresse = adresse || null;
    if (notes !== undefined) data.notes = notes || null;
    if (actif !== undefined) data.actif = !!actif;
    const c = await prisma.clientLiYA.update({ where: { id: req.params.id }, data });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id — Désactiver
router.delete('/:id', auth, liya, async (req, res) => {
  try {
    await prisma.clientLiYA.update({ where: { id: req.params.id }, data: { actif: false } });
    res.json({ message: 'Client désactivé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
