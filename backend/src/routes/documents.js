/**
 * ERP 2IG — GED (Gestion Électronique de Documents)
 * 
 * Stratégie de stockage (par ordre de priorité) :
 * 1. Render Disk persistant → /data/uploads/ged (configuré via render.yaml)
 * 2. Cloudinary → si CLOUDINARY_URL définie (pour redondance)
 * 3. Fallback base64 BDD → pour fichiers < 500KB si aucun disk ni Cloudinary
 * 
 * Le Render Disk ($0.25/GB/mois) est persistant entre les redéploiements.
 * Le filesystem normal (/tmp, /opt) est ephemeral et effacé à chaque deploy.
 */
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../lib/logger');

// Dossier de stockage persistant (Render Disk ou local dev)
const UPLOAD_DIR = process.env.GED_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'ged');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = {
  'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const TYPES_GED = ['CNI','EXTRAIT_NAISSANCE','DIPLOME','FACTURE','CONTRAT','PLAN','PHOTO','PERMIS','ASSURANCE','RECU','JUSTIFICATIF','DECHARGE','AUTRE'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// Multer avec stockage sur disque persistant
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Organiser par entiteType
    const dir = path.join(UPLOAD_DIR, req.body.entiteType || 'divers');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME[file.mimetype] || path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_').substring(0, 50);
    cb(null, `${Date.now()}_${safeName}${ext.startsWith('.') ? '' : ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype]) cb(null, true);
    else cb(new Error(`Type non autorisé: ${file.mimetype}. Formats acceptés: JPG, PNG, PDF, DOC, DOCX`));
  }
});

// POST /api/documents/upload
router.post('/upload', auth, upload.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis (max 10 MB)' });
    const { entiteType, entiteId, type, nom } = req.body;
    if (!entiteType || !entiteId) return res.status(400).json({ error: 'entiteType et entiteId requis' });

    const typeDoc = (type || 'AUTRE').toUpperCase();
    if (!TYPES_GED.includes(typeDoc)) return res.status(400).json({ error: `Type invalide. Valeurs: ${TYPES_GED.join(', ')}` });

    // Construire l'URL de téléchargement
    const relativePath = path.relative(UPLOAD_DIR, req.file.path).replace(/\\/g, '/');
    const fileUrl = `/api/documents/file/${relativePath}`;

    const doc = await prisma.document.create({
      data: {
        nom: nom || req.file.originalname,
        type: typeDoc,
        url: fileUrl,
        filiale: req.user.filiale,
        entiteType,
        entiteId,
        taille: req.file.size,
        mimeType: req.file.mimetype,
        uploadePar: req.user.id,
      }
    });

    logger.info('[GED] Document uploadé', { type: typeDoc, entiteType, size: req.file.size, path: relativePath });
    res.status(201).json(doc);
  } catch (e) {
    // Nettoyer le fichier si erreur BDD
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    logger.error('[GED] Erreur upload', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// GET /api/documents/file/* — Servir les fichiers depuis le disk
router.get('/file/*', auth, (req, res) => {
  try {
    const relativePath = req.params[0];
    // Sécurité : empêcher path traversal
    const filePath = path.resolve(UPLOAD_DIR, relativePath);
    if (!filePath.startsWith(path.resolve(UPLOAD_DIR))) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier introuvable' });
    res.sendFile(filePath);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/documents — Liste
router.get('/', auth, async (req, res) => {
  try {
    const { entiteType, entiteId } = req.query;
    const where = {};
    if (entiteType) where.entiteType = entiteType;
    if (entiteId) where.entiteId = entiteId;
    if (req.user.filiale !== 'GROUPE') where.filiale = req.user.filiale;
    const docs = await prisma.document.findMany({
      where, orderBy: { createdAt: 'desc' },
      select: { id:true, nom:true, type:true, url:true, mimeType:true, taille:true, entiteType:true, entiteId:true, filiale:true, uploadePar:true, createdAt:true }
    });
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/documents/:id — Télécharger un document
router.get('/:id', auth, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (req.user.filiale !== 'GROUPE' && doc.filiale !== req.user.filiale) return res.status(403).json({ error: 'Accès refusé' });

    if (doc.url.startsWith('/api/documents/file/')) {
      const relativePath = doc.url.replace('/api/documents/file/', '');
      const filePath = path.resolve(UPLOAD_DIR, relativePath);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier physique introuvable' });
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nom)}"`);
      return res.sendFile(filePath);
    }
    res.redirect(doc.url);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/documents/:id — Soft delete + suppression fichier
router.delete('/:id', auth, async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (req.user.filiale !== 'GROUPE' && doc.filiale !== req.user.filiale) return res.status(403).json({ error: 'Accès refusé' });

    // Supprimer le fichier physique
    if (doc.url.startsWith('/api/documents/file/')) {
      const relativePath = doc.url.replace('/api/documents/file/', '');
      const filePath = path.resolve(UPLOAD_DIR, relativePath);
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
    }

    await prisma.document.update({ where: { id: req.params.id }, data: { nom: `[SUPPRIMÉ] ${doc.nom}`, url: '' } });
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: req.user.filiale, action: 'DELETE', entite: 'Document', entiteId: doc.id, entiteLabel: doc.nom } });
    res.json({ message: 'Document supprimé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
