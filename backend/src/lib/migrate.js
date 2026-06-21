// Runner de migrations SQL — applique dans l'ordre tous les fichiers
// backend/prisma/migrations/*.sql qui n'ont pas encore été exécutés.
const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');
const logger = require('./logger');

async function runMigrations() {
  if (!process.env.DATABASE_URL) return;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Table de suivi des migrations (si absente on la crée)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      "name" TEXT PRIMARY KEY,
      "appliedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const dir = path.join(__dirname, '../../prisma/migrations');
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await client.query('SELECT 1 FROM "_migrations" WHERE name=$1', [file]);
    if (rows.length > 0) continue;

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await client.query(sql);
      await client.query('INSERT INTO "_migrations"(name) VALUES($1)', [file]);
      logger.info(`Migration appliquée : ${file}`);
    } catch (e) {
      logger.error(`Erreur migration ${file}`, { error: e.message });
    }
  }

  await client.end();
}

module.exports = runMigrations;
