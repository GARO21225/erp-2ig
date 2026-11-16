/**
 * Yakro Grill — Vidéos de l'écran boutique : fichiers envoyés, stockés sur le disque du serveur (volume Docker), par restaurant.
 */
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { auth, requireFiliale } = require('../../middleware/auth');
const { resto } = require('../../lib/yakro-resto');
const yakro = requireFiliale('YAKRO_GRILL');

const DIR = process.env.VIDEOS_DIR || '/data/videos';
const MAX_MO = 300;
const EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const dossier = (id) => path.join(DIR, String(id).replace(/[^\w-]/g, ''));
const gere = (req) => ['DG', 'DIRECTEUR', 'MANAGER'].includes(req.user.role) || req.permissions?.has('parametres.gerer');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { const d = dossier(req.restaurantId); fs.mkdir(d, { recursive: true }, (e) => cb(e, d)); },
    // nom lisible conservé + jeton aléatoire (l'adresse du fichier n'est pas devinable)
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(8).toString('hex')}__${path.basename(file.originalname, path.extname(file.originalname)).replace(/[^\w\- ]/g, '').slice(0, 60) || 'video'}${EXT[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_MO * 1024 * 1024 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(new Error('Format non accepté : envoyez une vidéo MP4, WebM ou MOV'))),
});

const lister = async (restaurantId) => {
  const d = dossier(restaurantId);
  const noms = await fs.promises.readdir(d).catch(() => []);
  const l = await Promise.all(noms.map(async (f) => { const s = await fs.promises.stat(path.join(d, f)); return { fichier: f, nom: f.split('__').slice(1).join('__') || f, taille: s.size, at: s.mtime, url: `/yakro/ecran/videos/${restaurantId}/${encodeURIComponent(f)}` }; }));
  return l.sort((a, b) => a.at - b.at);
};

router.get('/videos', auth, yakro, resto, async (req, res) => {
  try { res.json(req.restaurantId ? await lister(req.restaurantId) : []); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/videos', auth, yakro, resto, (req, res) => {
  if (!gere(req)) return res.status(403).json({ error: "Vous n'avez pas le droit d'ajouter une vidéo" });
  upload.single('video')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `Vidéo trop lourde (maximum ${MAX_MO} Mo)` : err.message });
    if (!req.file) return res.status(400).json({ error: 'Aucune vidéo reçue' });
    res.status(201).json(await lister(req.restaurantId));
  });
});

router.delete('/videos/:fichier', auth, yakro, resto, async (req, res) => {
  try {
    if (!gere(req)) return res.status(403).json({ error: "Vous n'avez pas le droit de supprimer une vidéo" });
    await fs.promises.unlink(path.join(dossier(req.restaurantId), path.basename(req.params.fichier))).catch(() => {});
    res.json(await lister(req.restaurantId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Lecture (balise <video> : pas d'en-tête d'authentification possible → adresse non devinable). Gère la lecture par morceaux (Range).
router.get('/videos/:restaurantId/:fichier', (req, res) => {
  res.sendFile(path.basename(req.params.fichier), { root: dossier(req.params.restaurantId), maxAge: '7d' }, (e) => { if (e && !res.headersSent) res.status(404).end(); });
});

module.exports = router;
