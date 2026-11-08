/**
 * Catalogue des boissons de RZI-Camp (noms, prix, formats, photos) intégré au stock Yakro Grill.
 * Idempotent : chaque boisson a une référence stable, rien n'est dupliqué ni écrasé au redémarrage.
 * Les articles « boutique » (cigarettes, snacks, hygiène) ne sont pas des boissons : ignorés.
 */
const prisma = require('./prisma');
const data = require('../data/boissons-rzi.json');

const CAT = { biere: 'BIERES', vin: 'VINS', liqueur: 'SPIRITUEUX', soft: 'BOISSONS', gazeuse: 'BOISSONS', energie: 'BOISSONS' };
const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function integrerBoissonsRzi() {
  const boissons = data.filter(a => CAT[a.categorie]);
  // Un même nom présent plusieurs fois (formats différents) : on précise le format dans le nom
  const nb = {}; boissons.forEach(a => { nb[slug(a.nom)] = (nb[slug(a.nom)] || 0) + 1; });
  const vus = {};
  let crees = 0;
  for (const a of boissons) {
    let nom = a.nom.trim();
    if (nb[slug(a.nom)] > 1 && !/\d+\s?cl/i.test(nom)) nom = `${nom} ${a.unite}`;
    let ref = `YG-RZI-${slug(nom)}`;
    vus[ref] = (vus[ref] || 0) + 1;
    if (vus[ref] > 1) { nom = `${nom} (${vus[ref]})`; ref = `${ref}-${vus[ref]}`; }
    if (await prisma.produit.findUnique({ where: { reference: ref } })) continue;
    const prod = await prisma.produit.create({ data: {
      reference: ref, nom, categorie: CAT[a.categorie], type: 'BOISSON', filiale: 'YAKRO_GRILL',
      unite: /^\d+cl$/.test(a.unite) ? 'bouteille' : (a.unite || 'bouteille'), description: /^\d+cl$/.test(a.unite) ? a.unite : null,
      prixVente: Number(a.prix) || 0, imageUrl: a.image_url || null,
    } });
    await prisma.stock.create({ data: { produitId: prod.id, filiale: 'YAKRO_GRILL', quantite: 0, depot: 'Principal' } });
    crees++;
  }
  return { crees, total: boissons.length };
}
module.exports = { integrerBoissonsRzi };
