/**
 * YAKRO GRILL — Notifications personnelles : « ce qui m'est assigné maintenant ».
 * Chaque élément a un id stable (qui change quand l'étape change) : le client sonne et vibre pour tout nouvel id.
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const { resto, sc } = require('../../lib/yakro-resto');
const yakro = requireFiliale('YAKRO_GRILL');
const F = (n) => `${Math.round(n || 0).toLocaleString('fr').replace(/[  ]/g, ' ')} F`;

router.get('/', auth, yakro, resto, async (req, res) => {
  try {
    const u = req.user, S = sc(req), P = req.permissions || new Set();
    const dg = ['DG', 'DIRECTEUR'].includes(u.role);
    const manager = dg || u.role === 'MANAGER' || P.has('retours.valider');
    const nomComplet = `${u.prenom} ${u.nom}`;
    const items = [];
    const add = (id, type, titre, detail, lien, at, niveau = 'attention') => items.push({ id, type, titre, detail, lien, at, niveau });
    const q = [];

    // Dépenses : une étape = une personne
    if (dg || P.has('depenses.decaisser') || P.has('depenses.cloturer') || P.has('depenses.saisir')) {
      q.push(prisma.depenseYakro.findMany({ where: { ...S, OR: [{ statut: { in: ['BROUILLON', 'VALIDEE', 'PAYEE', 'JUSTIFIEE'] } }, { statut: 'REJETEE', creePar: u.id, valideLe: { gte: new Date(Date.now() - 3 * 86400000) } }] }, select: { id: true, numero: true, description: true, montant: true, statut: true, creePar: true, createdAt: true, valideLe: true, payeLe: true, justifieLe: true, motifRejet: true }, orderBy: { createdAt: 'desc' }, take: 50 })
        .then((l) => { for (const d of l) {
          const ref = `${d.numero || ''} ${d.description} · ${F(d.montant)}`.trim();
          if (d.statut === 'BROUILLON' && dg) add(`dep:${d.id}:B`, 'depense', 'Dépense à valider', ref, '/yakro/depenses', d.createdAt);
          else if (d.statut === 'VALIDEE' && P.has('depenses.decaisser')) add(`dep:${d.id}:V`, 'depense', 'Dépense à décaisser', ref, '/yakro/depenses', d.valideLe || d.createdAt);
          else if (d.statut === 'PAYEE' && (d.creePar === u.id || P.has('depenses.decaisser'))) add(`dep:${d.id}:P`, 'depense', 'Dépense à justifier', ref, '/yakro/depenses', d.payeLe || d.createdAt, 'alerte');
          else if (d.statut === 'JUSTIFIEE' && P.has('depenses.cloturer')) add(`dep:${d.id}:J`, 'depense', 'Dépense à clôturer', ref, '/yakro/depenses', d.justifieLe || d.createdAt);
          else if (d.statut === 'REJETEE' && d.creePar === u.id) add(`dep:${d.id}:R`, 'depense', 'Dépense rejetée', `${ref} — ${d.motifRejet || ''}`, '/yakro/historiques', d.valideLe || d.createdAt, 'alerte');
        } }));
    }
    // Retours d'articles en attente de validation
    if (manager) {
      q.push(prisma.retourArticleYakro.findMany({ where: { valide: false, createdAt: { gte: new Date(Date.now() - 3 * 86400000) } }, orderBy: { createdAt: 'desc' }, take: 20 })
        .then((l) => l.forEach((r) => add(`ret:${r.id}`, 'retour', "Retour d'article à valider", `${r.quantite}× ${r.menuNom} · ${F(r.montantDeduit)} — ${r.motif}`, '/yakro/pos', r.createdAt))).catch(() => {}));
    }
    // Commandes : prêtes pour moi (serveur) / à préparer (cuisine, bar)
    const recent = new Date(Date.now() - 8 * 3600000);
    const cuisinier = u.role === 'BARMAN' || P.has('cuisine.voir');
    q.push(prisma.commandeYakro.findMany({ where: { ...S, createdAt: { gte: recent }, statut: { in: ['EN_COURS', 'CUISINE', 'PRETE'] } }, select: { id: true, numero: true, serveurId: true, serveurNom: true, updatedAt: true, createdAt: true, table: { select: { numero: true } }, lignes: { select: { quantite: true, statut: true, menu: { select: { nom: true } } } } }, orderBy: { updatedAt: 'desc' }, take: 40 })
      .then((l) => { for (const c of l) {
        const t = c.table ? `Table ${c.table.numero}` : 'À emporter';
        const miene = c.serveurNom === nomComplet || c.serveurId === u.id;
        const prets = c.lignes.filter((x) => x.statut === 'PRET');
        const attente = c.lignes.filter((x) => ['EN_ATTENTE', 'EN_CUISINE'].includes(x.statut));
        if (prets.length && miene) add(`cmd:${c.id}:PRET:${prets.length}`, 'commande', 'À récupérer en cuisine / bar', `${t} · ${prets.map((x) => `${x.quantite}× ${x.menu?.nom}`).join(', ')}`, '/yakro/cuisine', c.updatedAt, 'alerte');
        if (attente.length && cuisinier) add(`cmd:${c.id}:ATT:${attente.length}`, 'commande', 'Nouvelle commande à préparer', `${t} · ${attente.map((x) => `${x.quantite}× ${x.menu?.nom}`).join(', ')}`, '/yakro/cuisine', c.createdAt);
      } }));
    await Promise.all(q);
    items.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({ total: items.length, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
