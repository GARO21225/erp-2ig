/**
 * Yakro Grill — Congés : l'agent fait sa demande, le patron (DG/Directeur) valide, fixe la date de reprise et l'agent est notifié.
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const { resto, sc } = require('../../lib/yakro-resto');
const yakro = requireFiliale('YAKRO_GRILL');
const patron = (u) => ['DG', 'DIRECTEUR'].includes(u.role);
const TYPES = ['ANNUEL', 'MALADIE', 'PERMISSION', 'SANS_SOLDE', 'AUTRE'];
const jour = (s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; };

// Liste : le patron voit tout, les autres uniquement leurs demandes
router.get('/', auth, yakro, resto, async (req, res) => {
  try {
    const where = { ...sc(req), ...(patron(req.user) ? {} : { utilisateurId: req.user.id }) };
    if (req.query.statut) where.statut = String(req.query.statut);
    res.json(await prisma.congeYakro.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, yakro, resto, async (req, res) => {
  try {
    const { type = 'ANNUEL', motif } = req.body;
    const dateDebut = jour(req.body.dateDebut), dateFin = jour(req.body.dateFin);
    if (!dateDebut || !dateFin) return res.status(400).json({ error: 'Dates de début et de fin requises' });
    if (dateFin < dateDebut) return res.status(400).json({ error: 'La fin ne peut pas précéder le début' });
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Type de congé invalide' });
    const doublon = await prisma.congeYakro.findFirst({ where: { utilisateurId: req.user.id, statut: { in: ['DEMANDE', 'APPROUVE'] }, dateDebut: { lte: dateFin }, dateFin: { gte: dateDebut } } });
    if (doublon) return res.status(409).json({ error: 'Vous avez déjà un congé (demandé ou approuvé) sur ces dates' });
    const an = new Date().getFullYear();
    const n = (await prisma.congeYakro.count({ where: { createdAt: { gte: new Date(`${an}-01-01`) } } })) + 1;
    const c = await prisma.congeYakro.create({ data: { numero: `CGE-${an}-${String(n).padStart(4, '0')}`, utilisateurId: req.user.id, nom: `${req.user.prenom} ${req.user.nom}`, restaurantId: req.restaurantId, type, dateDebut, dateFin, motif: motif || null } });
    res.status(201).json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Décision du patron : approuver (date de reprise obligatoire) ou refuser (motif obligatoire)
router.put('/:id/decider', auth, yakro, resto, async (req, res) => {
  try {
    if (!patron(req.user)) return res.status(403).json({ error: 'Seul le patron peut valider un congé' });
    const c = await prisma.congeYakro.findFirst({ where: { id: req.params.id, ...sc(req) } });
    if (!c) return res.status(404).json({ error: 'Congé introuvable' });
    if (c.statut !== 'DEMANDE') return res.status(409).json({ error: 'Cette demande a déjà été traitée' });
    const data = { decidePar: req.user.id, decideParNom: `${req.user.prenom} ${req.user.nom}`, decideLe: new Date() };
    if (req.body.decision === 'REFUSE') {
      if (!String(req.body.motif || '').trim()) return res.status(400).json({ error: 'Motif du refus requis' });
      Object.assign(data, { statut: 'REFUSE', motifRefus: String(req.body.motif).trim() });
    } else {
      const reprise = jour(req.body.dateReprise);
      if (!reprise) return res.status(400).json({ error: 'Date de reprise requise' });
      const debut = jour(req.body.dateDebut) || c.dateDebut, fin = jour(req.body.dateFin) || c.dateFin;
      if (reprise <= fin) return res.status(400).json({ error: 'La reprise doit être après la fin du congé' });
      Object.assign(data, { statut: 'APPROUVE', dateReprise: reprise, dateDebut: debut, dateFin: fin });
    }
    res.json(await prisma.congeYakro.update({ where: { id: c.id }, data }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Le patron peut décaler la reprise d'un congé approuvé
router.put('/:id/reprise', auth, yakro, resto, async (req, res) => {
  try {
    if (!patron(req.user)) return res.status(403).json({ error: 'Réservé au patron' });
    const c = await prisma.congeYakro.findFirst({ where: { id: req.params.id, ...sc(req), statut: 'APPROUVE' } });
    if (!c) return res.status(404).json({ error: 'Congé approuvé introuvable' });
    const reprise = jour(req.body.dateReprise);
    if (!reprise || reprise <= c.dateFin) return res.status(400).json({ error: 'Date de reprise invalide' });
    res.json(await prisma.congeYakro.update({ where: { id: c.id }, data: { dateReprise: reprise } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// L'agent annule sa propre demande tant qu'elle n'est pas traitée
router.put('/:id/annuler', auth, yakro, resto, async (req, res) => {
  try {
    const c = await prisma.congeYakro.findFirst({ where: { id: req.params.id, utilisateurId: req.user.id, statut: 'DEMANDE' } });
    if (!c) return res.status(404).json({ error: 'Demande introuvable ou déjà traitée' });
    res.json(await prisma.congeYakro.update({ where: { id: c.id }, data: { statut: 'ANNULE' } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
