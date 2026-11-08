/**
 * Lien Menu & Carte ↔ Stock (boissons de Yakro Grill) :
 *  - toute boisson du stock existe au menu du POS, toute boisson du menu est liée à son article de stock ;
 *  - chaque vente déduit le stock, une annulation le restitue ;
 *  - une boisson épuisée n'est plus proposée au POS.
 */
const prisma = require('./prisma');
const FILIALE = 'YAKRO_GRILL';
const CATS_MENU_BOISSON = ['BOISSON', 'BIERE', 'VIN', 'COCKTAIL', 'CHAMPAGNE'];
const CAT_MENU = { BOISSONS: 'BOISSON', BIERES: 'BIERE', VINS: 'VIN', SPIRITUEUX: 'COCKTAIL', ALCOOLS_BAR: 'BOISSON' };
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

async function lierMenuStock() {
  const [menu, produits] = await Promise.all([
    prisma.menuYakro.findMany({ where: { categorie: { in: CATS_MENU_BOISSON } } }),
    prisma.produit.findMany({ where: { filiale: FILIALE, type: 'BOISSON', actif: true }, omit: { imageData: true } }),
  ]);
  const prise = new Set(menu.filter(m => m.produitId).map(m => m.produitId));
  let lies = 0, crees = 0;
  // 1) boissons du menu sans lien → article de stock de même nom
  for (const m of menu.filter(x => !x.produitId)) {
    const n = norm(m.nom); if (n.length < 3) continue;
    const libres = produits.filter(p => !prise.has(p.id));
    const p = libres.find(x => norm(x.nom) === n) || libres.find(x => { const k = norm(x.nom); return k.startsWith(n + ' ') || n.startsWith(k + ' '); });
    if (!p) continue;
    await prisma.menuYakro.update({ where: { id: m.id }, data: { produitId: p.id, ...(!m.image && p.imageUrl ? { image: p.imageUrl } : {}) } });
    prise.add(p.id); lies++;
  }
  // 2) articles de stock absents du menu → créés au menu (prix = prix de vente du stock)
  for (const p of produits.filter(x => !prise.has(x.id))) {
    await prisma.menuYakro.create({ data: { nom: p.nom, categorie: CAT_MENU[p.categorie] || 'BOISSON', prix: p.prixVente || 0, coutRevient: p.prixAchat || null, image: p.imageUrl || null, produitId: p.id, disponible: true } });
    crees++;
  }
  return { lies, crees };
}

/** Quantité en stock par article du menu : Map(menuId → quantité) pour les boissons liées. */
async function stockParMenu(menuItems) {
  const ids = [...new Set(menuItems.map(i => i.produitId).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.stock.groupBy({ by: ['produitId'], where: { produitId: { in: ids }, filiale: FILIALE }, _sum: { quantite: true } });
  const q = new Map(rows.map(r => [r.produitId, r._sum.quantite || 0]));
  return new Map(menuItems.filter(i => i.produitId).map(i => [i.id, q.get(i.produitId) || 0]));
}

/** Déduit le stock des boissons vendues (dans une transaction). Lève une erreur claire si le stock est insuffisant. */
async function deduireStock(tx, lignes, ref) {
  const menus = await tx.menuYakro.findMany({ where: { id: { in: lignes.map(l => l.menuId) }, NOT: { produitId: null } } });
  const besoin = new Map(); // produitId → { qte, nom }
  for (const l of lignes) {
    const m = menus.find(x => x.id === l.menuId); if (!m) continue;
    const b = besoin.get(m.produitId) || { qte: 0, nom: m.nom };
    b.qte += Number(l.quantite) || 0; besoin.set(m.produitId, b);
  }
  for (const [produitId, { qte, nom }] of besoin) {
    const rows = await tx.stock.findMany({ where: { produitId, filiale: FILIALE }, orderBy: { quantite: 'desc' } });
    const total = rows.reduce((s, r) => s + r.quantite, 0);
    if (total < qte) { const e = new Error(`Stock insuffisant : ${nom} (reste ${total})`); e.statut = 400; throw e; }
    let reste = qte;
    for (const r of rows) {
      if (reste <= 0) break;
      const pris = Math.min(r.quantite, reste);
      if (pris > 0) { await tx.stock.update({ where: { id: r.id }, data: { quantite: { decrement: pris } } }); reste -= pris; }
    }
    await tx.mouvementStock.create({ data: { produitId, filiale: FILIALE, type: 'SORTIE', quantite: qte, motif: `Vente ${ref}`, refDocument: ref } });
  }
}

/** Restitue au stock les boissons d'une commande annulée. */
async function restituerStock(tx, commandeId, ref) {
  const lignes = await tx.ligneCommandeYakro.findMany({ where: { commandeId }, include: { menu: { select: { produitId: true } } } });
  const par = new Map();
  for (const l of lignes) if (l.menu?.produitId) par.set(l.menu.produitId, (par.get(l.menu.produitId) || 0) + l.quantite);
  for (const [produitId, qte] of par) {
    await tx.stock.upsert({ where: { produitId_filiale_depot: { produitId, filiale: FILIALE, depot: 'Principal' } }, create: { produitId, filiale: FILIALE, depot: 'Principal', quantite: qte }, update: { quantite: { increment: qte } } });
    await tx.mouvementStock.create({ data: { produitId, filiale: FILIALE, type: 'ENTREE', quantite: qte, motif: `Annulation ${ref}`, refDocument: ref } });
  }
}

module.exports = { lierMenuStock, stockParMenu, deduireStock, restituerStock };
