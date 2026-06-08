/**
 * ERP 2IG — GED (Gestion Électronique de Documents)
 * 
 * Stratégie de stockage (par ordre de priorité) :
 * 1. Cloudinary (si CLOUDINARY_URL configuré) → illimité, CDN mondial
 * 2. Render Persistent Disk (si RENDER_DISK_PATH configuré) → $0.25/GB/mois
 * 3. PostgreSQL base64 (fallback) → fonctionne sans config, limité à 2MB/fichier
 * 
 * Sur Render : ajouter un Persistent Disk (1GB suffit pour démarrer)
 * Dashboard Render → ton service → Disks → Add Disk
 * Mount Path : /data/ged
 * Variable : RENDER_DISK_PATH=/data/ged
 */
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../lib/logger');

const ALLOWED_TYPES = {
  'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};
const TYPES_GED = ['CNI','EXTRAIT_NAISSANCE','DIPLOME','FACTURE','CONTRAT','PLAN','PHOTO','PERMIS','ASSURANCE','JUSTIFICATIF','AUTRE'];
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
    else cb(new Error(`Type non autorisé. Formats acceptés : JPG, PNG, PDF, DOC, DOCX`));
  }
});

// ── Déterminer la méthode de stockage ─────────────────────────────────────
function getStorageMethod() {
  if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) return 'cloudinary';
  if (process.env.RENDER_DISK_PATH) return 'disk';
  return 'database';
}

async function storeFile(buffer, originalname, mimetype) {
  const method = getStorageMethod();
  const ext = ALLOWED_TYPES[mimetype] || path.extname(originalname);
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;

  // === Cloudinary ===
  if (method === 'cloudinary') {
    const cloudinary = require('cloudinary').v2;
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'erp-2ig-ged', public_id: path.parse(filename).name },
        (err, result) => err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id, size: result.bytes, storage: 'cloudinary', filename })
      );
      require('stream').Readable.from(buffer).pipe(stream);
    });
  }

  // === Render Persistent Disk ===
  if (method === 'disk') {
    const diskPath = process.env.RENDER_DISK_PATH;
    fs.mkdirSync(diskPath, { recursive: true });
    const filePath = path.join(diskPath, filename);
    fs.writeFileSync(filePath, buffer);
    const relativeUrl = `/api/documents/files/${filename}`;
    logger.info('[GED] Fichier sauvegardé sur disque persistant', { filename, size: buffer.length });
    return { url: relativeUrl, publicId: filename, size: buffer.length, storage: 'disk', filename };
  }

  // === PostgreSQL base64 (fallback) ===
  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error(`Fichier trop grand (${(buffer.length/1024/1024).toFixed(1)} MB). Sans Cloudinary ou Persistent Disk, maximum 2 MB. Configurer RENDER_DISK_PATH dans Render.`);
  }
  const base64 = `data:${mimetype};base64,${buffer.toString('base64')}`;
  return { url: base64, publicId: null, size: buffer.length, storage: 'database', filename };
}

// ── POST /api/documents/upload ────────────────────────────────────────────
router.post('/upload', auth, upload.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis (max 15 MB)' });
    const { entiteType, entiteId, type, nom } = req.body;
    if (!entiteType || !entiteId) return res.status(400).json({ error: 'entiteType et entiteId requis' });
    const typeDoc = type || 'AUTRE';
    if (!TYPES_GED.includes(typeDoc)) return res.status(400).json({ error: `Type invalide: ${TYPES_GED.join(', ')}` });

    const stored = await storeFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    const doc = await prisma.document.create({
      data: {
        nom: nom || req.file.originalname,
        type: typeDoc,
        url: stored.url,
        filiale: req.user.filiale === 'GROUPE' ? (req.body.filiale || 'GROUPE') : req.user.filiale,
        entiteType,
        entiteId,
        taille: stored.size,
        mimeType: req.file.mimetype,
        uploadePar: req.user.id,
      }
    });

    logger.info('[GED] Upload OK', { type: typeDoc, storage: stored.storage, size: stored.size });
    res.status(201).json({ ...doc, storage: stored.storage, storageMethod: getStorageMethod() });
  } catch (e) {
    logger.error('[GED] Upload error', { error: e.message });
    res.status(500).json({ error: e.message, storageMethod: getStorageMethod() });
  }
});

// ── GET /api/documents/files/:filename — Servir fichiers depuis Persistent Disk
router.get('/files/:filename', auth, (req, res) => {
  const diskPath = process.env.RENDER_DISK_PATH;
  if (!diskPath) return res.status(404).json({ error: 'Stockage disque non configuré' });
  const filePath = path.join(diskPath, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier introuvable' });
  res.sendFile(filePath);
});

// ── GET /api/documents/:id — Récupérer un document
router.get('/:id', auth, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (req.user.filiale !== 'GROUPE' && doc.filiale !== req.user.filiale) return res.status(403).json({ error: 'Accès refusé' });
    // Base64 → retourner le fichier directement
    if (doc.url.startsWith('data:')) {
      const [header, data] = doc.url.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      const buf = Buffer.from(data, 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${doc.nom}"`);
      res.setHeader('Content-Length', buf.length);
      return res.send(buf);
    }
    // Disque → servir le fichier
    if (doc.url.startsWith('/api/documents/files/')) {
      const filename = path.basename(doc.url);
      const diskPath = process.env.RENDER_DISK_PATH;
      if (diskPath) {
        const filePath = path.join(diskPath, filename);
        if (fs.existsSync(filePath)) return res.sendFile(filePath);
      }
    }
    // Cloudinary → rediriger
    res.redirect(doc.url);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/documents — Liste documents par entité
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

// ── DELETE /api/documents/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (req.user.filiale !== 'GROUPE' && doc.filiale !== req.user.filiale) return res.status(403).json({ error: 'Accès refusé' });
    // Supprimer du disque si nécessaire
    if (doc.url.startsWith('/api/documents/files/') && process.env.RENDER_DISK_PATH) {
      const filePath = path.join(process.env.RENDER_DISK_PATH, path.basename(doc.url));
      try { fs.unlinkSync(filePath); } catch {}
    }
    await prisma.document.update({ where: { id: req.params.id }, data: { nom: `[SUPPRIMÉ] ${doc.nom}` } });
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: req.user.filiale, action: 'DELETE', entite: 'Document', entiteId: doc.id, entiteLabel: doc.nom } });
    res.json({ message: 'Document supprimé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/documents/info/storage — Info sur le stockage configuré
router.get('/info/storage', auth, (req, res) => {
  const method = getStorageMethod();
  const info = {
    method,
    configured: method !== 'database',
    maxFileSize: method === 'database' ? '2 MB' : '15 MB',
    instructions: method === 'database'
      ? 'Configurer RENDER_DISK_PATH ou CLOUDINARY_URL pour les fichiers > 2MB'
      : method === 'disk'
        ? `Disque persistant : ${process.env.RENDER_DISK_PATH}`
        : 'Cloudinary configuré',
  };
  res.json(info);
});

module.exports = router;
