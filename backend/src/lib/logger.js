const winston = require('winston');
const path = require('path');

const logDir = process.env.LOG_DIR || '/tmp/erp-2ig-logs';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'erp-2ig' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const extras = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level}] ${message} ${extras}`;
        })
      )
    }),
    // En production, ajouter fichier si LOG_DIR accessible
  ],
});

// En production sur Render, les logs console sont capturés automatiquement
if (process.env.NODE_ENV === 'production') {
  try {
    const { mkdirSync } = require('fs');
    mkdirSync(logDir, { recursive: true });
    logger.add(new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }));
    logger.add(new winston.transports.File({ filename: path.join(logDir, 'combined.log'), maxsize: 10485760, maxFiles: 5 }));
  } catch (e) { /* Render : logs console suffisants */ }
}

module.exports = logger;
