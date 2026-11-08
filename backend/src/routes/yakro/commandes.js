const router = require('express').Router();
const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const { auth, requireFiliale } = require('../../middleware/auth');
const { VALIDATORS } = require('../../middleware/validate');
const { resto, can, sc, prixDe, parametresDe, MODE_PARAM, TYPE_PARAM, ROLES_ADMIN } = require('../../lib/yakro-resto');
const { deduireStock, restituerStock } = require('../../lib/stock-menu');
const yakro = requireFiliale('YAKRO_GRILL');
const pc = (req) => (req.restaurantId ? { commande: { restaurantId: req.restaurantId } } : {});

// GET /api/yakro/commandes
router.get('/', auth, yakro, resto, async (req, res) => {
  try {
    const { statut, date, tableId, page = 1, limit = 50, dateDebut, dateFin } = req.query;
    const where = { ...sc(req) };
    if (statut) where.statut = statut;
    if (tableId) where.tableId = tableId;
    if (date) {
      const d = new Date(date);
      where.createdAt = { gte: new Date(new Date(d).setHours(0,0,0,0)), lte: new Date(new Date(d).setHours(23,59,59,999)) };
    } else if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin) where.createdAt.lte = new Date(dateFin);
    }
    const [total, commandes] = await Promise.all([
      prisma.commandeYakro.count({ where }),
      prisma.commandeYakro.findMany({
        where, skip: (Number(page)-1)*Number(limit), take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { table: true, lignes: { include: { menu: true } }, paiements: true, caisseTransaction: true }
      })
    ]);
    const rets = commandes.length ? await prisma.retourArticleYakro.findMany({ where: { commandeId: { in: commandes.map(c => c.id) } }, orderBy: { createdAt: 'asc' } }).catch(() => []) : [];
    for (const c of commandes) c.retours = rets.filter(r => r.commandeId === c.id);
    res.json({ data: commandes, total, page: Number(page), pages: Math.ceil(total/Number(limit)) });
  } catch (e) { logger.error('GET /yakro/commandes', { error: e.message }); res.status(500).json({ error: e.message }); }
});

// GET caisse du jour
router.get('/caisse', auth, yakro, resto, async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const debut = dateDebut ? new Date(dateDebut) : new Date(new Date().setHours(0,0,0,0));
    const fin = dateFin ? new Date(dateFin) : new Date(new Date().setHours(23,59,59,999));

    const [caTotal, nbCommandes, parType, parStatut] = await Promise.all([
      prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: debut, lte: fin }, ...pc(req) } }),
      prisma.commandeYakro.count({ where: { statut: 'PAYEE', createdAt: { gte: debut }, ...sc(req) } }),
      prisma.paiementYakro.groupBy({ by: ['type'], _sum: { montant: true }, where: { createdAt: { gte: debut, lte: fin }, ...pc(req) } }),
      prisma.commandeYakro.groupBy({ by: ['statut'], _count: { id: true }, where: { createdAt: { gte: debut, lte: fin }, ...sc(req) } }),
    ]);

    const ca = caTotal._sum.montant || 0;
    // Écart de caisse : différence entre CA théorique (commandes PAYEE) et paiements enregistrés
    const caTheorique = await prisma.commandeYakro.aggregate({ _sum: { total: true }, where: { statut: 'PAYEE', createdAt: { gte: debut }, ...sc(req) } });
    const ecartCaisse = (caTheorique._sum.total || 0) - ca;

    res.json({
      caJour: ca, caTheorique: caTheorique._sum.total || 0,
      ecartCaisse, nbCommandes, parType, parStatut,
      reinvestissement: { cuisine: ca * 0.50, boisson: ca * 0.45, bar: ca * 0.45 },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/yakro/commandes — Nouvelle commande (prix et règles du restaurant courant)
router.post('/', auth, yakro, resto, can('commande.creer'), VALIDATORS.commande, async (req, res) => {
  try {
    const { tableId, type, nbCouverts, lignes, notes, serveurId, serveurNom, remise = 0 } = req.body;
    const params = await parametresDe(req.restaurantId);
    const typeCmd = type || 'SUR_PLACE';
    if (TYPE_PARAM[typeCmd] && params[TYPE_PARAM[typeCmd]] !== '1') return res.status(400).json({ error: `Le mode « ${typeCmd} » n'est pas activé dans ce restaurant` });
    if (params.couverts_obligatoires === '1' && typeCmd === 'SUR_PLACE' && !(Number(nbCouverts) > 0)) return res.status(400).json({ error: 'Nombre de couverts obligatoire' });
    if (tableId) {
      const t = await prisma.tableRestaurant.findFirst({ where: { id: tableId, ...sc(req) } });
      if (!t) return res.status(400).json({ error: 'Table introuvable dans ce restaurant' });
    }

    const prixResto = await prixDe(req.restaurantId);
    let sousTotal = 0;
    const lignesData = [];
    for (const l of lignes) {
      const item = await prisma.menuYakro.findUnique({ where: { id: l.menuId } });
      if (!item) continue;
      const o = prixResto.get(item.id);
      if (!item.disponible || (o && !o.disponible)) return res.status(400).json({ error: `Article "${item.nom}" indisponible (rupture ou hors menu)` });
      const prix = l.prixUnitaire || (o ? o.prix : item.prix);
      sousTotal += prix * l.quantite;
      lignesData.push({ menuId: l.menuId, quantite: l.quantite, prixUnitaire: prix, notes: l.notes });
    }

    if (lignesData.length === 0) return res.status(400).json({ error: 'Aucun article valide dans la commande' });

    const remiseMontant = Math.min(Number(remise) || 0, sousTotal);
    if (remiseMontant > 0 && !req.permissions.has('commande.remise')) return res.status(403).json({ error: "Vous n'avez pas le droit d'accorder une remise" });
    const maxPct = Number(params.remise_max_pct);
    if (remiseMontant > 0 && !ROLES_ADMIN.includes(req.user.role) && maxPct >= 0 && remiseMontant > sousTotal * maxPct / 100) {
      return res.status(400).json({ error: `Remise maximale autorisée : ${maxPct} %` });
    }
    const total = sousTotal - remiseMontant;

    const numero = `${req.restaurant?.code || 'YG'}-${Date.now()}`;
    // Création + déduction du stock des boissons dans la même transaction
    const commande = await prisma.$transaction(async (tx) => {
      await deduireStock(tx, lignesData, numero);
      return tx.commandeYakro.create({
        data: { numero, restaurantId: req.restaurantId, tableId, serveurId: serveurId || req.user.id, serveurNom: serveurNom || null, type: typeCmd,
                nbCouverts: nbCouverts || 1, sousTotal, remise: remiseMontant, total, notes,
                lignes: { create: lignesData } },
        include: { table: true, lignes: true }
      });
    });

    if (tableId) await prisma.tableRestaurant.update({ where: { id: tableId }, data: { statut: 'OCCUPEE' } });

    logger.info('Commande créée', { numero, total, serveurId: req.user.id, restaurant: req.restaurant?.code });
    res.status(201).json(commande);
  } catch (e) { logger.error('POST /yakro/commandes', { error: e.message }); res.status(e.statut || 500).json({ error: e.message }); }
});

// PUT /:id/statut
router.put('/:id/statut', auth, yakro, resto, async (req, res) => {
  try {
    if (!await prisma.commandeYakro.findFirst({ where: { id: req.params.id, ...sc(req) }, select: { id: true } })) return res.status(404).json({ error: 'Commande introuvable' });
    const commande = await prisma.commandeYakro.update({
      where: { id: req.params.id }, data: { statut: req.body.statut }
    });
    if (['PAYEE', 'ANNULEE'].includes(req.body.statut) && commande.tableId) {
      await prisma.tableRestaurant.update({ where: { id: commande.tableId }, data: { statut: 'LIBRE' } });
    }
    res.json(commande);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/payer — Paiement mixte complet
router.post('/:id/payer', auth, yakro, resto, can('commande.encaisser'), VALIDATORS.paiementMixte, async (req, res) => {
  try {
    const { paiements } = req.body;
    const commande = await prisma.commandeYakro.findFirst({ where: { id: req.params.id, ...sc(req) } });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (commande.statut === 'PAYEE') return res.status(400).json({ error: 'Commande déjà payée' });
    if (commande.statut === 'ANNULEE') return res.status(400).json({ error: 'Impossible de payer une commande annulée' });

    const params = await parametresDe(req.restaurantId);
    for (const p of paiements) {
      const cle = MODE_PARAM[p.typePaiement];
      if (cle && params[cle] !== '1') return res.status(400).json({ error: `Mode de paiement non accepté dans ce restaurant : ${p.typePaiement}` });
    }
    if (params.session_obligatoire === '1' && !await prisma.sessionCaisseYakro.findFirst({ where: { statut: 'OUVERTE', ...sc(req) } })) {
      return res.status(400).json({ error: "Ouvrez d'abord la session de caisse" });
    }
    // Référence facultative : sans saisie, on génère une référence interne (le caissier confirme sur le téléphone du restaurant)
    paiements.forEach((p, i) => { if (p.typePaiement !== 'ESPECES' && !String(p.reference || '').trim()) p.reference = `AUTO-${commande.numero}-${p.typePaiement}-${i + 1}`; });
    const totalPaye = paiements.reduce((s, p) => s + Number(p.montant), 0);
    if (Math.abs(totalPaye - commande.total) > 1) {
      return res.status(400).json({ error: `Somme paiements (${totalPaye} F) ≠ total commande (${commande.total} F)` });
    }

    // Paiement mixte : la monnaie ne porte que sur la part payée en espèces
    const partEspeces = paiements.filter(p => p.typePaiement === 'ESPECES').reduce((a, p) => a + Number(p.montant), 0);
    const especesRecues = Number(req.body.especesRecues || 0);
    // Pourboire : en plus du total (jamais compté dans le chiffre d'affaires), payé en espèces ou par mobile money
    const pourboire = Math.max(0, Math.min(Number(req.body.pourboire) || 0, commande.total * 5 + 100000));
    const tipEspeces = req.body.modePourboire === 'ESPECES' ? pourboire : 0;
    if (partEspeces > 0 && especesRecues > 0 && especesRecues < partEspeces + tipEspeces - 0.5) {
      return res.status(400).json({ error: `Espèces reçues (${especesRecues} F) inférieures à la part en espèces + pourboire (${partEspeces + tipEspeces} F)` });
    }
    const monnaieRendue = partEspeces > 0 && especesRecues > partEspeces + tipEspeces ? especesRecues - partEspeces - tipEspeces : 0;

    const result = await prisma.$transaction(async (tx) => {
      const cmdMaj = await tx.commandeYakro.update({
        where: { id: req.params.id },
        data: { statut: 'PAYEE', typePaiement: paiements[0].typePaiement, payeeLe: new Date(), pourboire }
      });
      const paiementsCreees = await Promise.all(paiements.map(p => tx.paiementYakro.create({
        data: { commandeId: req.params.id, montant: Number(p.montant), type: p.typePaiement, reference: p.reference || null }
      })));
      const caisseT = await tx.caisseTransaction.create({
        data: { commandeId: req.params.id, totalCommande: commande.total,
                especesRecues: partEspeces > 0 ? (especesRecues || partEspeces) : 0, monnaieRendue,
                estMixte: paiements.length > 1 }
      });
      const caisse = await tx.caisse.findFirst({ where: { filiale: 'YAKRO_GRILL', actif: true, ...sc(req) } });
      if (caisse) {
        await tx.caisse.update({ where: { id: caisse.id }, data: { solde: { increment: commande.total } } });
        await Promise.all(paiements.map(p => tx.encaissement.create({
          data: { caisseId: caisse.id, filiale: 'YAKRO_GRILL', montant: Number(p.montant),
                  typePaiement: p.typePaiement, reference: p.reference || null,
                  motif: `Commande ${commande.numero}`, entiteRef: commande.id, entiteType: 'commande', operateurId: req.user.id }
        })));
      }
      if (commande.tableId) await tx.tableRestaurant.update({ where: { id: commande.tableId }, data: { statut: 'LIBRE' } });
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'YAKRO_GRILL', action: 'PAIEMENT', entite: 'CommandeYakro', entiteId: commande.id, entiteLabel: `Commande ${commande.numero} — ${commande.total.toLocaleString('fr')} F`, apres: { statut: 'PAYEE', paiements, total: commande.total } } });
      return { commande: cmdMaj, paiements: paiementsCreees, caisseTransaction: caisseT };
    });
    logger.info('Commande payée', { numero: commande.numero, total: commande.total });
    res.json(result);
  } catch (e) { logger.error('POST /payer', { error: e.message }); res.status(500).json({ error: e.message }); }
});

// PUT /:id/remise — Appliquer une remise commerciale
router.put('/:id/remise', auth, yakro, resto, can('commande.remise'), async (req, res) => {
  try {
    const { remise, motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif de remise obligatoire' });
    const remiseMontant = Number(remise);
    if (isNaN(remiseMontant) || remiseMontant < 0) return res.status(400).json({ error: 'Montant remise invalide' });

    const commande = await prisma.commandeYakro.findFirst({ where: { id: req.params.id, ...sc(req) } });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (commande.statut === 'PAYEE') return res.status(400).json({ error: 'Commande déjà payée — remise impossible' });
    if (remiseMontant > commande.sousTotal) return res.status(400).json({ error: `Remise (${remiseMontant} F) > sous-total (${commande.sousTotal} F)` });

    const updated = await prisma.commandeYakro.update({
      where: { id: req.params.id },
      data: { remise: remiseMontant, total: commande.sousTotal - remiseMontant, notes: `${commande.notes || ''} | Remise: ${motif}` }
    });
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'YAKRO_GRILL', action: 'UPDATE', entite: 'CommandeYakro', entiteId: commande.id, entiteLabel: `Remise ${remiseMontant} F — ${motif}`, avant: { remise: commande.remise, total: commande.total }, apres: { remise: remiseMontant, total: commande.sousTotal - remiseMontant } } });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/offert — Marquer comme offert client (perte stock)
router.post('/:id/offert', auth, yakro, resto, can('commande.remise'), async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif obligatoire pour un offert client' });
    const updated = await prisma.commandeYakro.update({
      where: { id: req.params.id },
      data: { remise: (await prisma.commandeYakro.findFirst({ where: { id: req.params.id, ...sc(req) } })).total, total: 0, statut: 'PAYEE', notes: `OFFERT CLIENT: ${motif}`, payeeLe: new Date() }
    });
    if (updated.tableId) await prisma.tableRestaurant.update({ where: { id: updated.tableId }, data: { statut: 'LIBRE' } });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id — Annulation avec motif obligatoire
router.delete('/:id', auth, yakro, resto, can('commande.annuler'), async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif d\'annulation obligatoire' });
    const commande = await prisma.commandeYakro.findFirst({ where: { id: req.params.id, ...sc(req) } });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (commande.statut === 'PAYEE') return res.status(400).json({ error: 'Commande payée — annulation impossible. Demander un remboursement.' });

    await prisma.$transaction(async (tx) => {
      if (commande.statut !== 'ANNULEE') await restituerStock(tx, commande.id, commande.numero);
      await tx.commandeYakro.update({ where: { id: req.params.id }, data: { statut: 'ANNULEE', notes: `${commande.notes || ''} | ANNULATION: ${motif}` } });
    });
    if (commande.tableId) await prisma.tableRestaurant.update({ where: { id: commande.tableId }, data: { statut: 'LIBRE' } });
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'YAKRO_GRILL', action: 'DELETE', entite: 'CommandeYakro', entiteId: commande.id, entiteLabel: `Annulation: ${motif}`, avant: { statut: commande.statut } } });
    res.json({ message: 'Commande annulée', motif });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/rembourser — Remboursement après paiement (si erreur caisse)
router.post('/:id/rembourser', auth, yakro, resto, can('commande.rembourser'), async (req, res) => {
  try {
    const { motif, montant } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif de remboursement obligatoire' });
    const commande = await prisma.commandeYakro.findFirst({ where: { id: req.params.id, ...sc(req) }, include: { paiements: true } });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (commande.statut !== 'PAYEE') return res.status(400).json({ error: 'Seule une commande payée peut être remboursée' });

    const montantRemboursement = Number(montant) || commande.total;
    const caisse = await prisma.caisse.findFirst({ where: { filiale: 'YAKRO_GRILL', actif: true, ...sc(req) } });
    if (caisse && caisse.solde < montantRemboursement) return res.status(400).json({ error: `Solde caisse insuffisant (${caisse.solde.toLocaleString('fr')} F) pour rembourser ${montantRemboursement.toLocaleString('fr')} F` });

    await prisma.$transaction(async (tx) => {
      await tx.commandeYakro.update({ where: { id: req.params.id }, data: { statut: 'REMBOURSE', notes: `${commande.notes || ''} | REMBOURSEMENT: ${motif}` } });
      if (caisse) {
        await tx.decaissement.create({ data: { caisseId: caisse.id, filiale: 'YAKRO_GRILL', montant: montantRemboursement, typePaiement: 'ESPECES', motif: `Remboursement cmd ${commande.numero}: ${motif}`, categorie: 'REMBOURSEMENT', valide: true, validePar: req.user.id } });
        await tx.caisse.update({ where: { id: caisse.id }, data: { solde: { decrement: montantRemboursement } } });
      }
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'YAKRO_GRILL', action: 'REMBOURSE', entite: 'CommandeYakro', entiteId: commande.id, entiteLabel: `Remboursement ${montantRemboursement} F: ${motif}`, avant: { statut: 'PAYEE' }, apres: { statut: 'REMBOURSE' } } });
    });
    res.json({ message: 'Remboursement effectué', montant: montantRemboursement });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET stats + KPI
router.get('/stats', auth, yakro, resto, async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const debut = dateDebut ? new Date(dateDebut) : new Date(new Date().setHours(0,0,0,0));
    const [total, payees, annulees, remises, ca] = await Promise.all([
      prisma.commandeYakro.count({ where: { createdAt: { gte: debut }, ...sc(req) } }),
      prisma.commandeYakro.count({ where: { statut: 'PAYEE', createdAt: { gte: debut }, ...sc(req) } }),
      prisma.commandeYakro.count({ where: { statut: 'ANNULEE', createdAt: { gte: debut }, ...sc(req) } }),
      prisma.commandeYakro.aggregate({ _sum: { remise: true }, where: { createdAt: { gte: debut }, ...sc(req) } }),
      prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: debut }, ...pc(req) } }),
    ]);
    res.json({ total, payees, annulees, remises: remises._sum.remise || 0, ca: ca._sum.montant || 0, tauxConversion: total > 0 ? Math.round(payees/total*100) : 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// POST /:id/ajouter-lignes — Ajouter des articles à une commande EN_COURS
router.post('/:id/ajouter-lignes', auth, yakro, resto, async (req, res) => {
  try {
    const { lignes, notes } = req.body;
    const commande = await prisma.commandeYakro.findFirst({ where: { id: req.params.id, ...sc(req) } });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (commande.statut === 'PAYEE') return res.status(400).json({ error: 'Commande déjà payée' });
    if (commande.statut === 'ANNULEE') return res.status(400).json({ error: 'Commande annulée' });

    const lignesData = [];
    let ajout = 0;
    const prixResto = await prixDe(req.restaurantId);
    for (const l of lignes) {
      const item = await prisma.menuYakro.findUnique({ where: { id: l.menuId || l.id } });
      const o = item && prixResto.get(item.id);
      if (!item || !item.disponible || (o && !o.disponible)) continue;
      const prix = l.prixUnitaire || l.prix || (o ? o.prix : item.prix);
      ajout += prix * (l.quantite || 1);
      lignesData.push({ commandeId: req.params.id, menuId: item.id, quantite: l.quantite || 1, prixUnitaire: prix, notes: l.notes });
    }

    if (lignesData.length === 0) return res.status(400).json({ error: 'Aucun article valide' });

    await prisma.$transaction(async (tx) => {
      await deduireStock(tx, lignesData, commande.numero);
      await tx.ligneCommandeYakro.createMany({ data: lignesData });
      await tx.commandeYakro.update({
        where: { id: req.params.id },
        data: {
          sousTotal: { increment: ajout },
          total: { increment: ajout },
          notes: notes ? `${commande.notes || ''} | ${notes}` : commande.notes,
        }
      });
    });

    const updated = await prisma.commandeYakro.findUnique({
      where: { id: req.params.id },
      include: { lignes: { include: { menu: true } }, table: true }
    });
    res.json(updated);
  } catch (e) { res.status(e.statut || 500).json({ error: e.message }); }
});

// GET /yakro/caisse-detail — Caisse du jour avec départage Bar/Cuisine
router.get('/caisse-detail', auth, yakro, resto, async (req, res) => {
  try {
    const auj = new Date(); auj.setHours(0,0,0,0);
    const demain = new Date(auj); demain.setDate(demain.getDate()+1);

    const CATS_BAR = ['BIERE','VIN','CHAMPAGNE','COCKTAIL_ALCOOLISE','COCKTAIL_SANS_ALCOOL','SUCRERIE','TISANE'];

    const lignes = await prisma.ligneCommandeYakro.findMany({
      where: { commande: { statut: 'PAYEE', createdAt: { gte: auj, lt: demain }, ...sc(req) } },
      include: { menu: { select: { categorie: true, nom: true } } }
    });

    let totalBar = 0, totalCuisine = 0;
    const parCateg = {};

    for (const l of lignes) {
      const montant = l.prixUnitaire * l.quantite;
      const isBar = CATS_BAR.includes(l.menu?.categorie);
      if (isBar) totalBar += montant;
      else totalCuisine += montant;
      
      const cat = l.menu?.categorie || 'AUTRE';
      parCateg[cat] = (parCateg[cat] || 0) + montant;
    }

    const paiements = await prisma.paiementYakro.groupBy({
      by: ['type'],
      _sum: { montant: true },
      where: { createdAt: { gte: auj, lt: demain }, ...pc(req) }
    });

    const nbCommandes = await prisma.commandeYakro.count({ where: { statut: 'PAYEE', createdAt: { gte: auj, lt: demain }, ...sc(req) } });

    res.json({
      totalJour: totalBar + totalCuisine,
      totalBar, totalCuisine,
      pctBar: totalBar + totalCuisine > 0 ? Math.round(totalBar / (totalBar + totalCuisine) * 100) : 0,
      pctCuisine: totalBar + totalCuisine > 0 ? Math.round(totalCuisine / (totalBar + totalCuisine) * 100) : 0,
      nbCommandes,
      parCategorie: Object.entries(parCateg).sort((a,b)=>b[1]-a[1]).map(([cat, montant]) => ({ categorie: cat, montant, isBar: CATS_BAR.includes(cat) })),
      parPaiement: paiements.map(p => ({ type: p.type, montant: p._sum.montant || 0 })),
      reinvestissement: { bar: Math.round(totalBar * 0.5), cuisine: Math.round(totalCuisine * 0.5), total: Math.round((totalBar + totalCuisine) * 0.5) },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /yakro/commandes/historique — Historique des passages caisse
router.get('/historique', auth, yakro, resto, async (req, res) => {
  try {
    const { dateDebut, dateFin, limit = 100 } = req.query;
    const auj = new Date(); auj.setHours(0,0,0,0);
    const debut = dateDebut ? new Date(dateDebut) : auj;
    const fin = dateFin ? new Date(dateFin) : new Date();

    const commandes = await prisma.commandeYakro.findMany({
      where: { statut: 'PAYEE', createdAt: { gte: debut, lte: fin }, ...sc(req) },
      include: {
        table: { select: { numero: true, zone: true } },
        lignes: { include: { menu: { select: { nom: true, categorie: true } } } },
        paiements: { select: { montant: true, type: true, reference: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    res.json(commandes.map(c => ({
      id: c.id,
      numero: c.numero,
      table: c.table ? `Table ${c.table.numero} — ${c.table.zone}` : 'Emporter',
      serveurNom: c.serveurNom || '—',
      nbCouverts: c.nbCouverts || 1,
      total: c.total || 0,
      lignes: c.lignes.map(l => ({
        nom: l.menu?.nom || '?',
        categorie: l.menu?.categorie || '?',
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        sous_total: l.quantite * l.prixUnitaire,
      })),
      paiements: c.paiements.map(p => ({ montant: p.montant, type: p.type, reference: p.reference })),
      createdAt: c.createdAt,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
