/**
 * ERP 2IG — Seed initial
 * Build command Render : npm install && npx prisma generate && node src/seed.js
 * Ce fichier : migrations SQL manuelles + données initiales
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function runMigrations() {
  // D'abord appliquer le schema via db push
  console.log('📐 db push...');
  try {
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      timeout: 120000,
    });
    console.log('✅ Schema OK');
  } catch(e) {
    console.warn('⚠ db push:', e.message?.slice(0, 100));
  }

  // Migrations SQL
  const dir = path.join(__dirname, '../prisma/migrations');
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`✅ Migration ${f}`);
    } catch(e) { console.warn(`⚠ Migration ${f}: ${e.message?.slice(0,60)}`); }
  }
}

async function seed() {
  // Caisses
  for (const c of [
    { nom:'Caisse Yakro Grill', filiale:'YAKRO_GRILL' },
    { nom:'Caisse TOPTELSIG',   filiale:'TOPTELSIG' },
    { nom:'Caisse LiYA',        filiale:'LIYA' },
    { nom:'Caisse Groupe',      filiale:'GROUPE' },
  ]) {
    if (!await prisma.caisse.findFirst({ where:{ nom:c.nom } }))
      await prisma.caisse.create({ data: c });
  }
  console.log(`✅ Caisses`);

  // Tables restaurant
  for (let i = 1; i <= 12; i++) {
    if (!await prisma.tableRestaurant.findUnique({ where:{ numero:i } })) {
      const zone = i<=7?'Salle':i<=10?'Terrasse':'VIP';
      const cap = i===7?8:[3,5,6].includes(i)?6:i>=11?6:4;
      await prisma.tableRestaurant.create({ data:{ numero:i, capacite:cap, zone } });
    }
  }
  console.log(`✅ Tables`);

  // Menu Yakro
  if (!await prisma.menuYakro.count()) {
    const items = [
      {nom:'Attiéké nature',categorie:'GARNITURE',prix:1000},{nom:'Alloco',categorie:'GARNITURE',prix:1000},
      {nom:'Riz nature ou légumes',categorie:'GARNITURE',prix:1000},{nom:'Frite de pomme de terre',categorie:'GARNITURE',prix:1000},
      {nom:'Pomme de terre écrasée',categorie:'GARNITURE',prix:2000},{nom:'Pomme sauté',categorie:'GARNITURE',prix:1000},
      {nom:"Frite d'igname",categorie:'GARNITURE',prix:1000},{nom:'Légume sauté',categorie:'GARNITURE',prix:1000},
      {nom:'Steak de boeuf haché',categorie:'PLAT_EUROPEEN',prix:8000},{nom:'Entrecôte de Porc',categorie:'PLAT_EUROPEEN',prix:9000},
      {nom:'Suprême de poulet (garniture au choix)',categorie:'PLAT_EUROPEEN',prix:10000},{nom:'Lapin chasseur',categorie:'PLAT_EUROPEEN',prix:15000},
      {nom:'Escalope de poulet poêlé, crème champignon',categorie:'PLAT_EUROPEEN',prix:9000},{nom:'Côte de porc poêlé + sauce moutarde',categorie:'PLAT_EUROPEEN',prix:9000},
      {nom:'Mignon de porc, sauce crème',categorie:'PLAT_EUROPEEN',prix:9000},{nom:"Brochette d'Escargot (2 brochettes)",categorie:'PLAT_EUROPEEN',prix:10000},
      {nom:'Poulet de chair demi',categorie:'VOLAILLE',prix:5000,prixMini:5000,prixMaxi:9000},{nom:'Poulet de chair entier',categorie:'VOLAILLE',prix:9000},
      {nom:'Poulet Roti',categorie:'VOLAILLE',prix:15000},{nom:'Poulet DG',categorie:'VOLAILLE',prix:12000},
      {nom:'Poulet Mayo demi',categorie:'VOLAILLE',prix:6000},{nom:'Poulet hybride',categorie:'VOLAILLE',prix:12000},
      {nom:'Poulet pondeuse',categorie:'VOLAILLE',prix:12000},{nom:'Cabri',categorie:'VIANDE',prix:5000},
      {nom:'Porc',categorie:'VIANDE',prix:5000},{nom:'Mouton',categorie:'VIANDE',prix:5000},
      {nom:'Lapin',categorie:'VIANDE',prix:15000},{nom:"Entrecôte de Bœuf poêlé à l'échalotte",categorie:'VIANDE',prix:9000},
      {nom:'Filet de Bœuf, Sauce Crème Champignon',categorie:'VIANDE',prix:10000},{nom:'Brochette De Bœuf (2 brochettes)',categorie:'VIANDE',prix:9000},
      {nom:"Souris d'agneau au miel",categorie:'VIANDE',prix:10000},{nom:'Brochette de Poulet',categorie:'BROCHETTE',prix:8000},
      {nom:'Brochette de filet de bœuf',categorie:'BROCHETTE',prix:9000},{nom:'Brochette de gésier',categorie:'BROCHETTE',prix:6000},
      {nom:'Brochette de Gambas',categorie:'BROCHETTE',prix:15000},{nom:'Plateau PREMIUM',categorie:'PLATEAU',prix:60000},
      {nom:'Plateau PLATINE',categorie:'PLATEAU',prix:40000},{nom:'Plateau SOLO',categorie:'PLATEAU',prix:25000},
      {nom:'Pizza Royale Grande',categorie:'PIZZA',prix:10000,prixMini:6000},{nom:'Pizza au Poulet Grande',categorie:'PIZZA',prix:10000,prixMini:6000},
      {nom:'Pizza Toscane Grande',categorie:'PIZZA',prix:10000,prixMini:6000},{nom:'Pizza Fruits de Mer Grande',categorie:'PIZZA',prix:10000,prixMini:6000},
      {nom:'Pizza végétarienne Grande',categorie:'PIZZA',prix:10000,prixMini:6000},{nom:'Pizza 4 saisons Grande',categorie:'PIZZA',prix:10000,prixMini:6000},
      {nom:'Chawarma végétarien',categorie:'CHAWARMA',prix:3000},{nom:'Chawarma viande hachée',categorie:'CHAWARMA',prix:3000},
      {nom:'Chawarma Poulet',categorie:'CHAWARMA',prix:3000},{nom:'Tacos viande hachée',categorie:'CHAWARMA',prix:3000},
      {nom:'Tacos poulet',categorie:'CHAWARMA',prix:3000},{nom:'Burger + frites',categorie:'CHAWARMA',prix:5000},
      {nom:'Salade de Fruits',categorie:'DESSERT',prix:2000},{nom:'Mousse au Chocolat',categorie:'DESSERT',prix:2500},
      {nom:'Crêpe Chocolat',categorie:'DESSERT',prix:2000},{nom:'Crêpe Nature',categorie:'DESSERT',prix:1500},
      {nom:'Glace (par boule)',categorie:'DESSERT',prix:1000},{nom:'Heineken',categorie:'BIERE',prix:1000},
      {nom:'Desperados',categorie:'BIERE',prix:1000},{nom:'Guinness',categorie:'BIERE',prix:1500},
      {nom:'Budweiser',categorie:'BIERE',prix:1500},{nom:'Malta Guinness',categorie:'BIERE',prix:1000},
      {nom:'Mojito Virgin',categorie:'COCKTAIL_SANS_ALCOOL',prix:3000},{nom:'Bora Bora',categorie:'COCKTAIL_SANS_ALCOOL',prix:3000},
      {nom:'Mojito Kiwi',categorie:'COCKTAIL_SANS_ALCOOL',prix:5000},{nom:'Mojito Fraise',categorie:'COCKTAIL_SANS_ALCOOL',prix:5000},
      {nom:'Jardin Fumé',categorie:'COCKTAIL_SANS_ALCOOL',prix:10000},{nom:'Mojito Classique',categorie:'COCKTAIL_ALCOOLISE',prix:4000},
      {nom:'Margarita',categorie:'COCKTAIL_ALCOOLISE',prix:5000},{nom:'Pina Colada',categorie:'COCKTAIL_ALCOOLISE',prix:5000},
      {nom:'BMW',categorie:'COCKTAIL_ALCOOLISE',prix:7000},{nom:'Mojito Champagne',categorie:'COCKTAIL_ALCOOLISE',prix:25000},
      {nom:'Cocktail Alla',categorie:'COCKTAIL_ALCOOLISE',prix:20000},{nom:'Les Bordeaux',categorie:'VIN',prix:15000},
      {nom:'Moët',categorie:'CHAMPAGNE',prix:60000},{nom:'Veuve Cliquot',categorie:'CHAMPAGNE',prix:70000},
      {nom:'Veuve Hambal',categorie:'CHAMPAGNE',prix:45000},{nom:'Fanta',categorie:'SUCRERIE',prix:1000},
      {nom:'Coca-cola',categorie:'SUCRERIE',prix:1000},{nom:'Orangina',categorie:'SUCRERIE',prix:1000},
      {nom:'Tisane Gingembre',categorie:'TISANE',prix:1500},{nom:'Tisane Bissap',categorie:'TISANE',prix:1500},
    ];
    await prisma.menuYakro.createMany({ data: items, skipDuplicates: true });
    console.log(`✅ Menu Yakro (${items.length} articles)`);
  } else {
    console.log(`⏭ Menu déjà présent`);
  }

  console.log('🎉 Init terminée');
}

async function main() {
  await runMigrations();
  await seed();
}

main()
  .catch(e => { console.error('❌', e.message); })
  .finally(() => prisma.$disconnect());
