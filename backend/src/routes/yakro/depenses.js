const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const { resto, can, sc } = require('../../lib/yakro-resto');
const yakro = requireFiliale('YAKRO_GRILL');

const CATEGORIES_DEPENSE = [
  'Achats marchandises','Boissons','Viandes','Poissons','Légumes',
  'Gaz','Électricité','Eau','Loyer','Internet / Téléphone','Assurance',
  'Transport','Salaires','Entretien','Marketing','Divers'
];
// Charges fixes : reviennent chaque mois quel que soit le chiffre d'affaires
const CATEGORIES_FIXES = ['Salaires','Loyer','Électricité','Eau','Internet / Téléphone','Assurance'];
const natureDe = (categorie) => (CATEGORIES_FIXES.includes(categorie) ? 'FIXE' : 'VARIABLE');
const RECU_OK = (v) => /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,/.test(v) && v.length < 1400000;
const moisCourant = () => new Date().toISOString().slice(0, 7);

// GET / — Liste dépenses (filtres : statut, nature, categorie, employeId, du, au)
router.get('/', auth, yakro, resto, async (req, res) => {
  try {
    const { statut, nature, categorie, employeId, du, au, dateDebut } = req.query;
    const where = { ...sc(req) };
    if (statut) where.statut = statut;
    if (nature) where.nature = nature;
    if (categorie) where.categorie = categorie;
    if (employeId) where.employeId = employeId;
    const debut = du || dateDebut;
    if (debut || au) { where.date = {}; if (debut) where.date.gte = new Date(debut); if (au) where.date.lte = new Date(`${au}T23:59:59.999Z`); }
    else { const d = new Date(); d.setDate(d.getDate() - 30); where.date = { gte: d }; }
    const [data, total, avecRecu] = await Promise.all([
      prisma.depenseYakro.findMany({ where, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 500, omit: { recu: true } }),
      prisma.depenseYakro.groupBy({ by: ['nature'], _sum: { montant: true }, where: { ...where, statut: where.statut || { not: 'REJETEE' } } }),
      prisma.depenseYakro.findMany({ where: { ...where, NOT: { recu: null } }, select: { id: true } }),
    ]);
    const ids = new Set(avecRecu.map(r => r.id));
    const somme = (n) => total.find(t => t.nature === n)?._sum.montant || 0;
    res.json({ data: data.map(d => ({ ...d, aRecu: ids.has(d.id) })), total: somme('FIXE') + somme('VARIABLE'), totalFixes: somme('FIXE'), totalVariables: somme('VARIABLE') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /categories
router.get('/categories', auth, (req, res) => res.json(CATEGORIES_DEPENSE));
router.get('/categories-fixes', auth, (req, res) => res.json(CATEGORIES_FIXES));

// GET /salaire/:employeId?periode=AAAA-MM — salaire de base, déjà versé et reste à payer
router.get('/salaire/:employeId', auth, yakro, resto, async (req, res) => {
  try {
    const periode = req.query.periode || moisCourant();
    const e = await prisma.employe.findUnique({ where: { id: req.params.employeId }, select: { id: true, nom: true, prenom: true, salaireBase: true } });
    if (!e) return res.status(404).json({ error: 'Salarié introuvable' });
    const verse = await prisma.depenseYakro.aggregate({ _sum: { montant: true }, where: { categorie: 'Salaires', employeId: e.id, periode, statut: { not: 'REJETEE' } } });
    const v = verse._sum.montant || 0;
    res.json({ employeId: e.id, nom: `${e.prenom} ${e.nom}`, periode, salaireBase: e.salaireBase, verse: v, reste: Math.max(0, e.salaireBase - v) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /
router.post('/', auth, yakro, resto, can('depenses.saisir'), async (req, res) => {
  try {
    const { categorie, description, montant, typePaiement, notes, recu } = req.body;
    let { beneficiaire, employeId, periode } = req.body;
    if (!categorie || !description || !montant) return res.status(400).json({ error: 'categorie, description, montant requis' });
    if (!(Number(montant) > 0)) return res.status(400).json({ error: 'Montant invalide' });
    if (recu && !RECU_OK(recu)) return res.status(400).json({ error: 'Reçu invalide (image PNG/JPEG/WebP ou PDF, 1 Mo max)' });
    let employeNom = null;
    if (categorie === 'Salaires') {
      if (!employeId) return res.status(400).json({ error: 'Choisissez le salarié concerné' });
      const e = await prisma.employe.findUnique({ where: { id: employeId }, select: { nom: true, prenom: true } });
      if (!e) return res.status(400).json({ error: 'Salarié introuvable' });
      employeNom = `${e.prenom} ${e.nom}`; beneficiaire = employeNom; periode = /^\d{4}-\d{2}$/.test(periode || '') ? periode : moisCourant();
    } else { employeId = null; periode = null; }
    const nature = ['FIXE', 'VARIABLE'].includes(req.body.nature) ? req.body.nature : natureDe(categorie);
    const d = await prisma.depenseYakro.create({
      data: { restaurantId: req.restaurantId, categorie, description, montant: Number(montant), beneficiaire, typePaiement, notes, nature, employeId, employeNom, periode, recu: recu || null, creePar: req.user.id, creeParNom: `${req.user.prenom} ${req.user.nom}` },
      omit: { recu: true },
    });
    res.status(201).json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/recu — ajouter / remplacer / retirer le reçu
router.put('/:id/recu', auth, yakro, resto, can('depenses.saisir'), async (req, res) => {
  try {
    const { recu } = req.body;
    if (recu && !RECU_OK(recu)) return res.status(400).json({ error: 'Reçu invalide (image PNG/JPEG/WebP ou PDF, 1 Mo max)' });
    const ok = await prisma.depenseYakro.findFirst({ where: { id: req.params.id, ...sc(req) }, select: { id: true } });
    if (!ok) return res.status(404).json({ error: 'Dépense introuvable' });
    await prisma.depenseYakro.update({ where: { id: ok.id }, data: { recu: recu || null } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id/recu
router.get('/:id/recu', auth, yakro, resto, async (req, res) => {
  try {
    const d = await prisma.depenseYakro.findFirst({ where: { id: req.params.id, ...sc(req) }, select: { recu: true } });
    if (!d?.recu) return res.status(404).json({ error: 'Aucun reçu' });
    res.json({ recu: d.recu });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const nomDe = (u) => `${u.prenom} ${u.nom}`;
const estDG = (u) => ['DG', 'DIRECTEUR'].includes(u.role);
const trouver = async (req, res, statuts) => {
  const d = await prisma.depenseYakro.findFirst({ where: { id: req.params.id, ...sc(req) }, omit: { recu: true } });
  if (!d) { res.status(404).json({ error: 'Dépense introuvable' }); return null; }
  if (!statuts.includes(d.statut)) { res.status(400).json({ error: `Étape impossible : la dépense est « ${d.statut} »` }); return null; }
  return d;
};

// ① Émission → ② PUT /:id/valider — validation par le DG
router.put('/:id/valider', auth, yakro, resto, can('depenses.valider'), async (req, res) => {
  try {
    if (!estDG(req.user)) return res.status(403).json({ error: 'Seul le DG valide une dépense' });
    const d = await trouver(req, res, ['BROUILLON']); if (!d) return;
    res.json(await prisma.depenseYakro.update({ where: { id: d.id }, data: { statut: 'VALIDEE', validePar: req.user.id, valideParNom: nomDe(req.user), valideLe: new Date(), motifRejet: null }, omit: { recu: true } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ②bis PUT /:id/rejeter — refus par le DG (motif obligatoire)
router.put('/:id/rejeter', auth, yakro, resto, can('depenses.valider'), async (req, res) => {
  try {
    if (!estDG(req.user)) return res.status(403).json({ error: 'Seul le DG rejette une dépense' });
    if (!req.body.motif?.trim()) return res.status(400).json({ error: 'Motif du rejet obligatoire' });
    const d = await trouver(req, res, ['BROUILLON']); if (!d) return;
    res.json(await prisma.depenseYakro.update({ where: { id: d.id }, data: { statut: 'REJETEE', motifRejet: req.body.motif.trim(), validePar: req.user.id, valideParNom: nomDe(req.user), valideLe: new Date() }, omit: { recu: true } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ③ PUT /:id/payer — décaissement par le comptable (mode + référence)
router.put('/:id/payer', auth, yakro, resto, can('depenses.decaisser'), async (req, res) => {
  try {
    const d = await trouver(req, res, ['VALIDEE']); if (!d) return;
    const data = { statut: 'PAYEE', payePar: req.user.id, payeParNom: nomDe(req.user), payeLe: new Date(), reference: req.body.reference || d.reference };
    if (req.body.typePaiement) data.typePaiement = req.body.typePaiement;
    res.json(await prisma.depenseYakro.update({ where: { id: d.id }, data, omit: { recu: true } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ④ PUT /:id/justifier — justification : montant réellement dépensé + reçu
router.put('/:id/justifier', auth, yakro, resto, can('depenses.saisir', 'depenses.decaisser'), async (req, res) => {
  try {
    const d = await trouver(req, res, ['PAYEE']); if (!d) return;
    const { recu, note } = req.body;
    const montantJustifie = Number(req.body.montantJustifie ?? d.montant);
    if (!(montantJustifie >= 0)) return res.status(400).json({ error: 'Montant justifié invalide' });
    if (recu && !RECU_OK(recu)) return res.status(400).json({ error: 'Reçu invalide (image PNG/JPEG/WebP ou PDF, 1 Mo max)' });
    const dejaRecu = recu || (await prisma.depenseYakro.findUnique({ where: { id: d.id }, select: { recu: true } }))?.recu;
    if (!dejaRecu) return res.status(400).json({ error: 'Joignez le justificatif (reçu, facture) pour justifier' });
    if (montantJustifie !== d.montant && !note?.trim()) return res.status(400).json({ error: 'Écart entre montant décaissé et justifié : précisez-le dans la note' });
    res.json(await prisma.depenseYakro.update({ where: { id: d.id }, data: { statut: 'JUSTIFIEE', montantJustifie, noteJustification: note?.trim() || null, justifiePar: req.user.id, justifieParNom: nomDe(req.user), justifieLe: new Date(), ...(recu ? { recu } : {}) }, omit: { recu: true } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⑤ PUT /:id/cloturer — clôture par le comptable
router.put('/:id/cloturer', auth, yakro, resto, can('depenses.cloturer'), async (req, res) => {
  try {
    const d = await trouver(req, res, ['JUSTIFIEE']); if (!d) return;
    res.json(await prisma.depenseYakro.update({ where: { id: d.id }, data: { statut: 'CLOTUREE', clotureLe: new Date(), clotureParNom: nomDe(req.user) }, omit: { recu: true } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /stats
router.get('/stats', auth, yakro, resto, async (req, res) => {
  try {
    const d = new Date(); d.setHours(0,0,0,0);
    const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [jour, mois, parCat, parNature] = await Promise.all([
      prisma.depenseYakro.aggregate({ _sum:{ montant:true }, where:{ statut:{ not:'REJETEE' }, date:{ gte:d }, ...sc(req) } }),
      prisma.depenseYakro.aggregate({ _sum:{ montant:true }, where:{ statut:{ not:'REJETEE' }, date:{ gte: debutMois }, ...sc(req) } }),
      prisma.depenseYakro.groupBy({ by:['categorie'], where: sc(req), _sum:{ montant:true }, orderBy:{ _sum:{ montant:'desc' } }, take:10 }),
      prisma.depenseYakro.groupBy({ by:['nature'], where:{ statut:{ not:'REJETEE' }, date:{ gte: debutMois }, ...sc(req) }, _sum:{ montant:true } }),
    ]);
    const nat = (n) => parNature.find(x => x.nature === n)?._sum.montant || 0;
    res.json({ jour: jour._sum.montant||0, mois: mois._sum.montant||0, moisFixes: nat('FIXE'), moisVariables: nat('VARIABLE'), parCategorie: parCat.map(c=>({ categorie:c.categorie, montant:c._sum.montant||0 })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
