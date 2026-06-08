const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const liya = requireFiliale('LIYA');

router.get('/', auth, liya, async (req, res) => {
  try {
    const motos = await prisma.moto.findMany({
      orderBy: { immatriculation: 'asc' },
      include: {
        livraisons: { where: { statut: 'EN_ROUTE' }, take: 1, include: { chauffeur: true } },
        maintenances: { where: { statut: 'EN_COURS' }, take: 1 },
        pleins: { orderBy: { date: 'desc' }, take: 1 }
      }
    });
    res.json(motos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, liya, async (req, res) => {
  try {
    const moto = await prisma.moto.create({ data: req.body });
    res.status(201).json(moto);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', auth, liya, async (req, res) => {
  try {
    const moto = await prisma.moto.update({ where: { id: req.params.id }, data: req.body });
    res.json(moto);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Maintenance
router.post('/:id/maintenances', auth, liya, async (req, res) => {
  try {
    const m = await prisma.maintenanceMoto.create({
      data: { ...req.body, motoId: req.params.id, cout: Number(req.body.cout || 0) }
    });
    if (req.body.statut === 'EN_COURS') {
      await prisma.moto.update({ where: { id: req.params.id }, data: { statut: 'MAINTENANCE' } });
    }
    res.status(201).json(m);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/maintenances/:mid', auth, liya, async (req, res) => {
  try {
    const m = await prisma.maintenanceMoto.update({
      where: { id: req.params.mid },
      data: req.body
    });
    if (req.body.statut === 'TERMINE') {
      await prisma.moto.update({ where: { id: req.params.id }, data: { statut: 'DISPONIBLE' } });
    }
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Carburant
router.post('/:id/pleins', auth, liya, async (req, res) => {
  try {
    const plein = await prisma.pleinCarburant.create({
      data: { ...req.body, motoId: req.params.id, litres: Number(req.body.litres), montant: Number(req.body.montant) }
    });
    await prisma.moto.update({
      where: { id: req.params.id },
      data: { kilometrage: Number(req.body.kilometrage), dernierePlein: new Date() }
    });

    // Décaisser carburant
    const caisse = await prisma.caisse.findFirst({ where: { filiale: 'LIYA', actif: true } });
    if (caisse) {
      await prisma.$transaction([
        prisma.decaissement.create({
          data: {
            caisseId: caisse.id, filiale: 'LIYA',
            montant: Number(req.body.montant),
            typePaiement: 'ESPECES',
            motif: `Carburant moto ${req.params.id}`,
            categorie: 'CARBURANT', valide: true, validePar: req.user.id,
          }
        }),
        prisma.caisse.update({ where: { id: caisse.id }, data: { solde: { decrement: Number(req.body.montant) } } })
      ]);
    }

    res.status(201).json(plein);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/historique', auth, liya, async (req, res) => {
  try {
    const [maintenances, pleins, livraisons] = await Promise.all([
      prisma.maintenanceMoto.findMany({ where: { motoId: req.params.id }, orderBy: { date: 'desc' } }),
      prisma.pleinCarburant.findMany({ where: { motoId: req.params.id }, orderBy: { date: 'desc' } }),
      prisma.livraison.findMany({
        where: { motoId: req.params.id }, orderBy: { createdAt: 'desc' }, take: 20,
        select: { numero: true, statut: true, clientNom: true, createdAt: true, montant: true }
      }),
    ]);
    res.json({ maintenances, pleins, livraisons });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

// GET /template — Template Excel motos
router.get('/template', auth, liya, (_, res) => {
  const headers = ['immatriculation','marque','modele','annee','kilometrage','dateExpirationAssurance','dateVisiteTechnique'];
  const example = [['AB1234CI','Honda','CB125F',2023,5000,'2027-06-01','2026-12-01']];
  res.setHeader('Content-Disposition', 'attachment; filename="template_motos.csv"');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + [headers, ...example].map(r => r.join(';')).join('\r\n'));
});

// POST /import — Import Excel/CSV motos
const multerM = require('multer');
const uploadM = multerM({ storage: multerM.memoryStorage(), limits: { fileSize: 5*1024*1024 } });
router.post('/import', auth, liya, uploadM.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const xlsx = require('xlsx');
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const errors = [], created = [];
    for (const [i, row] of rows.entries()) {
      if (!row.immatriculation || !row.marque) { errors.push(`Ligne ${i+2}: immatriculation et marque requis`); continue; }
      try {
        const m = await prisma.moto.create({ data: {
          immatriculation: String(row.immatriculation).toUpperCase(),
          marque: String(row.marque), modele: row.modele || null,
          annee: row.annee ? Number(row.annee) : null,
          kilometrage: row.kilometrage ? Number(row.kilometrage) : 0,
          dateExpirationAssurance: row.dateExpirationAssurance ? new Date(row.dateExpirationAssurance) : null,
          dateVisiteTechnique: row.dateVisiteTechnique ? new Date(row.dateVisiteTechnique) : null,
        }});
        created.push(m.id);
      } catch(e) { errors.push(`Ligne ${i+2}: ${e.message}`); }
    }
    res.json({ imported: created.length, errors, total: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /export — Export Excel motos
router.get('/export', auth, liya, async (req, res) => {
  try {
    const motos = await prisma.moto.findMany({ orderBy: { createdAt: 'desc' } });
    const xlsx = require('xlsx');
    const data = motos.map(m => ({
      Immatriculation: m.immatriculation, Marque: m.marque, Modèle: m.modele || '',
      Année: m.annee || '', Kilométrage: m.kilometrage, Statut: m.statut,
      'Assurance expire': m.dateExpirationAssurance ? new Date(m.dateExpirationAssurance).toLocaleDateString('fr') : '',
      'Visite expire': m.dateVisiteTechnique ? new Date(m.dateVisiteTechnique).toLocaleDateString('fr') : '',
    }));
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Motos');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="motos_liya.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
