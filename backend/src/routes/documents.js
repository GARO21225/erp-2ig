/**
 * ERP 2IG — GED
 * Stockage: PostgreSQL base64 (≤2MB) | STORAGE_PATH disk | CLOUDINARY_URL cloud
 */
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../lib/logger');

const ALLOWED = { 'image/jpeg':'.jpg','image/jpg':'.jpg','image/png':'.png','application/pdf':'.pdf','application/msword':'.doc','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'.docx' };
const TYPES_GED = ['CNI','EXTRAIT_NAISSANCE','DIPLOME','FACTURE','CONTRAT','PLAN','PHOTO','PERMIS','ASSURANCE','JUSTIFICATIF','BULLETIN','AUTRE'];
const MAX_MB = process.env.STORAGE_PATH || process.env.CLOUDINARY_URL ? 15 : 2;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => ALLOWED[file.mimetype] ? cb(null, true) : cb(new Error(`Format non supporté: ${file.mimetype}`)),
});

async function storeFile(buffer, originalname, mimetype) {
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}${ALLOWED[mimetype]||'.bin'}`;
  if (process.env.STORAGE_PATH) {
    const dir = process.env.STORAGE_PATH;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), buffer);
    return { url: `/api/documents/file/${filename}`, size: buffer.length, storage: 'disk' };
  }
  if (process.env.CLOUDINARY_URL) {
    const { v2: cloudinary } = require('cloudinary');
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ resource_type:'auto', folder:'erp-2ig-ged' }, (err,r) => err ? reject(err) : resolve({ url:r.secure_url, size:r.bytes, storage:'cloudinary' }));
      require('stream').Readable.from(buffer).pipe(stream);
    });
  }
  // PostgreSQL base64
  return { url: `data:${mimetype};base64,${buffer.toString('base64')}`, size: buffer.length, storage: 'database' };
}

// Middleware: accepte token en query param pour window.open
const authFlex = (req, res, next) => {
  if (req.query.token && !req.headers.authorization) req.headers.authorization = `Bearer ${req.query.token}`;
  return auth(req, res, next);
};

// POST /upload
router.post('/upload', auth, upload.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const { entiteType, entiteId, type, nom } = req.body;
    if (!entiteType || !entiteId) return res.status(400).json({ error: 'entiteType et entiteId requis' });
    const typeDoc = TYPES_GED.includes(type) ? type : 'AUTRE';
    if (req.file.size > MAX_MB * 1024 * 1024) return res.status(400).json({ error: `Fichier trop grand (max ${MAX_MB}MB)` });
    const stored = await storeFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    const doc = await prisma.document.create({
      data: { nom: nom || req.file.originalname, type: typeDoc, url: stored.url, filiale: req.user.filiale, entiteType, entiteId, taille: stored.size, mimeType: req.file.mimetype, uploadePar: req.user.id }
    });
    logger.info('[GED] Upload', { type: typeDoc, entiteType, size: stored.size, storage: stored.storage });
    res.status(201).json({ ...doc, storage: stored.storage });
  } catch (e) { logger.error('[GED] Upload error', { error: e.message }); res.status(500).json({ error: e.message }); }
});

// GET / — Liste (sans URL base64)
router.get('/', auth, async (req, res) => {
  try {
    const { entiteType, entiteId } = req.query;
    const where = { supprime: false };
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

// GET /file/:filename — Fichier depuis disque
router.get('/file/:filename', authFlex, (req, res) => {
  const dir = process.env.STORAGE_PATH;
  if (!dir) return res.status(404).json({ error: 'Stockage disque non configuré' });
  const filepath = path.join(dir, path.basename(req.params.filename));
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Fichier introuvable' });
  res.sendFile(filepath);
});

// GET /:id — Servir un document (avec token query param pour window.open)
router.get('/:id', authFlex, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc || doc.supprime) return res.status(404).json({ error: 'Document introuvable' });
    if (req.user.filiale !== 'GROUPE' && doc.filiale !== req.user.filiale) return res.status(403).json({ error: 'Accès refusé' });
    if (doc.url.startsWith('data:')) {
      const [header, data] = doc.url.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      const buffer = Buffer.from(data, 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nom)}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }
    if (doc.url.startsWith('/api/documents/file/')) {
      const filename = path.basename(doc.url);
      const filepath = path.join(process.env.STORAGE_PATH || '/tmp', filename);
      if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Fichier introuvable sur disque' });
      return res.sendFile(filepath);
    }
    res.redirect(doc.url);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id — Soft delete
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (req.user.filiale !== 'GROUPE' && doc.filiale !== req.user.filiale) return res.status(403).json({ error: 'Accès refusé' });
    await prisma.document.update({ where: { id: req.params.id }, data: { supprime: true } });
    res.json({ message: 'Document supprimé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
