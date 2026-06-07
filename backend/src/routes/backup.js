/**
 * ERP 2IG — API de gestion des sauvegardes
 * Accessible uniquement DG
 */
const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { backupPostgres, getBackupReport, verifyBackup, CONFIG } = require('../backup/backup-service');
const logger = require('../lib/logger');
const path = require('path');
const fs = require('fs');

// GET /api/backup/status — État des sauvegardes
router.get('/status', auth, requireRole('DG'), (req, res) => {
  try {
    const report = getBackupReport();
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/backup/now — Déclencher une sauvegarde manuelle
router.post('/now', auth, requireRole('DG'), async (req, res) => {
  try {
    const type = req.body.type || 'daily';
    if (!['daily', 'weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ error: 'type doit être: daily, weekly, monthly' });
    }
    logger.info(`[BACKUP] Sauvegarde manuelle déclenchée par ${req.user.prenom} ${req.user.nom}`, { type });
    const result = await backupPostgres(type);
    res.json({ message: 'Sauvegarde effectuée', ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/backup/verify/:filename — Vérifier l'intégrité d'un backup
router.get('/verify/:type/:filename', auth, requireRole('DG'), async (req, res) => {
  try {
    const { type, filename } = req.params;
    // Sécurité : empêcher traversal de chemin
    const safeFilename = path.basename(filename);
    const filePath = path.join(CONFIG.BACKUP_DIR, type, safeFilename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier de sauvegarde introuvable' });
    const result = await verifyBackup(filePath);
    res.json({ filename: safeFilename, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/backup/download/:type/:filename — Télécharger un backup (DG uniquement)
router.get('/download/:type/:filename', auth, requireRole('DG'), (req, res) => {
  try {
    const { type, filename } = req.params;
    const safeFilename = path.basename(filename);
    const filePath = path.join(CONFIG.BACKUP_DIR, type, safeFilename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier introuvable' });
    logger.info(`[BACKUP] Téléchargement backup par ${req.user.prenom} ${req.user.nom}`, { filename: safeFilename });
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', 'application/gzip');
    res.sendFile(filePath);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
