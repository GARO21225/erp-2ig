// ── TABLES
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const yakro = requireFiliale('YAKRO_GRILL');

router.get('/', auth, yakro, async (req, res) => {
  try {
    const tables = await prisma.tableRestaurant.findMany({
      orderBy: { numero: 'asc' },
      include: {
        commandes: {
          where: { statut: { in: ['EN_COURS', 'CUISINE', 'PRETE', 'SERVIE'] } },
          take: 1,
          include: {
            lignes: { include: { menu: true } }
          },
          // serveurId disponible dans la commande pour affichage côté frontend
        },
        reservations: {
          where: {
            statut: 'CONFIRMEE',
            dateHeure: { gte: new Date(), lte: new Date(Date.now() + 4 * 3600000) }
          },
          take: 1
        }
      }
    });
    res.json(tables);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, yakro, async (req, res) => {
  try {
    const table = await prisma.tableRestaurant.create({ data: req.body });
    res.status(201).json(table);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/statut', auth, yakro, async (req, res) => {
  try {
    const table = await prisma.tableRestaurant.update({
      where: { id: req.params.id },
      data: { statut: req.body.statut }
    });
    res.json(table);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// PUT /:id — Modifier une table
router.put('/:id', auth, yakro, async (req, res) => {
  try {
    const t = await prisma.tableRestaurant.update({ where: { id: req.params.id }, data: req.body });
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id — Supprimer une table
router.delete('/:id', auth, yakro, async (req, res) => {
  try {
    const t = await prisma.tableRestaurant.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ error: 'Table introuvable' });
    if (t.statut === 'OCCUPEE') return res.status(400).json({ error: 'Table occupée — impossible de la supprimer' });
    await prisma.tableRestaurant.delete({ where: { id: req.params.id } });
    res.json({ message: 'Table supprimée' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /tables/:id/assigner-serveur
router.put('/:id/assigner-serveur', auth, yakro, async (req, res) => {
  try {
    const { serveurId, serveurNom } = req.body;
    if (!serveurId) return res.status(400).json({ error: 'serveurId requis' });
    const old = await prisma.tableRestaurant.findUnique({ where: { id: req.params.id } });
    const table = await prisma.tableRestaurant.update({
      where: { id: req.params.id },
      data: {
        serveurId,
        serveurNom: serveurNom || null,
        heureOuverture: old?.statut === 'LIBRE' ? new Date() : old?.heureOuverture,
        statut: 'OCCUPEE',
      }
    });
    // Historiser si changement
    if (old?.serveurId && old.serveurId !== serveurId) {
      await prisma.changementServeurYakro.create({
        data: {
          tableId: req.params.id,
          ancienServeurId: old.serveurId,
          ancienServeurNom: old.serveurNom,
          nouveauServeurId: serveurId,
          nouveauServeurNom: serveurNom,
          changesParId: req.user.id,
          changesParNom: `${req.user.prenom} ${req.user.nom}`,
        }
      });
    }
    res.json(table);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /tables/:id/cloturer — Libérer une table
router.put('/:id/cloturer', auth, yakro, async (req, res) => {
  try {
    const table = await prisma.tableRestaurant.update({
      where: { id: req.params.id },
      data: { statut: 'NETTOYAGE', serveurId: null, serveurNom: null, heureOuverture: null }
    });
    // Marquer comme LIBRE après 1 minute (ici direct)
    setTimeout(async () => {
      await prisma.tableRestaurant.update({ where: { id: req.params.id }, data: { statut: 'LIBRE' } }).catch(() => {});
    }, 60000);
    res.json(table);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /tables/transferer — Transférer une commande vers une autre table
router.post('/transferer', auth, yakro, async (req, res) => {
  try {
    const { commandeId, tableSourceId, tableCibleId } = req.body;
    if (!commandeId || !tableCibleId) return res.status(400).json({ error: 'commandeId et tableCibleId requis' });
    const tableCible = await prisma.tableRestaurant.findUnique({ where: { id: tableCibleId } });
    if (!tableCible || tableCible.statut === 'OCCUPEE') return res.status(400).json({ error: 'Table cible indisponible' });
    await prisma.$transaction([
      prisma.commandeYakro.update({ where: { id: commandeId }, data: { tableId: tableCibleId } }),
      prisma.tableRestaurant.update({ where: { id: tableCibleId }, data: { statut: 'OCCUPEE' } }),
      ...(tableSourceId ? [prisma.tableRestaurant.update({ where: { id: tableSourceId }, data: { statut: 'LIBRE', serveurId: null, serveurNom: null, heureOuverture: null } })] : []),
    ]);
    res.json({ message: 'Transfert effectué' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /tables/historique-serveurs — Historique changements serveur
router.get('/historique-serveurs', auth, yakro, async (req, res) => {
  try {
    const historique = await prisma.changementServeurYakro.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(historique);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
