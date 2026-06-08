/**
 * ERP 2IG — GED (Gestion Électronique de Documents)
 * 
 * Stratégie de stockage (par ordre de priorité) :
 * 1. Render Disk (STORAGE_PATH défini) → disque persistant Render Individual+ 
 * 2. Cloudinary (CLOUDINARY_URL défini) → cloud externe, fichiers volumineux
 * 3. PostgreSQL base64 (défaut) → persistant, fichiers ≤ 2MB, sans coût additionnel
 *
 * Configuration Render :
 * - Plan Individual ($25/mois) → ajouter un Disk de 10GB → STORAGE_PATH=/data/ged
 * - Plan Free → stockage PostgreSQL base64 automatique (≤2MB par fichier)
 */
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../lib/logger');

const ALLOWED_TYPES = {
  'image/jpeg':'.jpg','image/jpg':'.jpg','image/png':'.png',
  'application/pdf':'.pdf',
  'application/msword':'.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'.docx',
};
const TYPES_GED = ['CNI','EXTRAIT_NAISSANCE','DIPLOME','FACTURE','CONTRAT','PLAN','PHOTO','PERMIS','ASSURANCE','JUSTIFICATIF','AUTRE'];
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
    else cb(new Error(`Type non autorisé: ${file.mimetype}. Formats: JPG, PNG, PDF, DOC, DOCX`));
  }
});

// Détecter le mode de stockage
function getStorageMode() {
  if (process.env.STORAGE_PATH) return 'disk';      // Render Disk persistant
  if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) return 'cloudinary';
  return 'database'; // Défaut : PostgreSQL base64
}

async function storeFile(buffer, originalname, mimetype) {
  const mode = getStorageMode();
  const ext = ALLOWED_TYPES[mimetype] || '.bin';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;

  if (mode === 'disk') {
    const dir = process.env.STORAGE_PATH;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer);
    logger.info('[GED] Stockage disque Render', { filename, size: buffer.length });
    return { url: `/api/documents/file/${filename}`, publicId: filename, size: buffer.length, storage: 'disk' };
  }

  if (mode === 'cloudinary') {
    const { v2: cloudinary } = require('cloudinary');
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'erp-2ig-ged' },
        (err, result) => err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id, size: result.bytes, storage: 'cloudinary' })
      );
      require('stream').Readable.from(buffer).pipe(stream);
    });
  }

  // Mode database : base64 dans PostgreSQL
  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error(`Fichier trop grand pour le stockage BDD (${(buffer.length/1024/1024).toFixed(1)} MB > 2 MB). Pour les fichiers plus lourds, configurer STORAGE_PATH (Render Disk) ou CLOUDINARY_URL.`);
  }
  const base64 = `data:${mimetype};base64,${buffer.toString('base64')}`;
  logger.info('[GED] Stockage PostgreSQL base64', { size: buffer.length });
  return { url: base64, publicId: null, size: buffer.length, storage: 'database' };
}

// POST /api/documents/upload
router.post('/upload', auth, upload.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const { entiteType, entiteId, type, nom } = req.body;
    if (!entiteType || !entiteId) return res.status(400).json({ error: 'entiteType et entiteId requis' });
    const typeDoc = type || 'AUTRE';
    if (!TYPES_GED.includes(typeDoc)) return res.status(400).json({ error: `Type invalide. Valeurs: ${TYPES_GED.join(', ')}` });

    const stored = await storeFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    const doc = await prisma.document.create({
      data: { nom: nom || req.file.originalname, type: typeDoc, url: stored.url, filiale: req.user.filiale, entiteType, entiteId, taille: stored.size, mimeType: req.file.mimetype, uploadePar: req.user.id }
    });
    res.status(201).json({ ...doc, storage: stored.storage });
  } catch (e) {
    logger.error('[GED] Erreur upload', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// GET /api/documents/file/:filename — Servir fichiers depuis le disque Render
router.get('/file/:filename', auth, (req, res) => {
  const dir = process.env.STORAGE_PATH;
  if (!dir) return res.status(404).json({ error: 'Stockage disque non configuré' });
  const filename = path.basename(req.params.filename); // sécurité : pas de traversal
  const filepath = path.join(dir, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Fichier introuvable' });
  res.sendFile(filepath);
});

// GET /api/documents
router.get('/', auth, async (req, res) => {
  try {
    const { entiteType, entiteId } = req.query;
    const where = {};
    if (entiteType) where.entiteType = entiteType;
    if (entiteId) where.entiteId = entiteId;
    if (req.user.filiale !== 'GROUPE') where.filiale = req.user.filiale;
    const docs = await prisma.document.findMany({
      where, orderBy: { createdAt: 'desc' },
      select: { id:true, nom:true, type:true, mimeType:true, taille:true, entiteType:true, entiteId:true, filiale:true, uploadePar:true, createdAt:true }
    });
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/documents/:id — Récupérer et servir un document
router.get('/:id', auth, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (req.user.filiale !== 'GROUPE' && doc.filiale !== req.user.filiale) return res.status(403).json({ error: 'Accès refusé' });

    if (doc.url.startsWith('data:')) {
      const [header, data] = doc.url.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      const buffer = Buffer.from(data, 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${doc.nom}"`);
      return res.send(buffer);
    }
    if (doc.url.startsWith('/api/documents/file/')) {
      const filename = path.basename(doc.url);
      const filepath = path.join(process.env.STORAGE_PATH || '/tmp', filename);
      if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Fichier introuvable sur disque' });
      return res.sendFile(filepath);
    }
    res.redirect(doc.url); // Cloudinary URL
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/documents/info/storage — Info sur le mode de stockage actuel
router.get('/info/storage', auth, (req, res) => {
  const mode = getStorageMode();
  res.json({
    mode,
    maxSize: mode === 'database' ? '2 MB' : '15 MB',
    description: {
      disk: 'Render Disk persistant (STORAGE_PATH configuré)',
      cloudinary: 'Cloudinary cloud (CLOUDINARY_URL configuré)',
      database: 'PostgreSQL base64 (défaut gratuit, ≤ 2 MB par fichier)'
    }[mode]
  });
});

// DELETE /api/documents/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (req.user.filiale !== 'GROUPE' && doc.filiale !== req.user.filiale) return res.status(403).json({ error: 'Accès refusé' });
    if (doc.url.startsWith('/api/documents/file/')) {
      const filepath = path.join(process.env.STORAGE_PATH || '/tmp', path.basename(doc.url));
      try { fs.unlinkSync(filepath); } catch {}
    }
    await prisma.document.update({ where: { id: req.params.id }, data: { nom: `[SUPPRIMÉ] ${doc.nom}` } });
    res.json({ message: 'Document supprimé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
