const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

// ── SOUSCRIPTEURS ──────────────────────────────
router.get('/', auth, toptelsig, async (req, res) => {
  try {
    const { search, prescripteurId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (prescripteurId) where.prescripteurId = prescripteurId;
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { telephone: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const [total, souscripteurs] = await Promise.all([
      prisma.souscripteur.count({ where }),
      prisma.souscripteur.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          prescripteur: { select: { nom: true, prenom: true } },
          ventes: { select: { id: true, statut: true, prixVente: true } },
          _count: { select: { paiements: true } }
        }
      })
    ]);

    res.json({ data: souscripteurs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', auth, toptelsig, async (req, res) => {
  try {
    const s = await prisma.souscripteur.findUnique({
      where: { id: req.params.id },
      include: {
        prescripteur: true,
        ventes: {
          include: {
            lot: { include: { projet: true } },
            echeanciers: { orderBy: { numero: 'asc' } },
            paiements: { orderBy: { createdAt: 'desc' } },
          }
        },
        documents: { orderBy: { createdAt: 'desc' } },
      }
    });
    if (!s) return res.status(404).json({ error: 'Souscripteur introuvable' });
    res.json(s);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, toptelsig, async (req, res) => {
  try {
    const code = `SOUS-${Date.now()}`;
    const s = await prisma.souscripteur.create({ data: { ...req.body, code } });
    res.status(201).json(s);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', auth, toptelsig, async (req, res) => {
  try {
    const s = await prisma.souscripteur.update({ where: { id: req.params.id }, data: req.body });
    res.json(s);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PAIEMENTS SOUSCRIPTEUR ──────────────────────────────
router.post('/:id/paiements', auth, toptelsig, async (req, res) => {
  try {
    const { venteId, echeancierId, montant, typePaiement, reference, notes } = req.body;
    const montantPaye = Number(montant);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Enregistrer le paiement
      const paiement = await tx.paiementFoncier.create({
        data: { venteId, souscripteurId: req.params.id, echeancierId, montant: montantPaye, typePaiement, reference, notes, statut: 'VALIDE' }
      });

      let excedent = 0;

      // 2. Mettre à jour l'échéance ciblée
      if (echeancierId) {
        const ech = await tx.echeancier.findUnique({ where: { id: echeancierId } });
        const totalPaye = ech.montantPaye + montantPaye;
        excedent = Math.max(0, totalPaye - ech.montant);
        const nouveauStatut = totalPaye >= ech.montant ? 'PAYE' : totalPaye > 0 ? 'PARTIEL' : 'EN_ATTENTE';
        await tx.echeancier.update({
          where: { id: echeancierId },
          data: { montantPaye: Math.min(totalPaye, ech.montant), statut: nouveauStatut }
        });
      }

      // 3. Recalculer les échéances restantes si paiement supérieur
      // Logique : déduire le montant total payé du capital restant et recalculer les mensualités
      const vente = await tx.venteFoncier.findUnique({ where: { id: venteId } });
      const touteEcheances = await tx.echeancier.findMany({
        where: { venteId },
        orderBy: { numero: 'asc' }
      });

      // Calculer total déjà payé (toutes échéances confondues)
      const totalDejaPayeAll = touteEcheances.reduce((s, e) => s + e.montantPaye, 0);
      const capitalRestant = vente.prixVente - totalDejaPayeAll;

      // Échéances encore en attente/partiel/retard
      const echRestantes = touteEcheances.filter(e => e.statut !== 'PAYE' && e.statut !== 'ANNULE');

      if (echRestantes.length > 0 && capitalRestant > 0) {
        // Recalculer la mensualité égale pour les échéances restantes
        const nouvelleMensualite = Math.round(capitalRestant / echRestantes.length);
        for (const ech of echRestantes) {
          await tx.echeancier.update({
            where: { id: ech.id },
            data: { montant: nouvelleMensualite }
          });
        }
      } else if (capitalRestant <= 0) {
        // Tout est payé → marquer la vente comme soldée
        await tx.venteFoncier.update({ where: { id: venteId }, data: { statut: 'SOLDE' } });
        await tx.lot.update({ where: { id: vente.lotId }, data: { statut: 'VENDU' } });
      }

      // 4. Encaisser dans caisse TOPTELSIG
      const caisse = await tx.caisse.findFirst({ where: { filiale: 'TOPTELSIG', actif: true } });
      if (caisse) {
        await tx.encaissement.create({
          data: {
            caisseId: caisse.id, filiale: 'TOPTELSIG', montant: montantPaye,
            typePaiement, reference, motif: `Paiement foncier - Vente ${venteId.slice(-8)}`,
            entiteRef: req.params.id, entiteType: 'souscripteur', operateurId: req.user.id,
          }
        });
        await tx.caisse.update({ where: { id: caisse.id }, data: { solde: { increment: montantPaye } } });
      }

      // 5. Audit
      await tx.auditLog.create({
        data: {
          utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`,
          filiale: 'TOPTELSIG', action: 'PAIEMENT', entite: 'PaiementFoncier',
          entiteId: paiement.id,
          entiteLabel: `${montantPaye.toLocaleString('fr')} F — Souscripteur ${req.params.id.slice(-6)}`,
          apres: { montant: montantPaye, typePaiement, capitalRestant: Math.max(0, capitalRestant) }
        }
      });

      return { paiement, capitalRestant: Math.max(0, capitalRestant), mensualiteRecalculee: echRestantes.length > 0 ? Math.round(capitalRestant / echRestantes.length) : 0 };
    });

    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

// GET /template — Template Excel souscripteurs
router.get('/template', auth, toptelsig, (_, res) => {
  const headers = ['nom','prenom','telephone','email','adresse','profession','numeroCni','statut'];
  const example = [['DUPONT','Jean','0701234567','jean@email.com','Abidjan Cocody','Ingénieur','CI12345678','PROSPECT']];
  res.setHeader('Content-Disposition', 'attachment; filename="template_souscripteurs.csv"');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + [headers, ...example].map(r => r.join(';')).join('\r\n'));
});

// POST /import — Import CSV/Excel souscripteurs
const multer = require('multer');
const upload2 = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5*1024*1024 } });
router.post('/import', auth, toptelsig, upload2.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const xlsx = require('xlsx');
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
    const errors = [], created = [];
    for (const [i, row] of rows.entries()) {
      if (!row.nom || !row.prenom || !row.telephone) { errors.push(`Ligne ${i+2}: nom, prenom, telephone requis`); continue; }
      try {
        const code = `SOUS-${Date.now()}-${i}`;
        const s = await prisma.souscripteur.create({ data: { code, nom: String(row.nom), prenom: String(row.prenom), telephone: String(row.telephone), email: row.email || null, adresse: row.adresse || null, profession: row.profession || null, numeroCni: row.numeroCni || null, statut: row.statut || 'PROSPECT' } });
        created.push(s.id);
      } catch(e) { errors.push(`Ligne ${i+2}: ${e.message}`); }
    }
    res.json({ imported: created.length, errors, total: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
