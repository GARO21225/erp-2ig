// ── LOTS ──────────────────────────────
const router = require('express').Router();
const safe = async (fn) => { try { return await fn(); } catch { return null; } };
const prisma = require('../../lib/prisma');
const { auth, requireFiliale, requireRole } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

router.get('/', auth, toptelsig, async (req, res) => {
  try {
    const { projetId, statut } = req.query;
    const where = {};
    if (projetId) where.projetId = projetId;
    if (statut) where.statut = statut;

    const lots = await prisma.lot.findMany({
      where,
      orderBy: [{ ilot: 'asc' }, { numero: 'asc' }],
      include: {
        projet: { select: { nom: true, code: true } },
        vente: { include: { souscripteur: { select: { nom: true, prenom: true, telephone: true } } } },
        reservations: { where: { statut: 'ACTIVE' }, include: { souscripteur: true }, take: 1 }
      }
    });
    res.json(lots);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, toptelsig, async (req, res) => {
  try {
    const { projetId, numero, superficie, prix, ilot, statut, latitude, longitude } = req.body;
    if (!projetId || !numero) return res.status(400).json({ error: 'projetId et numero requis' });
    const lot = await prisma.lot.create({
      data: {
        projetId, numero: String(numero),
        superficie: Number(superficie || 0),
        prix: Number(prix || 0),
        ilot: ilot || null,
        statut: statut || 'DISPONIBLE',
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      }
    });
    res.status(201).json(lot);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: `Le lot ${req.body.numero} existe déjà sur ce projet` });
    res.status(500).json({ error: e.message });
  }
});

// Créer plusieurs lots d'un coup
router.post('/batch', auth, toptelsig, async (req, res) => {
  try {
    const { lots } = req.body;
    const result = await prisma.lot.createMany({ data: lots, skipDuplicates: true });
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', auth, toptelsig, async (req, res) => {
  try {
    const { numero, superficie, prix, ilot, statut, latitude, longitude } = req.body;
    const data = {};
    if (numero !== undefined) data.numero = String(numero);
    if (superficie !== undefined) data.superficie = Number(superficie || 0);
    if (prix !== undefined) data.prix = Number(prix || 0);
    if (ilot !== undefined) data.ilot = ilot || null;
    if (statut !== undefined) data.statut = statut;
    if (latitude !== undefined) data.latitude = latitude ? Number(latitude) : null;
    if (longitude !== undefined) data.longitude = longitude ? Number(longitude) : null;
    const lot = await prisma.lot.update({ where: { id: req.params.id }, data });
    res.json(lot);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ── Import Excel lots ─────────────────────────────────────────────────────────
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Format non supporté. Utiliser .xlsx, .xls ou .csv'));
  }
});

// GET /api/toptelsig/lots/template — Télécharger le template Excel
router.get('/template', auth, toptelsig, (req, res) => {
  const { projetId } = req.query;
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['numero *', 'superficie *', 'prix *', 'ilot', 'latitude', 'longitude'],
    ['A-001', 200, 3500000, 'ILOT-A', 6.8276, -5.2893],
    ['A-002', 180, 3200000, 'ILOT-A', '', ''],
  ]);
  ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Lots');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="template_lots_2ig.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// POST /api/toptelsig/lots/import — Import fichier Excel
router.post('/import', auth, toptelsig, upload.single('fichier'), async (req, res) => {
  try {
    const { projetId } = req.body;
    if (!projetId) return res.status(400).json({ error: 'projetId requis' });
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rows.length < 2) return res.status(400).json({ error: 'Fichier vide ou sans données' });

    const headers = rows[0].map(h => String(h).toLowerCase().trim().replace(' *', ''));
    const dataRows = rows.slice(1).filter(r => r.some(c => c !== ''));

    if (dataRows.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 lots par import. Découper en plusieurs fichiers.' });
    }

    // Vérifier colonnes obligatoires
    const required = ['numero', 'superficie', 'prix'];
    const missing = required.filter(c => !headers.includes(c));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Colonnes manquantes : ${missing.join(', ')}` });
    }

    const idx = {};
    headers.forEach((h, i) => { idx[h] = i; });

    const resultats = { importes: 0, erreurs: [], doublon: 0 };
    const lots = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const lineNum = i + 2;
      const numero = String(row[idx['numero']] || '').trim();
      const superficie = Number(row[idx['superficie']]);
      const prix = Number(row[idx['prix']]);

      // Validations
      if (!numero) { resultats.erreurs.push(`Ligne ${lineNum} : numéro manquant`); continue; }
      if (!superficie || superficie <= 0) { resultats.erreurs.push(`Ligne ${lineNum} (${numero}) : superficie invalide`); continue; }
      if (!prix || prix <= 0) { resultats.erreurs.push(`Ligne ${lineNum} (${numero}) : prix invalide`); continue; }

      // Vérifier doublon dans le fichier
      if (lots.find(l => l.numero === numero)) {
        resultats.erreurs.push(`Ligne ${lineNum} : doublon numéro "${numero}" dans le fichier`);
        continue;
      }

      // Vérifier doublon en base
      const existing = await prisma.lot.findUnique({ where: { projetId_numero: { projetId, numero } } });
      if (existing) { resultats.doublon++; resultats.erreurs.push(`Ligne ${lineNum} (${numero}) : lot déjà existant`); continue; }

      lots.push({
        projetId, numero, superficie,
        prix,
        ilot: row[idx['ilot']] ? String(row[idx['ilot']]).trim() : null,
        latitude: row[idx['latitude']] ? Number(row[idx['latitude']]) : null,
        longitude: row[idx['longitude']] ? Number(row[idx['longitude']]) : null,
      });
    }

    // Insérer les lots valides
    if (lots.length > 0) {
      await prisma.lot.createMany({ data: lots, skipDuplicates: true });
      resultats.importes = lots.length;
    }

    res.json({
      message: `${resultats.importes} lot(s) importé(s) sur ${dataRows.length} ligne(s)`,
      ...resultats
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


router.put('/:id/statut', auth, toptelsig, async (req, res) => {
  try {
    const { statut, motif } = req.body;
    const statuts = ['DISPONIBLE', 'RESERVE', 'VENDU', 'LITIGE', 'ANNULE'];
    if (!statuts.includes(statut)) return res.status(400).json({ error: `Statut invalide. Valeurs: ${statuts.join(', ')}` });
    if (['LITIGE', 'ANNULE'].includes(statut) && !motif) return res.status(400).json({ error: 'Motif obligatoire pour LITIGE ou ANNULE' });

    const lot = await prisma.lot.findUnique({ where: { id: req.params.id } });
    if (!lot) return res.status(404).json({ error: 'Lot introuvable' });
    if (lot.statut === 'VENDU' && statut === 'DISPONIBLE') {
      // Vérifier qu'aucune vente active n'existe
      const venteActive = await prisma.venteFoncier.findFirst({ where: { lotId: req.params.id, statut: { notIn: ['ANNULEE'] } } });
      if (venteActive) return res.status(400).json({ error: 'Lot vendu — annuler la vente avant de le remettre disponible' });
    }

    const updated = await prisma.lot.update({ where: { id: req.params.id }, data: { statut } });
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'UPDATE', entite: 'Lot', entiteId: lot.id, entiteLabel: `Lot ${lot.numero} → ${statut}${motif ? ': ' + motif : ''}`, avant: { statut: lot.statut }, apres: { statut, motif } } });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:projetId/disponibles — Lots disponibles pour vente
router.get('/disponibles/:projetId', auth, toptelsig, async (req, res) => {
  try {
    const lots = await prisma.lot.findMany({
      where: { projetId: req.params.projetId, statut: 'DISPONIBLE' },
      orderBy: [{ ilot: 'asc' }, { numero: 'asc' }]
    });
    res.json(lots);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id — Modifier un lot
router.put('/:id', auth, toptelsig, async (req, res) => {
  try {
    const { numero, superficie, prix, ilot, statut } = req.body;
    const lot = await prisma.lot.findUnique({ where: { id: req.params.id } });
    if (!lot) return res.status(404).json({ error: 'Lot introuvable' });
    if (lot.statut === 'VENDU' && statut !== 'VENDU') {
      const venteActive = await prisma.venteFoncier.findFirst({ where: { lotId: req.params.id, statut: { notIn: ['ANNULEE'] } } });
      if (venteActive) return res.status(400).json({ error: 'Lot vendu — impossible de modifier sans annuler la vente' });
    }
    const updated = await prisma.lot.update({
      where: { id: req.params.id },
      data: { ...(numero && { numero }), ...(superficie && { superficie: Number(superficie) }), ...(prix && { prix: Number(prix) }), ...(ilot !== undefined && { ilot }), ...(statut && { statut }) }
    });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id — Supprimer un lot
router.delete('/:id', auth, requireRole('DG', 'DIRECTEUR', 'RESP_FONCIER'), async (req, res) => {
  try {
    const lot = await prisma.lot.findUnique({ where: { id: req.params.id } });
    if (!lot) return res.status(404).json({ error: 'Lot introuvable' });
    if (lot.statut === 'VENDU') return res.status(400).json({ error: 'Lot vendu — suppression impossible' });
    const venteExist = await prisma.venteFoncier.findFirst({ where: { lotId: req.params.id } });
    if (venteExist) return res.status(400).json({ error: 'Lot lié à une vente — suppression impossible' });
    await prisma.lot.delete({ where: { id: req.params.id } });
    res.json({ message: 'Lot supprimé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /projet/:projetId — Tous les lots d'un projet
router.get('/projet/:projetId', auth, toptelsig, async (req, res) => {
  try {
    const lots = await prisma.lot.findMany({
      where: { projetId: req.params.projetId },
      orderBy: [{ ilot: 'asc' }, { numero: 'asc' }]
    });
    res.json(lots);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
