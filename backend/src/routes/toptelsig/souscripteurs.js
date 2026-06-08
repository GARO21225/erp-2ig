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

    const paiement = await prisma.paiementFoncier.create({
      data: {
        venteId,
        souscripteurId: req.params.id,
        echeancierId,
        montant: Number(montant),
        typePaiement,
        reference,
        notes,
      }
    });

    // Mettre à jour échéancier
    if (echeancierId) {
      const echeancier = await prisma.echeancier.findUnique({ where: { id: echeancierId } });
      const nouveauMontantPaye = echeancier.montantPaye + Number(montant);
      const nouveauStatut = nouveauMontantPaye >= echeancier.montant ? 'PAYE' :
                            nouveauMontantPaye > 0 ? 'PARTIEL' : 'EN_ATTENTE';

      await prisma.echeancier.update({
        where: { id: echeancierId },
        data: { montantPaye: nouveauMontantPaye, statut: nouveauStatut }
      });
    }

    // Encaisser dans caisse TOPTELSIG
    const caisse = await prisma.caisse.findFirst({ where: { filiale: 'TOPTELSIG', actif: true } });
    if (caisse) {
      await prisma.$transaction([
        prisma.encaissement.create({
          data: {
            caisseId: caisse.id,
            filiale: 'TOPTELSIG',
            montant: Number(montant),
            typePaiement,
            reference,
            motif: `Paiement foncier souscripteur`,
            entiteRef: req.params.id,
            entiteType: 'souscripteur',
            operateurId: req.user.id,
          }
        }),
        prisma.caisse.update({ where: { id: caisse.id }, data: { solde: { increment: Number(montant) } } })
      ]);
    }

    res.status(201).json(paiement);
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
