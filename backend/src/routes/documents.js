/**
 * ERP 2IG — GED (Gestion Électronique de Documents)
 * Stockage : BDD PostgreSQL (base64) pour fichiers < 2MB
 *            Cloudinary pour fichiers > 2MB (si configuré)
 * 
 * Pourquoi pas le disque Render ?
 * Render Free = ephemeral filesystem → fichiers perdus à chaque déploiement
 * PostgreSQL Render = persistant → c'est le bon endroit pour stocker les docs
 */
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const logger = require('../lib/logger');

const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const TYPES_GED = ['CNI','EXTRAIT_NAISSANCE','DIPLOME','FACTURE','CONTRAT','PLAN','PHOTO','PERMIS','ASSURANCE','AUTRE'];

const MAX_SIZE_BDD = 2 * 1024 * 1024;   // 2 MB → stocké en BDD
const MAX_SIZE_CLOUD = 10 * 1024 * 1024; // 10 MB → nécessite Cloudinary

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_CLOUD },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
    else cb(new Error(`Type non autorisé: ${file.mimetype}. Formats: JPG, PNG, PDF, DOC, DOCX`));
  }
});

async function storeFile(buffer, originalname, mimetype) {
  const isCloudinaryConfigured = !!(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);
  
  if (isCloudinaryConfigured && buffer.length > MAX_SIZE_BDD) {
    // Upload vers Cloudinary pour les gros fichiers
    const { v2: cloudinary } = require('cloudinary');
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'erp-2ig-ged' },
        (err, result) => err ? reject(err) : resolve({
          url: result.secure_url, publicId: result.public_id,
          size: result.bytes, storage: 'cloudinary'
        })
      );
      require('stream').Readable.from(buffer).pipe(stream);
    });
  }
  
  // Stocker en base64 dans PostgreSQL (fichiers ≤ 2MB ou Cloudinary non configuré)
  // C'est parfaitement valide — PostgreSQL sur Render est persistent
  const base64 = `data:${mimetype};base64,${buffer.toString('base64')}`;
  logger.info('[GED] Stockage en BDD', { size: buffer.length, storage: 'postgresql' });
  return { url: base64, publicId: null, size: buffer.length, storage: 'postgresql' };
}

// POST /api/documents/upload
router.post('/upload', auth, upload.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const { entiteType, entiteId, type, nom } = req.body;
    if (!entiteType || !entiteId) return res.status(400).json({ error: 'entiteType et entiteId requis' });
    
    const typeDoc = type || 'AUTRE';
    if (!TYPES_GED.includes(typeDoc)) return res.status(400).json({ error: `Type invalide. Valeurs: ${TYPES_GED.join(', ')}` });

    const isCloudinaryConfigured = !!(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);
    if (req.file.size > MAX_SIZE_BDD && !isCloudinaryConfigured) {
      return res.status(400).json({ 
        error: `Fichier trop grand (${(req.file.size/1024/1024).toFixed(1)} MB). Maximum 2 MB sans Cloudinary. Configurer CLOUDINARY_URL dans Render pour les fichiers > 2MB.`
      });
    }

    const stored = await storeFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    
    const doc = await prisma.document.create({
      data: {
        nom: nom || req.file.originalname,
        type: typeDoc,
        url: stored.url,
        filiale: req.user.filiale,
        entiteType,
        entiteId,
        taille: stored.size,
        mimeType: req.file.mimetype,
        uploadePar: req.user.id,
      }
    });

    logger.info('[GED] Document uploadé', { type: typeDoc, entiteType, size: stored.size, storage: stored.storage });
    res.status(201).json({ ...doc, storage: stored.storage });
  } catch (e) {
    logger.error('[GED] Erreur upload', { error: e.message });
    res.status(500).json({ error: e.message });
  }
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
      where,
      orderBy: { createdAt: 'desc' },
      // Ne pas retourner l'URL base64 dans la liste (trop lourd)
      select: { id: true, nom: true, type: true, mimeType: true, taille: true, entiteType: true, entiteId: true, filiale: true, uploadePar: true, createdAt: true }
    });
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/documents/:id — Récupérer un document (avec l'URL/base64)
router.get('/:id', auth, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (req.user.filiale !== 'GROUPE' && doc.filiale !== req.user.filiale) return res.status(403).json({ error: 'Accès refusé' });
    
    // Si base64, retourner directement le fichier
    if (doc.url.startsWith('data:')) {
      const [header, data] = doc.url.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      const buffer = Buffer.from(data, 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${doc.nom}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }
    // Sinon rediriger vers l'URL Cloudinary
    res.redirect(doc.url);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/documents/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (req.user.filiale !== 'GROUPE' && doc.filiale !== req.user.filiale) return res.status(403).json({ error: 'Accès refusé' });
    await prisma.document.update({ where: { id: req.params.id }, data: { nom: `[SUPPRIMÉ] ${doc.nom}` } });
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: req.user.filiale, action: 'DELETE', entite: 'Document', entiteId: doc.id, entiteLabel: doc.nom } });
    res.json({ message: 'Document supprimé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
