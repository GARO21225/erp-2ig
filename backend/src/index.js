const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const logger = require('./lib/logger');
const { backupPostgres, getBackupType } = require('./backup/backup-service');
require('dotenv').config();

const app = express();

// ── Sécurité de base
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// ── CORS — ouvert en production initiale, à restreindre après
app.use(cors({ origin: true, credentials: true }));

app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', 1); // Render est derrière un reverse proxy

// ── Logging HTTP
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) }
}));

// ── Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Trop de requêtes. Réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives. Réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);

// ── Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/employes',    require('./routes/employes'));
app.use('/api/finance',     require('./routes/finance'));
app.use('/api/stocks',      require('./routes/stocks'));
app.use('/api/documents',   require('./routes/documents'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/recherche',   require('./routes/recherche'));
app.use('/api/backup',      require('./routes/backup'));

app.use('/api/yakro/tables',       require('./routes/yakro/tables'));
app.use('/api/yakro/commandes',    require('./routes/yakro/commandes'));
app.use('/api/yakro/menu',         require('./routes/yakro/menu'));
app.use('/api/yakro/reservations', require('./routes/yakro/reservations'));

app.use('/api/toptelsig/projets',       require('./routes/toptelsig/projets'));
app.use('/api/toptelsig/lots',          require('./routes/toptelsig/lots'));
app.use('/api/toptelsig/souscripteurs', require('./routes/toptelsig/souscripteurs'));
app.use('/api/toptelsig/ventes',        require('./routes/toptelsig/ventes'));
app.use('/api/toptelsig/depenses',      require('./routes/toptelsig/depenses'));
app.use('/api/toptelsig/prescripteurs', require('./routes/toptelsig/prescripteurs'));

app.use('/api/liya/livraisons', require('./routes/liya/livraisons'));
app.use('/api/liya/motos',      require('./routes/liya/motos'));
app.use('/api/liya/stock3pl',   require('./routes/liya/stock3pl'));

// ── Health check
app.get('/health', (_, res) => res.json({
  status: 'ok',
  timestamp: new Date(),
  version: '2.0',
  env: process.env.NODE_ENV || 'development'
}));

// ── 404
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} introuvable` });
});

// ── Error handler global
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} ${req.method} ${req.path}`, { error: err.message });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erreur serveur interne' : err.message,
  });
});

// ── Cron jobs
cron.schedule('0 2 * * *', async () => {
  try {
    const prisma = require('./lib/prisma');
    await prisma.echeancier.updateMany({
      where: { dateEcheance: { lt: new Date() }, statut: { in: ['EN_ATTENTE', 'PARTIEL'] } },
      data: { statut: 'RETARD' }
    });
  } catch (e) { logger.error('Cron retards', { error: e.message }); }
}, { timezone: 'Africa/Abidjan' });

cron.schedule('0 7 * * *', async () => {
  try {
    const prisma = require('./lib/prisma');
    const dans30j = new Date(); dans30j.setDate(dans30j.getDate() + 30);
    const motos = await prisma.moto.count({ where: { dateExpirationAssurance: { lte: dans30j } } });
    if (motos > 0) logger.warn(`${motos} moto(s) avec assurance expirant bientôt`);
  } catch (e) { logger.error('Cron motos', { error: e.message }); }
}, { timezone: 'Africa/Abidjan' });

cron.schedule('0 3 * * *', async () => {
  const type = getBackupType();
  try {
    const result = await backupPostgres(type);
    logger.info(`Backup ${type} OK`, { file: result.filename, size: result.sizeHuman });
  } catch (e) { logger.error(`Backup ${type} FAILED`, { error: e.message }); }
}, { timezone: 'Africa/Abidjan' });

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 ERP 2IG API v2.0 → port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
