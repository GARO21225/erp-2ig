/**
 * TOPTELSIG — Gestion de Projet Foncier
 * Phases → Activités → Tâches → Livrables
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

const CATEGORIES_DEPENSE = [
  'Acquisition Foncière','Topographie & Études','Administratif & Dossiers',
  'Lotissement & Bornage','Ouverture de Voies & Viabilisation','DTC & Services Techniques',
  'Assainissement & Environnement','Enquêtes & Commissions','Travaux de Construction',
  'Transport & Déplacements','Personnel','Commercial & Marketing',
  'Fournitures & Fonctionnement','Frais Financiers','Autres Dépenses'
];

// ── PHASES ────────────────────────────────────────────────────────────────

// GET /gestion-projet/projet/:projetId — Vue complète projet + phases + livrables
router.get('/projet/:projetId', auth, toptelsig, async (req, res) => {
  try {
    const projet = await prisma.projetFoncier.findUnique({
      where: { id: req.params.projetId },
      include: {
        lots: { select: { id:true, statut:true, prix:true, superficie:true } },
        phases: {
          orderBy: { ordre: 'asc' },
          include: {
            activites: {
              include: { taches: { orderBy: { createdAt: 'asc' } } }
            },
            livrables: { orderBy: { ordre: 'asc' } },
            depenses: { select: { id:true, montant:true, statut:true, categorie:true } }
          }
        },
        depenses: {
          where: { phaseId: null },
          select: { id:true, montant:true, statut:true, categorie:true }
        }
      }
    });
    if (!projet) return res.status(404).json({ error: 'Projet introuvable' });

    // Calculs automatiques
    const lotsVendus = projet.lots.filter(l => l.statut === 'VENDU').length;
    const lotsDispos = projet.lots.filter(l => l.statut === 'DISPONIBLE').length;
    const caRealise = await prisma.paiementFoncier.aggregate({
      _sum: { montant: true },
      where: { venteFoncier: { lot: { projetId: req.params.projetId } } }
    });
    const depTotal = await prisma.depenseFoncier.aggregate({
      _sum: { montant: true },
      where: { projetId: req.params.projetId, statut: { in: ['PAYEE','VALIDEE_FINALE'] } }
    });
    const nbLivrables = await prisma.livrableFoncier.count({ where: { phase: { projetId: req.params.projetId } } });
    const nbLivrablesValides = await prisma.livrableFoncier.count({ where: { phase: { projetId: req.params.projetId }, statut: 'VALIDE' } });

    res.json({
      ...projet,
      _stats: {
        lotsVendus, lotsDispos, lotsTotal: projet.lots.length,
        caRealise: caRealise._sum.montant || 0,
        depTotal: depTotal._sum.montant || 0,
        nbLivrables, nbLivrablesValides,
        avancementLivrables: nbLivrables > 0 ? Math.round(nbLivrablesValides / nbLivrables * 100) : 0,
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /gestion-projet/phases — Créer une phase
router.post('/phases', auth, toptelsig, async (req, res) => {
  try {
    const { projetId, nom, ordre, description, dateDebut, dateFin, budgetPrevu, responsableNom } = req.body;
    if (!projetId || !nom) return res.status(400).json({ error: 'projetId et nom requis' });
    const phase = await prisma.phaseFoncier.create({
      data: { projetId, nom, ordre: ordre || 1, description, dateDebut: dateDebut ? new Date(dateDebut) : null, dateFin: dateFin ? new Date(dateFin) : null, budgetPrevu, responsableNom, responsableId: req.user.id }
    });
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'CREATE', entite: 'PhaseFoncier', entiteId: phase.id, entiteLabel: `${nom} — Projet ${projetId.slice(-6)}` } });
    res.status(201).json(phase);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /gestion-projet/phases/:id — Modifier phase
router.put('/phases/:id', auth, toptelsig, async (req, res) => {
  try {
    const { nom, statut, avancement, description, dateDebut, dateFin, budgetPrevu, responsableNom, ordre } = req.body;
    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (statut !== undefined) data.statut = statut;
    if (avancement !== undefined) data.avancement = avancement;
    if (description !== undefined) data.description = description;
    if (dateDebut !== undefined) data.dateDebut = dateDebut ? new Date(dateDebut) : null;
    if (dateFin !== undefined) data.dateFin = dateFin ? new Date(dateFin) : null;
    if (budgetPrevu !== undefined) data.budgetPrevu = budgetPrevu;
    if (responsableNom !== undefined) data.responsableNom = responsableNom;
    if (ordre !== undefined) data.ordre = ordre;
    const phase = await prisma.phaseFoncier.update({ where: { id: req.params.id }, data });
    res.json(phase);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /gestion-projet/phases/:id
router.delete('/phases/:id', auth, toptelsig, async (req, res) => {
  try {
    const phase = await prisma.phaseFoncier.findUnique({ where: { id: req.params.id }, include: { livrables: true, activites: true } });
    if (!phase) return res.status(404).json({ error: 'Phase introuvable' });
    const hasLivrablesValides = phase.livrables.some(l => l.statut === 'VALIDE');
    if (hasLivrablesValides) return res.status(400).json({ error: 'Impossible de supprimer : des livrables sont validés' });
    await prisma.phaseFoncier.delete({ where: { id: req.params.id } });
    res.json({ message: 'Phase supprimée' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ACTIVITÉS ─────────────────────────────────────────────────────────────

router.post('/activites', auth, toptelsig, async (req, res) => {
  try {
    const { phaseId, nom, description, dateDebut, dateFin, responsableNom } = req.body;
    if (!phaseId || !nom) return res.status(400).json({ error: 'phaseId et nom requis' });
    const a = await prisma.activiteFoncier.create({ data: { phaseId, nom, description, dateDebut: dateDebut ? new Date(dateDebut) : null, dateFin: dateFin ? new Date(dateFin) : null, responsableNom, responsableId: req.user.id } });
    res.status(201).json(a);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/activites/:id', auth, toptelsig, async (req, res) => {
  try {
    const { statut, avancement, nom, responsableNom } = req.body;
    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (statut !== undefined) data.statut = statut;
    if (avancement !== undefined) data.avancement = avancement;
    if (responsableNom !== undefined) data.responsableNom = responsableNom;
    const a = await prisma.activiteFoncier.update({ where: { id: req.params.id }, data });
    res.json(a);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TÂCHES ────────────────────────────────────────────────────────────────

router.post('/taches', auth, toptelsig, async (req, res) => {
  try {
    const { activiteId, nom, description, dateEcheance, priorite, assigneNom } = req.body;
    if (!activiteId || !nom) return res.status(400).json({ error: 'activiteId et nom requis' });
    const t = await prisma.tacheFoncier.create({ data: { activiteId, nom, description, dateEcheance: dateEcheance ? new Date(dateEcheance) : null, priorite: priorite || 'NORMALE', assigneNom, assigneA: req.user.id } });
    res.status(201).json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/taches/:id', auth, toptelsig, async (req, res) => {
  try {
    const t = await prisma.tacheFoncier.update({ where: { id: req.params.id }, data: { ...req.body, dateEcheance: req.body.dateEcheance ? new Date(req.body.dateEcheance) : undefined } });
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LIVRABLES ─────────────────────────────────────────────────────────────

router.get('/livrables/:projetId', auth, toptelsig, async (req, res) => {
  try {
    const livrables = await prisma.livrableFoncier.findMany({
      where: { phase: { projetId: req.params.projetId } },
      include: { phase: { select: { nom: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json(livrables);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/livrables', auth, toptelsig, async (req, res) => {
  try {
    const { phaseId, nom, typeLivrable, responsableNom, datePrevue, obligatoire, description } = req.body;
    if (!phaseId || !nom) return res.status(400).json({ error: 'phaseId et nom requis' });
    const l = await prisma.livrableFoncier.create({ data: { phaseId, nom, typeLivrable: typeLivrable || 'AUTRE', responsableNom, responsableId: req.user.id, datePrevue: datePrevue ? new Date(datePrevue) : null, obligatoire: !!obligatoire, description } });
    res.status(201).json(l);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/livrables/:id', auth, toptelsig, async (req, res) => {
  try {
    const { statut, version, documentId, notes, dateLivraison } = req.body;
    const old = await prisma.livrableFoncier.findUnique({ where: { id: req.params.id } });
    const data = { ...req.body };
    if (dateLivraison) data.dateLivraison = new Date(dateLivraison);
    // Incrémenter version si soumis à nouveau
    if (statut === 'SOUMIS' && old?.statut === 'REFUSE') data.version = (old.version || 1) + 1;
    const l = await prisma.livrableFoncier.update({ where: { id: req.params.id }, data });
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'UPDATE', entite: 'LivrableFoncier', entiteId: l.id, entiteLabel: `${l.nom} → ${statut || l.statut}`, avant: { statut: old?.statut }, apres: { statut: l.statut } } });
    res.json(l);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CATÉGORIES DÉPENSES ───────────────────────────────────────────────────
router.get('/categories-depenses', auth, (req, res) => {
  res.json(CATEGORIES_DEPENSE);
});

// ── DASHBOARD PROJET ─────────────────────────────────────────────────────
router.get('/dashboard/:projetId', auth, toptelsig, async (req, res) => {
  try {
    const pid = req.params.projetId;
    const [projet, ventes, paiements, depenses, livrables, phases] = await Promise.all([
      prisma.projetFoncier.findUnique({ where: { id: pid }, include: { lots: true } }),
      prisma.venteFoncier.findMany({ where: { lot: { projetId: pid } }, include: { echeanciers: true } }),
      prisma.paiementFoncier.aggregate({ _sum:{ montant:true }, where:{ venteFoncier:{ lot:{ projetId:pid } } } }),
      prisma.depenseFoncier.aggregate({ _sum:{ montant:true }, where:{ projetId:pid, statut:{ in:['PAYEE','VALIDEE_FINALE'] } } }),
      prisma.livrableFoncier.groupBy({ by:['statut'], _count:{ id:true }, where:{ phase:{ projetId:pid } } }),
      prisma.phaseFoncier.findMany({ where:{ projetId:pid }, select:{ statut:true, avancement:true } }),
    ]);

    if (!projet) return res.status(404).json({ error: 'Projet introuvable' });
    const lotsVendus = projet.lots.filter(l=>l.statut==='VENDU').length;
    const lotsDispos = projet.lots.filter(l=>l.statut==='DISPONIBLE').length;
    const caPrevu = ventes.reduce((s,v)=>s+v.prixVente,0);
    const caEnc = paiements._sum.montant || 0;
    const dep = depenses._sum.montant || 0;
    const avancementMoyen = phases.length > 0 ? Math.round(phases.reduce((s,p)=>s+p.avancement,0)/phases.length) : projet.avancement;
    const livMap = {};
    livrables.forEach(l => { livMap[l.statut] = l._count.id; });

    res.json({
      projet: { id:projet.id, nom:projet.nom, code:projet.code, statut:projet.statut, priorite:projet.priorite, avancement:avancementMoyen },
      ca: { prevu:caPrevu, realise:caEnc, resteAEncaisser:caPrevu-caEnc, tauxEncaissement:caPrevu>0?Math.round(caEnc/caPrevu*100):0 },
      depenses: { total:dep, budget:projet.budgetTotal||0, ecart:(projet.budgetTotal||0)-dep },
      resultat: { brut:caEnc-dep, marge:caEnc>0?Math.round((caEnc-dep)/caEnc*100):0 },
      lots: { total:projet.lots.length, vendus:lotsVendus, dispos:lotsDispos, tauxVente:projet.lots.length>0?Math.round(lotsVendus/projet.lots.length*100):0 },
      livrables: livMap,
      souscripteurs: ventes.length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
