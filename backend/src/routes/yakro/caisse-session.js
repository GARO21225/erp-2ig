const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale, requireRole } = require('../../middleware/auth');
const yakro = requireFiliale('YAKRO_GRILL');

// GET /session-active — Session de caisse actuellement ouverte
router.get('/session-active', auth, yakro, async (req, res) => {
  try {
    const session = await prisma.sessionCaisseYakro.findFirst({ where: { statut: 'OUVERTE' }, orderBy: { ouvertLe: 'desc' } });
    res.json(session);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /ouvrir — Ouvrir une session de caisse
router.post('/ouvrir', auth, yakro, async (req, res) => {
  try {
    const { montantOuverture = 0 } = req.body;
    const active = await prisma.sessionCaisseYakro.findFirst({ where: { statut: 'OUVERTE' } });
    if (active) return res.status(400).json({ error: 'Une session est déjà ouverte' });
    const session = await prisma.sessionCaisseYakro.create({
      data: { ouvertPar: req.user.id, ouvertParNom: `${req.user.prenom} ${req.user.nom}`, montantOuverture: Number(montantOuverture) }
    });
    res.status(201).json(session);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /cloturer — Clôturer la session avec écart
router.post('/cloturer', auth, requireRole('DG','DIRECTEUR','MANAGER','COMPTABLE'), async (req, res) => {
  try {
    const { montantReel, notes } = req.body;
    const session = await prisma.sessionCaisseYakro.findFirst({ where: { statut: 'OUVERTE' }, orderBy: { ouvertLe: 'desc' } });
    if (!session) return res.status(400).json({ error: 'Aucune session ouverte' });

    // Calculer montant théorique = entrées depuis ouverture
    const ca = await prisma.paiementYakro.aggregate({
      _sum: { montant: true },
      where: { createdAt: { gte: session.ouvertLe } }
    });
    const depenses = await prisma.depenseYakro.aggregate({
      _sum: { montant: true },
      where: { statut: 'PAYEE', createdAt: { gte: session.ouvertLe } }
    });
    const montantTheorique = session.montantOuverture + (ca._sum.montant||0) - (depenses._sum.montant||0);
    const ecart = Number(montantReel||0) - montantTheorique;

    const updated = await prisma.sessionCaisseYakro.update({
      where: { id: session.id },
      data: {
        closPar: req.user.id, closParNom: `${req.user.prenom} ${req.user.nom}`,
        closLe: new Date(), statut: 'CLOTUREE',
        montantTheorique, montantReel: Number(montantReel||0), ecart, notes
      }
    });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /historique — Historique des clôtures
router.get('/historique', auth, yakro, async (req, res) => {
  try {
    const sessions = await prisma.sessionCaisseYakro.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    res.json(sessions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Routes annulations
router.get('/annulations', auth, yakro, async (req, res) => {
  try {
    const { dateDebut } = req.query;
    const where = {};
    if (dateDebut) where.createdAt = { gte: new Date(dateDebut) };
    else { const d = new Date(); d.setDate(d.getDate()-7); where.createdAt = { gte: d }; }
    const data = await prisma.annulationYakro.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/annulations', auth, yakro, async (req, res) => {
  try {
    const { commandeId, menuNom, quantite, montant, motif, ligneId } = req.body;
    if (!commandeId || !menuNom || !motif || !montant) return res.status(400).json({ error: 'Champs requis manquants' });
    const a = await prisma.annulationYakro.create({
      data: { commandeId, ligneId, menuNom, quantite: Number(quantite||1), montant: Number(montant), motif, employeId: req.user.id, employeNom: `${req.user.prenom} ${req.user.nom}` }
    });
    res.status(201).json(a);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Routes remises
router.get('/remises', auth, yakro, async (req, res) => {
  try {
    const { dateDebut } = req.query;
    const where = {};
    if (dateDebut) where.createdAt = { gte: new Date(dateDebut) };
    else { const d = new Date(); d.setDate(d.getDate()-7); where.createdAt = { gte: d }; }
    const data = await prisma.remiseYakro.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/remises', auth, yakro, async (req, res) => {
  try {
    const { commandeId, montantAvant, montantRemise, motif } = req.body;
    if (!commandeId || !montantAvant || !montantRemise || !motif) return res.status(400).json({ error: 'Champs requis manquants' });
    const r = await prisma.remiseYakro.create({
      data: { commandeId, montantAvant: Number(montantAvant), montantRemise: Number(montantRemise), montantFinal: Number(montantAvant)-Number(montantRemise), motif, employeId: req.user.id, employeNom: `${req.user.prenom} ${req.user.nom}` }
    });
    res.status(201).json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
