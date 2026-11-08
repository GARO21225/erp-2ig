/**
 * Photos des boissons : copiées UNE FOIS dans la base de Yakro Grill (plus aucune dépendance à un site externe),
 * puis servies par l'API de Yakro. Reliées aux articles du menu portant le même nom.
 */
const prisma = require('./prisma');

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const MAX = 1024 * 1024;

async function rapatrierImages() {
  const produits = await prisma.produit.findMany({ where: { filiale: 'YAKRO_GRILL', imageData: null, imageUrl: { startsWith: 'http' } }, select: { id: true, imageUrl: true } });
  const cache = new Map(); // une même image n'est téléchargée qu'une fois
  let ok = 0, echec = 0;
  for (const p of produits) {
    try {
      let img = cache.get(p.imageUrl);
      if (!img) {
        const r = await fetch(p.imageUrl, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YakroGrill/1.0)' } });
        const type = (r.headers.get('content-type') || '').split(';')[0];
        if (!r.ok || !/^image\/(png|jpeg|webp|gif)$/.test(type)) throw new Error(`HTTP ${r.status} ${type}`);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > MAX) throw new Error('image trop lourde');
        img = { buf, type }; cache.set(p.imageUrl, img);
      }
      await prisma.produit.update({ where: { id: p.id }, data: { imageData: img.buf, imageType: img.type, imageUrl: `/api/stocks/image/${p.id}` } });
      ok++;
    } catch (e) { echec++; }
  }
  return { ok, echec, total: produits.length };
}

/** Donne aux boissons du menu la photo du produit de même nom (ou dont le nom commence pareil). */
async function lierImagesMenu() {
  const [menu, produits] = await Promise.all([
    prisma.menuYakro.findMany({ where: { categorie: { in: ['BOISSON', 'BIERE', 'VIN', 'COCKTAIL'] }, OR: [{ image: null }, { image: '' }] }, select: { id: true, nom: true } }),
    prisma.produit.findMany({ where: { filiale: 'YAKRO_GRILL', type: 'BOISSON', NOT: { imageUrl: null } }, select: { id: true, nom: true, imageUrl: true } }),
  ]);
  let lies = 0;
  for (const m of menu) {
    const n = norm(m.nom); if (n.length < 3) continue;
    const p = produits.find(x => norm(x.nom) === n) || produits.find(x => { const k = norm(x.nom); return k.startsWith(n + ' ') || n.startsWith(k + ' '); });
    if (p) { await prisma.menuYakro.update({ where: { id: m.id }, data: { image: p.imageUrl } }); lies++; }
  }
  return { lies, boissonsMenu: menu.length };
}
module.exports = { rapatrierImages, lierImagesMenu };
