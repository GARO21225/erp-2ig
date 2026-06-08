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

// ── CORS totalement ouvert (à restreindre après go-live)
app.use(cors());
app.options('*', cors()); // Pré-vol OPTIONS

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', 1);

app.use(morgan('combined', { stream: { write: (m) => logger.http(m.trim()) } }));

// ── Rate limiting
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 500, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 20, standardHeaders: true, legacyHeaders: false }));

// ── Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/employes',    require('./routes/employes'));
app.use('/api/finance',     require('./routes/finance'));
app.use('/api/stocks',      require('./routes/stocks'));
app.use('/api/documents',   require('./routes/documents'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/recherche',   require('./routes/recherche'));
app.use('/api/audit', require('./routes/audit'));
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
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date(), version: '2.0', env: process.env.NODE_ENV }));

// ── 404
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} introuvable` }));

// ── Error handler
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} ${req.method} ${req.path}`, { error: err.message });
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

// ── Cron jobs
cron.schedule('0 2 * * *', async () => {
  try { const p = require('./lib/prisma'); await p.echeancier.updateMany({ where: { dateEcheance: { lt: new Date() }, statut: { in: ['EN_ATTENTE','PARTIEL'] } }, data: { statut: 'RETARD' } }); }
  catch(e) { logger.error('Cron retards', { error: e.message }); }
}, { timezone: 'Africa/Abidjan' });

cron.schedule('0 3 * * *', async () => {
  try { await backupPostgres(getBackupType()); }
  catch(e) { logger.error('Cron backup', { error: e.message }); }
}, { timezone: 'Africa/Abidjan' });

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => logger.info(`🚀 ERP 2IG API v2.0 → port ${PORT} [${process.env.NODE_ENV}]`));
