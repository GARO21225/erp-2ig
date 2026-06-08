/**
 * ERP 2IG — GED (Gestion Électronique de Documents)
 * Upload vers Cloudinary ou stockage local si non configuré
 */
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const logger = require('../lib/logger');

const ALLOWED_TYPES = ['image/jpeg','image/png','image/jpg','application/pdf',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Type non autorisé: ${file.mimetype}. Formats acceptés: JPG, PNG, PDF, DOC, DOCX`));
  }
});

// Upload vers Cloudinary (si configuré) sinon base64 en BDD
async function uploadFile(buffer, originalname, mimetype) {
  if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
    const cloudinary = require('cloudinary').v2;
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'erp-2ig', public_id: `${Date.now()}_${path.parse(originalname).name}` },
        (err, result) => { if (err) reject(err); else resolve({ url: result.secure_url, publicId: result.public_id, size: result.bytes }); }
      );
      const { Readable } = require('stream');
      Readable.from(buffer).pipe(stream);
    });
  }
  // Fallback: stocker URL data (pour démo sans Cloudinary)
  // En production TOUJOURS configurer Cloudinary
  const base64 = `data:${mimetype};base64,${buffer.toString('base64')}`;
  return { url: base64, publicId: null, size: buffer.length };
}

// POST /api/documents/upload — Upload un document
router.post('/upload', auth, upload.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis (max 10 MB, formats: JPG, PNG, PDF, DOC)' });
    const { entiteType, entiteId, type, nom } = req.body;
    if (!entiteType || !entiteId || !type) return res.status(400).json({ error: 'entiteType, entiteId, type requis' });

    const TYPES_VALIDES = ['CNI','EXTRAIT_NAISSANCE','DIPLOME','FACTURE','CONTRAT','PLAN','PHOTO','AUTRE'];
    if (!TYPES_VALIDES.includes(type)) return res.status(400).json({ error: `Type invalide. Valeurs: ${TYPES_VALIDES.join(', ')}` });

    const uploaded = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    const doc = await prisma.document.create({
      data: {
        nom: nom || req.file.originalname,
        type,
        url: uploaded.url,
        filiale: req.user.filiale,
        entiteType,
        entiteId,
        taille: uploaded.size,
        mimeType: req.file.mimetype,
        uploadePar: req.user.id,
      }
    });
    logger.info('[GED] Document uploadé', { type, entiteType, entiteId, size: uploaded.size });
    res.status(201).json(doc);
  } catch (e) {
    logger.error('[GED] Erreur upload', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// GET /api/documents — Liste documents par entité
router.get('/', auth, async (req, res) => {
  try {
    const { entiteType, entiteId, filiale } = req.query;
    const where = {};
    if (entiteType) where.entiteType = entiteType;
    if (entiteId) where.entiteId = entiteId;
    if (filiale) where.filiale = filiale;
    // Restriction filiale
    if (req.user.filiale !== 'GROUPE') where.filiale = req.user.filiale;
    const docs = await prisma.document.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/documents/:id — Soft delete
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (req.user.filiale !== 'GROUPE' && doc.filiale !== req.user.filiale) return res.status(403).json({ error: 'Accès refusé' });
    // Soft delete via renommage URL
    await prisma.document.update({ where: { id: req.params.id }, data: { nom: `[SUPPRIMÉ] ${doc.nom}` } });
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: req.user.filiale, action: 'DELETE', entite: 'Document', entiteId: doc.id, entiteLabel: doc.nom } });
    res.json({ message: 'Document supprimé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
