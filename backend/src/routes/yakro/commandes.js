const router = require('express').Router();
const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const { auth, requireFiliale } = require('../../middleware/auth');
const { VALIDATORS } = require('../../middleware/validate');
const yakro = requireFiliale('YAKRO_GRILL');

// GET /api/yakro/commandes
router.get('/', auth, yakro, async (req, res) => {
  try {
    const { statut, date, tableId, page = 1, limit = 50, dateDebut, dateFin } = req.query;
    const where = {};
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
    res.json({ data: commandes, total, page: Number(page), pages: Math.ceil(total/Number(limit)) });
  } catch (e) { logger.error('GET /yakro/commandes', { error: e.message }); res.status(500).json({ error: e.message }); }
});

// GET caisse du jour
router.get('/caisse', auth, yakro, async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const debut = dateDebut ? new Date(dateDebut) : new Date(new Date().setHours(0,0,0,0));
    const fin = dateFin ? new Date(dateFin) : new Date(new Date().setHours(23,59,59,999));

    const [caTotal, nbCommandes, parType, parStatut] = await Promise.all([
      prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: debut, lte: fin } } }),
      prisma.commandeYakro.count({ where: { statut: 'PAYEE', createdAt: { gte: debut } } }),
      prisma.paiementYakro.groupBy({ by: ['type'], _sum: { montant: true }, where: { createdAt: { gte: debut, lte: fin } } }),
      prisma.commandeYakro.groupBy({ by: ['statut'], _count: { id: true }, where: { createdAt: { gte: debut, lte: fin } } }),
    ]);

    const ca = caTotal._sum.montant || 0;
    // Écart de caisse : différence entre CA théorique (commandes PAYEE) et paiements enregistrés
    const caTheorique = await prisma.commandeYakro.aggregate({ _sum: { total: true }, where: { statut: 'PAYEE', createdAt: { gte: debut } } });
    const ecartCaisse = (caTheorique._sum.total || 0) - ca;

    res.json({
      caJour: ca, caTheorique: caTheorique._sum.total || 0,
      ecartCaisse, nbCommandes, parType, parStatut,
      reinvestissement: { cuisine: ca * 0.50, boisson: ca * 0.45, bar: ca * 0.45 },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/yakro/commandes — Nouvelle commande
router.post('/', auth, yakro, VALIDATORS.commande, async (req, res) => {
  try {
    const { tableId, type, nbCouverts, lignes, notes, serveurId, remise = 0 } = req.body;

    let sousTotal = 0;
    const lignesData = [];
    for (const l of lignes) {
      const item = await prisma.menuYakro.findUnique({ where: { id: l.menuId } });
      if (!item) continue;
      if (!item.disponible) return res.status(400).json({ error: `Article "${item.nom}" indisponible (rupture ou hors menu)` });
      const prix = l.prixUnitaire || item.prix;
      sousTotal += prix * l.quantite;
      lignesData.push({ menuId: l.menuId, quantite: l.quantite, prixUnitaire: prix, notes: l.notes });
    }

    if (lignesData.length === 0) return res.status(400).json({ error: 'Aucun article valide dans la commande' });

    const remiseMontant = Math.min(Number(remise) || 0, sousTotal);
    const total = sousTotal - remiseMontant;

    const numero = `YG-${Date.now()}`;
    const commande = await prisma.commandeYakro.create({
      data: { numero, tableId, serveurId: serveurId || req.user.id, type: type || 'SUR_PLACE',
              nbCouverts: nbCouverts || 1, sousTotal, remise: remiseMontant, total, notes,
              lignes: { create: lignesData } },
      include: { table: true, lignes: true }
    });

    if (tableId) await prisma.tableRestaurant.update({ where: { id: tableId }, data: { statut: 'OCCUPEE' } });

    logger.info('Commande créée', { numero, total, serveurId: req.user.id });
    res.status(201).json(commande);
  } catch (e) { logger.error('POST /yakro/commandes', { error: e.message }); res.status(500).json({ error: e.message }); }
});

// PUT /:id/statut
router.put('/:id/statut', auth, yakro, async (req, res) => {
  try {
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
router.post('/:id/payer', auth, yakro, VALIDATORS.paiementMixte, async (req, res) => {
  try {
    const { paiements, especesRecues, monnaieRendue } = req.body;
    const commande = await prisma.commandeYakro.findUnique({ where: { id: req.params.id } });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (commande.statut === 'PAYEE') return res.status(400).json({ error: 'Commande déjà payée' });
    if (commande.statut === 'ANNULEE') return res.status(400).json({ error: 'Impossible de payer une commande annulée' });

    const totalPaye = paiements.reduce((s, p) => s + Number(p.montant), 0);
    if (Math.abs(totalPaye - commande.total) > 1) {
      return res.status(400).json({ error: `Somme paiements (${totalPaye} F) ≠ total commande (${commande.total} F)` });
    }

    const result = await prisma.$transaction(async (tx) => {
      const cmdMaj = await tx.commandeYakro.update({
        where: { id: req.params.id },
        data: { statut: 'PAYEE', typePaiement: paiements[0].typePaiement, payeeLe: new Date() }
      });
      const paiementsCreees = await Promise.all(paiements.map(p => tx.paiementYakro.create({
        data: { commandeId: req.params.id, montant: Number(p.montant), type: p.typePaiement, reference: p.reference || null }
      })));
      const caisseT = await tx.caisseTransaction.create({
        data: { commandeId: req.params.id, totalCommande: commande.total,
                especesRecues: Number(especesRecues || 0), monnaieRendue: Number(monnaieRendue || 0),
                estMixte: paiements.length > 1 }
      });
      const caisse = await tx.caisse.findFirst({ where: { filiale: 'YAKRO_GRILL', actif: true } });
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
router.put('/:id/remise', auth, yakro, async (req, res) => {
  try {
    const { remise, motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif de remise obligatoire' });
    const remiseMontant = Number(remise);
    if (isNaN(remiseMontant) || remiseMontant < 0) return res.status(400).json({ error: 'Montant remise invalide' });

    const commande = await prisma.commandeYakro.findUnique({ where: { id: req.params.id } });
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
router.post('/:id/offert', auth, requireFiliale('YAKRO_GRILL'), async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif obligatoire pour un offert client' });
    const updated = await prisma.commandeYakro.update({
      where: { id: req.params.id },
      data: { remise: (await prisma.commandeYakro.findUnique({ where: { id: req.params.id } })).total, total: 0, statut: 'PAYEE', notes: `OFFERT CLIENT: ${motif}`, payeeLe: new Date() }
    });
    if (updated.tableId) await prisma.tableRestaurant.update({ where: { id: updated.tableId }, data: { statut: 'LIBRE' } });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id — Annulation avec motif obligatoire
router.delete('/:id', auth, yakro, async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif d\'annulation obligatoire' });
    const commande = await prisma.commandeYakro.findUnique({ where: { id: req.params.id } });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (commande.statut === 'PAYEE') return res.status(400).json({ error: 'Commande payée — annulation impossible. Demander un remboursement.' });

    await prisma.commandeYakro.update({ where: { id: req.params.id }, data: { statut: 'ANNULEE', notes: `${commande.notes || ''} | ANNULATION: ${motif}` } });
    if (commande.tableId) await prisma.tableRestaurant.update({ where: { id: commande.tableId }, data: { statut: 'LIBRE' } });
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'YAKRO_GRILL', action: 'DELETE', entite: 'CommandeYakro', entiteId: commande.id, entiteLabel: `Annulation: ${motif}`, avant: { statut: commande.statut } } });
    res.json({ message: 'Commande annulée', motif });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/rembourser — Remboursement après paiement (si erreur caisse)
router.post('/:id/rembourser', auth, requireFiliale('YAKRO_GRILL'), async (req, res) => {
  try {
    const { motif, montant } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif de remboursement obligatoire' });
    const commande = await prisma.commandeYakro.findUnique({ where: { id: req.params.id }, include: { paiements: true } });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (commande.statut !== 'PAYEE') return res.status(400).json({ error: 'Seule une commande payée peut être remboursée' });

    const montantRemboursement = Number(montant) || commande.total;
    const caisse = await prisma.caisse.findFirst({ where: { filiale: 'YAKRO_GRILL', actif: true } });
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
router.get('/stats', auth, yakro, async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const debut = dateDebut ? new Date(dateDebut) : new Date(new Date().setHours(0,0,0,0));
    const [total, payees, annulees, remises, ca] = await Promise.all([
      prisma.commandeYakro.count({ where: { createdAt: { gte: debut } } }),
      prisma.commandeYakro.count({ where: { statut: 'PAYEE', createdAt: { gte: debut } } }),
      prisma.commandeYakro.count({ where: { statut: 'ANNULEE', createdAt: { gte: debut } } }),
      prisma.commandeYakro.aggregate({ _sum: { remise: true }, where: { createdAt: { gte: debut } } }),
      prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: debut } } }),
    ]);
    res.json({ total, payees, annulees, remises: remises._sum.remise || 0, ca: ca._sum.montant || 0, tauxConversion: total > 0 ? Math.round(payees/total*100) : 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// POST /:id/ajouter-lignes — Ajouter des articles à une commande EN_COURS
router.post('/:id/ajouter-lignes', auth, yakro, async (req, res) => {
  try {
    const { lignes, notes } = req.body;
    const commande = await prisma.commandeYakro.findUnique({ where: { id: req.params.id } });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (commande.statut === 'PAYEE') return res.status(400).json({ error: 'Commande déjà payée' });
    if (commande.statut === 'ANNULEE') return res.status(400).json({ error: 'Commande annulée' });

    const lignesData = [];
    let ajout = 0;
    for (const l of lignes) {
      const item = await prisma.menuYakro.findUnique({ where: { id: l.menuId || l.id } });
      if (!item || !item.disponible) continue;
      const prix = l.prixUnitaire || l.prix || item.prix;
      ajout += prix * (l.quantite || 1);
      lignesData.push({ commandeId: req.params.id, menuId: item.id, quantite: l.quantite || 1, prixUnitaire: prix, notes: l.notes });
    }

    if (lignesData.length === 0) return res.status(400).json({ error: 'Aucun article valide' });

    await prisma.$transaction([
      prisma.ligneCommandeYakro.createMany({ data: lignesData }),
      prisma.commandeYakro.update({
        where: { id: req.params.id },
        data: {
          sousTotal: { increment: ajout },
          total: { increment: ajout },
          notes: notes ? `${commande.notes || ''} | ${notes}` : commande.notes,
        }
      })
    ]);

    const updated = await prisma.commandeYakro.findUnique({
      where: { id: req.params.id },
      include: { lignes: { include: { menu: true } }, table: true }
    });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /yakro/caisse-detail — Caisse du jour avec départage Bar/Cuisine
router.get('/caisse-detail', auth, yakro, async (req, res) => {
  try {
    const auj = new Date(); auj.setHours(0,0,0,0);
    const demain = new Date(auj); demain.setDate(demain.getDate()+1);

    const CATS_BAR = ['BIERE','VIN','CHAMPAGNE','COCKTAIL_ALCOOLISE','COCKTAIL_SANS_ALCOOL','SUCRERIE','TISANE'];

    const lignes = await prisma.ligneCommandeYakro.findMany({
      where: { commande: { statut: 'PAYEE', createdAt: { gte: auj, lt: demain } } },
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
      by: ['typePaiement'],
      _sum: { montant: true },
      where: { createdAt: { gte: auj, lt: demain } }
    });

    const nbCommandes = await prisma.commandeYakro.count({ where: { statut: 'PAYEE', createdAt: { gte: auj, lt: demain } } });

    res.json({
      totalJour: totalBar + totalCuisine,
      totalBar, totalCuisine,
      pctBar: totalBar + totalCuisine > 0 ? Math.round(totalBar / (totalBar + totalCuisine) * 100) : 0,
      pctCuisine: totalBar + totalCuisine > 0 ? Math.round(totalCuisine / (totalBar + totalCuisine) * 100) : 0,
      nbCommandes,
      parCategorie: Object.entries(parCateg).sort((a,b)=>b[1]-a[1]).map(([cat, montant]) => ({ categorie: cat, montant, isBar: CATS_BAR.includes(cat) })),
      parPaiement: paiements.map(p => ({ type: p.typePaiement, montant: p._sum.montant || 0 })),
      reinvestissement: { bar: Math.round(totalBar * 0.5), cuisine: Math.round(totalCuisine * 0.5), total: Math.round((totalBar + totalCuisine) * 0.5) },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
