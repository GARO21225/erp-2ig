/**
 * ERP 2IG — Service de sauvegarde automatique
 * Politique : 7 quotidiennes, 4 hebdomadaires, 12 mensuelles
 * Stockage : local + S3 (configurable via .env)
 */
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');

// ── Configuration ──────────────────────────────────────────────────────────
const CONFIG = {
  DATABASE_URL: process.env.DATABASE_URL,
  BACKUP_DIR: process.env.BACKUP_DIR || '/tmp/erp-2ig-backups',
  S3_BUCKET: process.env.BACKUP_S3_BUCKET || '',
  S3_REGION: process.env.BACKUP_S3_REGION || 'eu-west-3',
  S3_PREFIX: process.env.BACKUP_S3_PREFIX || 'erp-2ig-backups',
  CLOUDINARY_URL: process.env.CLOUDINARY_URL || '',
  FTP_HOST: process.env.BACKUP_FTP_HOST || '',
  FTP_USER: process.env.BACKUP_FTP_USER || '',
  FTP_PASS: process.env.BACKUP_FTP_PASS || '',
  FTP_DIR: process.env.BACKUP_FTP_DIR || '/backups/erp-2ig',
  RETENTION_DAILY: Number(process.env.BACKUP_RETENTION_DAILY || 7),
  RETENTION_WEEKLY: Number(process.env.BACKUP_RETENTION_WEEKLY || 4),
  RETENTION_MONTHLY: Number(process.env.BACKUP_RETENTION_MONTHLY || 12),
};

// ── Utilitaires ────────────────────────────────────────────────────────────
function formatDate(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getBackupType() {
  const d = new Date();
  if (d.getDate() === 1) return 'monthly';
  if (d.getDay() === 0) return 'weekly'; // Dimanche
  return 'daily';
}

// ── Journal de sauvegarde ──────────────────────────────────────────────────
const JOURNAL_FILE = path.join(CONFIG.BACKUP_DIR, 'backup-journal.json');

function loadJournal() {
  try {
    if (fs.existsSync(JOURNAL_FILE)) return JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf8'));
  } catch (e) { /* ignore */ }
  return { entries: [] };
}

function saveJournal(journal) {
  ensureDir(CONFIG.BACKUP_DIR);
  fs.writeFileSync(JOURNAL_FILE, JSON.stringify(journal, null, 2));
}

function journalEntry(entry) {
  const journal = loadJournal();
  journal.entries.unshift({ ...entry, timestamp: new Date().toISOString() });
  journal.entries = journal.entries.slice(0, 200); // Max 200 entrées
  saveJournal(journal);
  return journal;
}

// ── PostgreSQL backup ──────────────────────────────────────────────────────
async function backupPostgres(type = 'daily') {
  const startTime = Date.now();
  const dateStr = formatDate();
  const filename = `postgres-${type}-${dateStr}.sql.gz`;
  const tmpDir = path.join(CONFIG.BACKUP_DIR, 'tmp');
  const finalDir = path.join(CONFIG.BACKUP_DIR, type);
  ensureDir(tmpDir);
  ensureDir(finalDir);

  const tmpFile = path.join(tmpDir, filename);
  const finalFile = path.join(finalDir, filename);

  logger.info(`[BACKUP] Démarrage sauvegarde PostgreSQL (${type})`, { filename });

  try {
    if (!CONFIG.DATABASE_URL) throw new Error('DATABASE_URL non configurée');

    // Parser DATABASE_URL
    const url = new URL(CONFIG.DATABASE_URL);
    const env = {
      ...process.env,
      PGPASSWORD: url.password,
      PGUSER: url.username,
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGDATABASE: url.pathname.slice(1).split('?')[0],
    };

    // pg_dump via variable d'env (Render fournit pg_dump dans le PATH)
    const pgDumpCmd = `pg_dump --format=custom --compress=9 --no-password -h ${env.PGHOST} -p ${env.PGPORT} -U ${env.PGUSER} ${env.PGDATABASE} | gzip -9 > "${tmpFile}"`;
    
    // Sur Render : pg_dump est disponible. En local sans PostgreSQL : fallback Prisma export
    let method = 'pg_dump';
    try {
      execSync(pgDumpCmd, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (pgErr) {
      // Fallback : export via Prisma si pg_dump absent
      logger.warn('[BACKUP] pg_dump indisponible, fallback export JSON via Prisma', { error: pgErr.message });
      method = 'prisma-json';
      await backupViaPrisma(tmpFile.replace('.sql.gz', '.json.gz'));
      fs.renameSync(tmpFile.replace('.sql.gz', '.json.gz'), tmpFile.replace('.sql.gz', '.json.gz'));
      const altFile = tmpFile.replace('.sql.gz', '.json.gz');
      fs.renameSync(altFile, path.join(finalDir, filename.replace('.sql.gz', '.json.gz')));
      const stats = fs.statSync(path.join(finalDir, filename.replace('.sql.gz', '.json.gz')));
      return { success: true, method, filename, size: stats.size, duration: Date.now() - startTime };
    }

    // Vérification intégrité
    const tmpStats = fs.statSync(tmpFile);
    if (tmpStats.size === 0) throw new Error('Sauvegarde vide — anomalie pg_dump');
    
    // Déplacer vers dossier final
    fs.renameSync(tmpFile, finalFile);
    const finalStats = fs.statSync(finalFile);
    const duration = Date.now() - startTime;
    const sizeHuman = formatSize(finalStats.size);

    logger.info(`[BACKUP] Sauvegarde PostgreSQL OK`, { filename, size: sizeHuman, duration: `${duration}ms`, type });
    
    // Journaliser
    journalEntry({ event: 'backup_ok', type, method, filename, size: finalStats.size, sizeHuman, duration });

    // Upload vers stockage externe
    if (CONFIG.S3_BUCKET) {
      await uploadToS3(finalFile, `${CONFIG.S3_PREFIX}/${type}/${filename}`);
    } else if (CONFIG.FTP_HOST) {
      await uploadToFTP(finalFile, filename, type);
    } else {
      logger.warn('[BACKUP] Aucun stockage externe configuré. Sauvegarde locale uniquement. Configurer BACKUP_S3_BUCKET ou BACKUP_FTP_HOST.');
    }

    // Rotation (nettoyage anciens backups)
    await rotateBackups(type, finalDir);

    return { success: true, method, filename, size: finalStats.size, sizeHuman, duration };

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[BACKUP] ÉCHEC sauvegarde PostgreSQL`, { error: error.message, type, duration });
    journalEntry({ event: 'backup_failed', type, error: error.message, duration });
    // Nettoyer fichier partiel
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}
    throw error;
  }
}

// ── Fallback : Export JSON via Prisma (si pg_dump absent) ─────────────────
async function backupViaPrisma(outputFile) {
  const prisma = require('../lib/prisma');
  const zlib = require('zlib');
  
  logger.info('[BACKUP] Export JSON via Prisma...');
  
  // Exporter toutes les tables principales
  const [
    utilisateurs, employes, caisses, encaissements, decaissements,
    produits, stocks, mouvements, commandesYakro, menuYakro, livraisons, motos,
    projets, lots, souscripteurs, ventes, echeanciers, paiementsFoncier, depenses,
    prescripteurs, commissions, auditLogs
  ] = await Promise.all([
    prisma.utilisateur.findMany({ select: { id: true, email: true, nom: true, prenom: true, role: true, filiale: true, actif: true, createdAt: true } }),
    prisma.employe.findMany(),
    prisma.caisse.findMany(),
    prisma.encaissement.findMany(),
    prisma.decaissement.findMany(),
    prisma.produit.findMany(),
    prisma.stock.findMany(),
    prisma.mouvementStock.findMany({ take: 50000, orderBy: { createdAt: 'desc' } }),
    prisma.commandeYakro.findMany({ take: 10000, orderBy: { createdAt: 'desc' } }),
    prisma.menuYakro.findMany(),
    prisma.livraison.findMany({ take: 10000, orderBy: { createdAt: 'desc' } }),
    prisma.moto.findMany(),
    prisma.projetFoncier.findMany(),
    prisma.lot.findMany(),
    prisma.souscripteur.findMany(),
    prisma.venteFoncier.findMany(),
    prisma.echeancier.findMany(),
    prisma.paiementFoncier.findMany(),
    prisma.depenseFoncier.findMany(),
    prisma.prescripteur.findMany(),
    prisma.commission.findMany(),
    prisma.auditLog.findMany({ take: 10000, orderBy: { createdAt: 'desc' } }),
  ]);

  const backup = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    tables: {
      utilisateurs, employes, caisses, encaissements, decaissements,
      produits, stocks, mouvements, commandesYakro, menuYakro, livraisons, motos,
      projets, lots, souscripteurs, ventes, echeanciers, paiementsFoncier, depenses,
      prescripteurs, commissions, auditLogs,
    },
    counts: Object.fromEntries(
      Object.entries({ utilisateurs, employes, caisses, encaissements, decaissements,
        produits, stocks, mouvements, commandesYakro, menuYakro, livraisons, motos,
        projets, lots, souscripteurs, ventes, echeanciers, paiementsFoncier, depenses,
        prescripteurs, commissions, auditLogs }).map(([k, v]) => [k, v.length])
    ),
  };

  const json = JSON.stringify(backup);
  const compressed = zlib.gzipSync(Buffer.from(json), { level: 9 });
  fs.writeFileSync(outputFile, compressed);
  logger.info(`[BACKUP] Export Prisma OK`, { tables: Object.keys(backup.tables).length, sizeHuman: formatSize(compressed.length) });
}

// ── Upload S3 ──────────────────────────────────────────────────────────────
async function uploadToS3(localFile, s3Key) {
  try {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = new S3Client({ region: CONFIG.S3_REGION });
    const fileContent = fs.readFileSync(localFile);
    await client.send(new PutObjectCommand({
      Bucket: CONFIG.S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/gzip',
      StorageClass: 'STANDARD_IA', // Économique pour les backups
      Metadata: { source: 'erp-2ig', env: process.env.NODE_ENV || 'production' },
    }));
    logger.info(`[BACKUP] Upload S3 OK`, { bucket: CONFIG.S3_BUCKET, key: s3Key });
    journalEntry({ event: 's3_upload_ok', bucket: CONFIG.S3_BUCKET, key: s3Key });
  } catch (e) {
    logger.error(`[BACKUP] Échec upload S3`, { error: e.message });
    journalEntry({ event: 's3_upload_failed', error: e.message });
    throw e;
  }
}

// ── Upload FTP ─────────────────────────────────────────────────────────────
async function uploadToFTP(localFile, filename, type) {
  try {
    // Utiliser curl pour FTP (disponible sur la plupart des serveurs)
    const remoteDir = `${CONFIG.FTP_DIR}/${type}`;
    const curlCmd = `curl -s --ftp-create-dirs -T "${localFile}" ftp://${CONFIG.FTP_HOST}/${remoteDir}/${filename} --user "${CONFIG.FTP_USER}:${CONFIG.FTP_PASS}"`;
    execSync(curlCmd, { stdio: ['pipe', 'pipe', 'pipe'] });
    logger.info(`[BACKUP] Upload FTP OK`, { host: CONFIG.FTP_HOST, path: `${remoteDir}/${filename}` });
    journalEntry({ event: 'ftp_upload_ok', host: CONFIG.FTP_HOST, filename });
  } catch (e) {
    logger.error(`[BACKUP] Échec upload FTP`, { error: e.message });
    journalEntry({ event: 'ftp_upload_failed', error: e.message });
    // Ne pas relancer l'erreur — le backup local est intègre
  }
}

// ── Rotation des anciens backups ───────────────────────────────────────────
async function rotateBackups(type, dir) {
  const limits = {
    daily: CONFIG.RETENTION_DAILY,
    weekly: CONFIG.RETENTION_WEEKLY,
    monthly: CONFIG.RETENTION_MONTHLY,
  };
  const limit = limits[type] || 7;
  
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith(`postgres-${type}-`) || f.startsWith(`erp2ig-${type}-`))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > limit) {
      const toDelete = files.slice(limit);
      toDelete.forEach(f => {
        fs.unlinkSync(path.join(dir, f.name));
        logger.info(`[BACKUP] Rotation: suppression ancien backup`, { file: f.name });
      });
    }
  } catch (e) {
    logger.warn(`[BACKUP] Erreur rotation`, { error: e.message });
  }
}

// ── Vérification intégrité d'une sauvegarde ────────────────────────────────
async function verifyBackup(backupFile) {
  try {
    const stats = fs.statSync(backupFile);
    if (stats.size === 0) return { ok: false, error: 'Fichier vide' };
    
    // Pour .gz : vérifier l'intégrité gzip
    if (backupFile.endsWith('.gz')) {
      execSync(`gzip -t "${backupFile}"`, { stdio: ['pipe', 'pipe', 'pipe'] });
    }
    
    return { ok: true, size: stats.size, sizeHuman: formatSize(stats.size), mtime: stats.mtime };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Rapport de sauvegarde ──────────────────────────────────────────────────
function getBackupReport() {
  const journal = loadJournal();
  const backupDir = CONFIG.BACKUP_DIR;
  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      backupDir,
      s3Configured: !!CONFIG.S3_BUCKET,
      ftpConfigured: !!CONFIG.FTP_HOST,
      retentionDaily: CONFIG.RETENTION_DAILY,
      retentionWeekly: CONFIG.RETENTION_WEEKLY,
      retentionMonthly: CONFIG.RETENTION_MONTHLY,
    },
    backups: { daily: [], weekly: [], monthly: [] },
    lastBackup: null,
    nextScheduled: null,
    recentEvents: journal.entries.slice(0, 20),
  };

  // Scanner les dossiers
  ['daily', 'weekly', 'monthly'].forEach(type => {
    const dir = path.join(backupDir, type);
    if (fs.existsSync(dir)) {
      report.backups[type] = fs.readdirSync(dir)
        .filter(f => f.endsWith('.gz'))
        .map(f => {
          const s = fs.statSync(path.join(dir, f));
          return { file: f, size: s.size, sizeHuman: formatSize(s.size), mtime: s.mtime };
        })
        .sort((a, b) => b.mtime - a.mtime);
    }
  });

  const allBackups = [...report.backups.daily, ...report.backups.weekly, ...report.backups.monthly]
    .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
  report.lastBackup = allBackups[0] || null;

  return report;
}

// ── Export ─────────────────────────────────────────────────────────────────
module.exports = {
  backupPostgres,
  backupViaPrisma,
  verifyBackup,
  getBackupReport,
  getBackupType,
  CONFIG,
  JOURNAL_FILE,
};
