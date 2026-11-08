/**
 * Yakro Grill — Restaurants, prix par restaurant, paramètres, profils & équipe.
 * Menu commun ; chaque restaurant a ses prix, ses tables, sa caisse, ses paramètres et son équipe.
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const { auth, requireFiliale } = require('../../middleware/auth');
const Y = require('../../lib/yakro-resto');
const yakro = requireFiliale('YAKRO_GRILL');

// Vérifie la permission sur le restaurant visé par :id (pas seulement le restaurant courant)
const cible = (perm) => async (req, res, next) => {
  try {
    const liste = await Y.accesDe(req.user);
    const a = liste.find(x => x.restaurant.id === req.params.id);
    if (!a) return res.status(403).json({ error: 'Accès refusé à ce restaurant' });
    if (perm && !a.permissions.has(perm)) return res.status(403).json({ error: `Permission requise : ${perm}` });
    req.cible = a.restaurant;
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const arrondi5 = (n) => Math.round(n / 5) * 5;

// ── Contexte de l'utilisateur : restaurants accessibles + permissions ──────
router.get('/moi', auth, yakro, async (req, res) => {
  try {
    const liste = await Y.accesDe(req.user);
    res.json({
      restaurants: liste.map(a => ({ ...a.restaurant, profil: a.profil || 'ADMIN', permissions: [...a.permissions] })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/catalogue', auth, yakro, (req, res) => res.json({ permissions: Y.PERMISSIONS, parametres: Y.PARAMETRES }));

// ── Profils ────────────────────────────────────────────────────────────────
router.get('/profils/liste', auth, yakro, async (req, res) => {
  try { res.json(await prisma.profilYakro.findMany({ orderBy: [{ systeme: 'desc' }, { nom: 'asc' }] })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

const permsValides = (arr) => (Array.isArray(arr) ? arr.filter(p => Y.TOUTES.includes(p)) : []);

router.post('/profils', auth, yakro, Y.resto, Y.can('equipe.gerer'), async (req, res) => {
  try {
    const { nom, description, permissions } = req.body;
    if (!nom?.trim()) return res.status(400).json({ error: 'Nom du profil requis' });
    const code = slug(nom);
    if (await prisma.profilYakro.findUnique({ where: { code } })) return res.status(400).json({ error: 'Un profil de ce nom existe déjà' });
    res.status(201).json(await prisma.profilYakro.create({ data: { code, nom: nom.trim(), description: description || null, permissions: permsValides(permissions) } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/profils/:id', auth, yakro, Y.resto, Y.can('equipe.gerer'), async (req, res) => {
  try {
    const { nom, description, permissions } = req.body;
    const data = {};
    if (nom?.trim()) data.nom = nom.trim();
    if (description !== undefined) data.description = description || null;
    if (permissions) data.permissions = permsValides(permissions);
    res.json(await prisma.profilYakro.update({ where: { id: req.params.id }, data }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/profils/:id', auth, yakro, Y.resto, Y.can('equipe.gerer'), async (req, res) => {
  try {
    const p = await prisma.profilYakro.findUnique({ where: { id: req.params.id } });
    if (!p) return res.status(404).json({ error: 'Profil introuvable' });
    if (p.systeme) return res.status(400).json({ error: 'Profil par défaut : modifiable mais non supprimable' });
    if (await prisma.accesRestaurantYakro.count({ where: { profilId: p.id } })) return res.status(400).json({ error: 'Profil encore attribué à des utilisateurs' });
    await prisma.profilYakro.delete({ where: { id: p.id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Utilisateurs que l'on peut affecter à un restaurant
router.get('/utilisateurs/disponibles', auth, yakro, Y.resto, Y.can('equipe.gerer'), async (req, res) => {
  try {
    res.json(await prisma.utilisateur.findMany({
      where: { actif: true, filiale: { in: ['YAKRO_GRILL', 'GROUPE'] } },
      select: { id: true, nom: true, prenom: true, email: true, role: true },
      orderBy: { nom: 'asc' },
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Restaurants ────────────────────────────────────────────────────────────
router.get('/', auth, yakro, async (req, res) => {
  try {
    const liste = await Y.accesDe(req.user);
    const ids = liste.map(a => a.restaurant.id);
    const [tables, commandes] = await Promise.all([
      prisma.tableRestaurant.groupBy({ by: ['restaurantId'], _count: { id: true }, where: { restaurantId: { in: ids } } }),
      prisma.commandeYakro.groupBy({ by: ['restaurantId'], _count: { id: true }, where: { restaurantId: { in: ids }, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);
    const t = Object.fromEntries(tables.map(x => [x.restaurantId, x._count.id]));
    const c = Object.fromEntries(commandes.map(x => [x.restaurantId, x._count.id]));
    res.json(liste.map(a => ({ ...a.restaurant, nbTables: t[a.restaurant.id] || 0, commandesJour: c[a.restaurant.id] || 0 })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Création d'un restaurant : tables, caisse, prix (copiés d'un autre resto ou menu commun), équipe
router.post('/', auth, yakro, Y.resto, Y.can('restaurants.gerer'), async (req, res) => {
  try {
    const { nom, code, ville, adresse, telephone, nbTables = 10, copierPrixDe, pourcentage = 0, gerantId } = req.body;
    if (!nom?.trim()) return res.status(400).json({ error: 'Nom du restaurant requis' });
    const codeFinal = slug(code || nom);
    if (await prisma.restaurantYakro.findUnique({ where: { code: codeFinal } })) return res.status(400).json({ error: `Le code ${codeFinal} existe déjà` });

    const r = await prisma.$transaction(async (tx) => {
      const nouveau = await tx.restaurantYakro.create({ data: { code: codeFinal, nom: nom.trim(), ville: ville || null, adresse: adresse || null, telephone: telephone || null } });
      await tx.caisse.create({ data: { nom: `Caisse ${nouveau.nom}`, filiale: 'YAKRO_GRILL', restaurantId: nouveau.id } });
      const n = Math.min(Math.max(Number(nbTables) || 0, 0), 200);
      if (n) {
        await tx.tableRestaurant.createMany({
          data: Array.from({ length: n }, (_, i) => ({ restaurantId: nouveau.id, numero: i + 1, capacite: 4, zone: 'Salle' })),
        });
      }
      if (copierPrixDe) {
        const src = await tx.prixRestaurantYakro.findMany({ where: { restaurantId: copierPrixDe } });
        const coef = 1 + (Number(pourcentage) || 0) / 100;
        if (src.length) {
          await tx.prixRestaurantYakro.createMany({
            data: src.map(s => ({ restaurantId: nouveau.id, menuId: s.menuId, prix: arrondi5(s.prix * coef), disponible: s.disponible })),
          });
        }
      }
      if (gerantId) {
        const profil = await tx.profilYakro.findUnique({ where: { code: 'GERANT' } });
        if (profil) await tx.accesRestaurantYakro.create({ data: { utilisateurId: gerantId, restaurantId: nouveau.id, profilId: profil.id } });
      }
      return nouveau;
    });
    logger.info('Restaurant Yakro créé', { code: r.code, par: req.user.id });
    res.status(201).json(r);
  } catch (e) { logger.error('POST /yakro/restaurants', { error: e.message }); res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, yakro, cible('parametres.gerer'), async (req, res) => {
  try {
    const { nom, ville, adresse, telephone, devise, tvaTaux, ouverture, fermeture, enteteTicket, piedTicket } = req.body;
    const data = {};
    if (nom?.trim()) data.nom = nom.trim();
    for (const [k, v] of Object.entries({ ville, adresse, telephone, devise, ouverture, fermeture, enteteTicket, piedTicket })) if (v !== undefined) data[k] = v || null;
    if (data.devise === null) data.devise = 'FCFA';
    if (tvaTaux !== undefined) data.tvaTaux = Math.max(0, Number(tvaTaux) || 0);
    res.json(await prisma.restaurantYakro.update({ where: { id: req.params.id }, data }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Désactivation (jamais de suppression : l'historique des ventes est conservé)
router.delete('/:id', auth, yakro, cible('restaurants.gerer'), async (req, res) => {
  try {
    const actifs = await prisma.restaurantYakro.count({ where: { actif: true } });
    if (actifs <= 1) return res.status(400).json({ error: 'Impossible de désactiver le dernier restaurant actif' });
    res.json(await prisma.restaurantYakro.update({ where: { id: req.params.id }, data: { actif: false } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/reactiver', auth, yakro, Y.resto, Y.can('restaurants.gerer'), async (req, res) => {
  try { res.json(await prisma.restaurantYakro.update({ where: { id: req.params.id }, data: { actif: true } })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Prix par restaurant ────────────────────────────────────────────────────
router.get('/:id/prix', auth, yakro, cible('menu.voir'), async (req, res) => {
  try {
    const [menu, prix] = await Promise.all([
      prisma.menuYakro.findMany({ orderBy: [{ categorie: 'asc' }, { nom: 'asc' }] }),
      Y.prixDe(req.params.id),
    ]);
    res.json(menu.map(m => {
      const o = prix.get(m.id);
      return { menuId: m.id, nom: m.nom, categorie: m.categorie, prixBase: m.prix, prix: o ? o.prix : m.prix, disponible: o ? o.disponible : true, personnalise: !!o };
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// items: [{menuId, prix, disponible}] — prix null/vide = retour au prix du menu commun
router.put('/:id/prix', auth, yakro, cible('prix.gerer'), async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const ops = [];
    for (const it of items) {
      if (!it.menuId) continue;
      const where = { restaurantId_menuId: { restaurantId: req.params.id, menuId: it.menuId } };
      if (it.prix === null || it.prix === '' || it.prix === undefined) {
        if (it.disponible === false) {
          const base = await prisma.menuYakro.findUnique({ where: { id: it.menuId }, select: { prix: true } });
          if (!base) continue;
          ops.push(prisma.prixRestaurantYakro.upsert({ where, update: { disponible: false }, create: { restaurantId: req.params.id, menuId: it.menuId, prix: base.prix, disponible: false } }));
        } else ops.push(prisma.prixRestaurantYakro.deleteMany({ where: { restaurantId: req.params.id, menuId: it.menuId } }));
        continue;
      }
      const prix = Number(it.prix);
      if (!(prix >= 0)) return res.status(400).json({ error: 'Prix invalide' });
      const disponible = it.disponible !== false;
      ops.push(prisma.prixRestaurantYakro.upsert({ where, update: { prix, disponible }, create: { restaurantId: req.params.id, menuId: it.menuId, prix, disponible } }));
    }
    await prisma.$transaction(ops);
    res.json({ ok: true, modifies: ops.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Copier les prix d'un autre restaurant (avec ajustement en %)
router.post('/:id/prix/copier', auth, yakro, cible('prix.gerer'), async (req, res) => {
  try {
    const { depuisId, pourcentage = 0 } = req.body;
    if (!depuisId) return res.status(400).json({ error: 'Restaurant source requis' });
    const liste = await Y.accesDe(req.user);
    if (!liste.some(a => a.restaurant.id === depuisId)) return res.status(403).json({ error: 'Accès refusé au restaurant source' });
    const [menu, srcMap] = await Promise.all([prisma.menuYakro.findMany(), Y.prixDe(depuisId)]);
    const coef = 1 + (Number(pourcentage) || 0) / 100;
    const ops = menu.map(m => {
      const s = srcMap.get(m.id);
      const prix = arrondi5((s ? s.prix : m.prix) * coef);
      const disponible = s ? s.disponible : true;
      return prisma.prixRestaurantYakro.upsert({
        where: { restaurantId_menuId: { restaurantId: req.params.id, menuId: m.id } },
        update: { prix, disponible }, create: { restaurantId: req.params.id, menuId: m.id, prix, disponible },
      });
    });
    await prisma.$transaction(ops);
    res.json({ ok: true, copies: ops.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Paramètres ─────────────────────────────────────────────────────────────
router.get('/:id/parametres', auth, yakro, cible(), async (req, res) => {
  try { res.json(await Y.parametresDe(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/parametres', auth, yakro, cible('parametres.gerer'), async (req, res) => {
  try {
    const valides = new Set(Y.PARAMETRES.map(p => p.cle));
    const images = new Set(Y.PARAMETRES.filter(p => p.type === 'image').map(p => p.cle));
    for (const [k, v] of Object.entries(req.body || {})) {
      if (images.has(k) && v && (!/^data:image\/(png|jpeg|webp);base64,/.test(v) || v.length > 700000)) {
        return res.status(400).json({ error: 'Image invalide (PNG, JPEG ou WebP, 500 Ko maximum)' });
      }
    }
    const ops = Object.entries(req.body || {}).filter(([k]) => valides.has(k)).map(([cle, v]) => {
      const valeur = typeof v === 'boolean' ? (v ? '1' : '0') : String(v ?? '');
      return prisma.parametreRestaurantYakro.upsert({
        where: { restaurantId_cle: { restaurantId: req.params.id, cle } },
        update: { valeur }, create: { restaurantId: req.params.id, cle, valeur },
      });
    });
    await prisma.$transaction(ops);
    res.json(await Y.parametresDe(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Équipe (utilisateurs affectés + profil) ────────────────────────────────
router.get('/:id/equipe', auth, yakro, cible('equipe.gerer'), async (req, res) => {
  try {
    const acces = await prisma.accesRestaurantYakro.findMany({ where: { restaurantId: req.params.id }, include: { profil: true } });
    const users = await prisma.utilisateur.findMany({
      where: { id: { in: acces.map(a => a.utilisateurId) } },
      select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true },
    });
    const u = Object.fromEntries(users.map(x => [x.id, x]));
    res.json(acces.map(a => ({ id: a.id, utilisateur: u[a.utilisateurId], profil: { id: a.profil.id, code: a.profil.code, nom: a.profil.nom } })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/equipe', auth, yakro, cible('equipe.gerer'), async (req, res) => {
  try {
    const { utilisateurId, profilId } = req.body;
    if (!utilisateurId || !profilId) return res.status(400).json({ error: 'utilisateurId et profilId requis' });
    const acces = await prisma.accesRestaurantYakro.upsert({
      where: { utilisateurId_restaurantId: { utilisateurId, restaurantId: req.params.id } },
      update: { profilId }, create: { utilisateurId, restaurantId: req.params.id, profilId },
    });
    res.json(acces);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/equipe/:utilisateurId', auth, yakro, cible('equipe.gerer'), async (req, res) => {
  try {
    await prisma.accesRestaurantYakro.deleteMany({ where: { restaurantId: req.params.id, utilisateurId: req.params.utilisateurId } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
