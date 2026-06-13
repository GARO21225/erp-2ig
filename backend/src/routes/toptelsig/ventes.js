const router = require('express').Router();
const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const { auth, requireFiliale, requireRole } = require('../../middleware/auth');
const { VALIDATORS } = require('../../middleware/validate');
const toptelsig = requireFiliale('TOPTELSIG');

// POST /api/toptelsig/ventes — Créer vente avec toutes les vérifications
router.post('/', auth, toptelsig, VALIDATORS.vente, async (req, res) => {
  try {
    const { lotId, souscripteurId, reservationId, prixVente, nombreEcheances, dateVente, prescripteurId } = req.body;

    // Vérifications préalables
    const lot = await prisma.lot.findUnique({ where: { id: lotId } });
    if (!lot) return res.status(404).json({ error: 'Lot introuvable' });
    if (lot.statut === 'VENDU') return res.status(400).json({ error: `Lot déjà vendu — statut : VENDU` });
    if (lot.statut === 'LITIGE') return res.status(400).json({ error: `Lot en litige — vente impossible` });
    if (lot.statut === 'ANNULE') return res.status(400).json({ error: `Lot annulé — vente impossible` });

    // Vérifier pas de vente active sur ce lot
    const venteExistante = await prisma.venteFoncier.findUnique({ where: { lotId } });
    if (venteExistante) return res.status(400).json({ error: 'Une vente existe déjà sur ce lot' });

    const result = await prisma.$transaction(async (tx) => {
      const vente = await tx.venteFoncier.create({
        data: { lotId, souscripteurId, reservationId, prixVente: Number(prixVente), dateVente: dateVente ? new Date(dateVente) : new Date() }
      });
      await tx.lot.update({ where: { id: lotId }, data: { statut: 'VENDU' } });
      if (reservationId) await tx.reservationFoncier.update({ where: { id: reservationId }, data: { statut: 'CONVERTIE' } });

      // Souscripteur → ACTIF
      await tx.souscripteur.update({ where: { id: souscripteurId }, data: { statut: 'ACTIF' } });

      // Échéancier
      const montantEch = Number(prixVente) / Number(nombreEcheances || 1);
      const echeances = Array.from({ length: Number(nombreEcheances || 1) }, (_, i) => {
        const dateEcheance = new Date(); dateEcheance.setMonth(dateEcheance.getMonth() + i + 1);
        return { venteId: vente.id, numero: i + 1, montant: montantEch, dateEcheance };
      });
      await tx.echeancier.createMany({ data: echeances });

      // Commission
      if (prescripteurId) {
        const prescripteur = await tx.prescripteur.findUnique({ where: { id: prescripteurId } });
        if (prescripteur?.actif) {
          await tx.commission.create({ data: { prescripteurId, venteId: vente.id, montant: Number(prixVente) * prescripteur.tauxCommission / 100, taux: prescripteur.tauxCommission } });
        }
      }

      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'CREATE', entite: 'VenteFoncier', entiteId: vente.id, entiteLabel: `Lot ${lot.numero} — ${Number(prixVente).toLocaleString('fr')} F`, apres: { lotId, souscripteurId, prixVente: Number(prixVente), nombreEcheances } } });
      return vente;
    });

    logger.info('Vente foncière créée', { ventId: result.id, lotId, prixVente });
    res.status(201).json(result);
  } catch (e) { logger.error('POST /ventes', { error: e.message }); res.status(500).json({ error: e.message }); }
});

// GET /api/toptelsig/ventes
router.get('/', auth, toptelsig, async (req, res) => {
  try {
    const { statut, projetId, page = 1, limit = 20, dateDebut, dateFin } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (projetId) where.lot = { projetId };
    if (dateDebut || dateFin) { where.dateVente = {}; if (dateDebut) where.dateVente.gte = new Date(dateDebut); if (dateFin) where.dateVente.lte = new Date(dateFin); }
    const [total, ventes] = await Promise.all([
      prisma.venteFoncier.count({ where }),
      prisma.venteFoncier.findMany({ where, skip: (Number(page)-1)*Number(limit), take: Number(limit), orderBy: { dateVente: 'desc' }, include: { lot: { include: { projet: { select: { nom: true, code: true } } } }, souscripteur: { select: { nom: true, prenom: true, telephone: true } }, echeanciers: { orderBy: { numero: 'asc' } }, paiements: true, commissions: true, _count: { select: { paiements: true } } } })
    ]);
    res.json({ data: ventes, total, page: Number(page), pages: Math.ceil(total/Number(limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/annuler — Annulation vente (lot redevient DISPONIBLE)
router.put('/:id/annuler', auth, requireRole('DG', 'DIRECTEUR', 'RESP_FONCIER'), async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif d\'annulation obligatoire' });
    const vente = await prisma.venteFoncier.findUnique({ where: { id: req.params.id }, include: { paiements: true, commissions: true } });
    if (!vente) return res.status(404).json({ error: 'Vente introuvable' });
    if (vente.statut === 'ANNULEE') return res.status(400).json({ error: 'Vente déjà annulée' });
    if (vente.statut === 'SOLDE') return res.status(400).json({ error: 'Vente soldée — annulation nécessite validation DG' });

    const totalPaye = vente.paiements.reduce((s, p) => s + p.montant, 0);
    if (totalPaye > 0) logger.warn(`Annulation vente avec paiements reçus (${totalPaye} F) — remboursements manuels requis`);

    await prisma.$transaction(async (tx) => {
      await tx.venteFoncier.update({ where: { id: req.params.id }, data: { statut: 'ANNULEE' } });
      await tx.lot.update({ where: { id: vente.lotId }, data: { statut: 'DISPONIBLE' } });
      await tx.echeancier.updateMany({ where: { venteId: req.params.id, statut: { not: 'PAYE' } }, data: { statut: 'ANNULE' } });
      await tx.commission.updateMany({ where: { venteId: req.params.id, statut: 'EN_ATTENTE' }, data: { statut: 'ANNULEE' } });
      await tx.souscripteur.update({ where: { id: vente.souscripteurId }, data: { statut: vente.paiements.length === 0 ? 'PROSPECT' : 'ACTIF' } });
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'DELETE', entite: 'VenteFoncier', entiteId: vente.id, entiteLabel: `Annulation: ${motif}`, avant: { statut: vente.statut, totalPaye }, apres: { statut: 'ANNULEE', motif } } });
    });
    res.json({ message: 'Vente annulée', avertissement: totalPaye > 0 ? `${totalPaye.toLocaleString('fr')} F à rembourser manuellement` : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/transfert — Transfert vente vers autre souscripteur
router.put('/:id/transfert', auth, requireRole('DG', 'DIRECTEUR', 'RESP_FONCIER'), async (req, res) => {
  try {
    const { nouveauSouscripteurId, motif } = req.body;
    if (!nouveauSouscripteurId || !motif) return res.status(400).json({ error: 'Nouveau souscripteur et motif requis' });
    const vente = await prisma.venteFoncier.findUnique({ where: { id: req.params.id } });
    if (!vente) return res.status(404).json({ error: 'Vente introuvable' });
    if (['ANNULEE', 'LITIGE'].includes(vente.statut)) return res.status(400).json({ error: `Transfert impossible — vente ${vente.statut}` });

    const nouveauSous = await prisma.souscripteur.findUnique({ where: { id: nouveauSouscripteurId } });
    if (!nouveauSous) return res.status(404).json({ error: 'Nouveau souscripteur introuvable' });

    await prisma.$transaction(async (tx) => {
      await tx.venteFoncier.update({ where: { id: req.params.id }, data: { souscripteurId: nouveauSouscripteurId } });
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'UPDATE', entite: 'VenteFoncier', entiteId: vente.id, entiteLabel: `Transfert → ${nouveauSous.prenom} ${nouveauSous.nom}: ${motif}`, avant: { souscripteurId: vente.souscripteurId }, apres: { souscripteurId: nouveauSouscripteurId, motif } } });
    });
    res.json({ message: 'Vente transférée' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/litige — Mettre un lot en litige
router.put('/:id/litige', auth, requireRole('DG', 'DIRECTEUR', 'RESP_FONCIER'), async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif de litige obligatoire' });
    const vente = await prisma.venteFoncier.findUnique({ where: { id: req.params.id } });
    if (!vente) return res.status(404).json({ error: 'Vente introuvable' });
    await prisma.$transaction([
      prisma.venteFoncier.update({ where: { id: req.params.id }, data: { statut: 'LITIGE' } }),
      prisma.lot.update({ where: { id: vente.lotId }, data: { statut: 'LITIGE' } }),
    ]);
    res.json({ message: 'Vente et lot mis en litige' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/toptelsig/ventes/retards
router.get('/retards', auth, toptelsig, async (req, res) => {
  try {
    const retards = await prisma.echeancier.findMany({
      where: { dateEcheance: { lt: new Date() }, statut: { in: ['EN_ATTENTE', 'PARTIEL'] } },
      include: { vente: { include: { souscripteur: { select: { nom: true, prenom: true, telephone: true } }, lot: { include: { projet: { select: { nom: true } } } } } } },
      orderBy: { dateEcheance: 'asc' }
    });
    // Mettre à jour les statuts
    const ids = retards.map(r => r.id);
    if (ids.length) await prisma.echeancier.updateMany({ where: { id: { in: ids } }, data: { statut: 'RETARD' } });
    res.json(retards);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/toptelsig/ventes/:id/echeanciers — Planifier des échéances sur une vente existante
router.post('/:id/echeanciers', auth, toptelsig, async (req, res) => {
  try {
    const { nombreEcheances, montantTotal, dateDebut, periodeJours = 30 } = req.body;
    if (!nombreEcheances || !montantTotal) {
      return res.status(400).json({ error: 'nombreEcheances et montantTotal requis' });
    }

    const vente = await prisma.venteFoncier.findUnique({ where: { id: req.params.id } });
    if (!vente) return res.status(404).json({ error: 'Vente introuvable' });

    // Supprimer les anciens échéanciers non payés
    await prisma.echeancier.deleteMany({
      where: { venteId: req.params.id, statut: { not: 'PAYE' } }
    });

    const montantEch = Number(montantTotal) / Number(nombreEcheances);
    const start = dateDebut ? new Date(dateDebut) : new Date();
    const echeances = Array.from({ length: Number(nombreEcheances) }, (_, i) => {
      const dateEcheance = new Date(start);
      dateEcheance.setDate(dateEcheance.getDate() + (i + 1) * Number(periodeJours));
      return {
        venteId: req.params.id,
        souscripteurId: vente.souscripteurId,
        numero: i + 1,
        montant: Math.round(montantEch),
        dateEcheance,
        statut: 'EN_ATTENTE',
        montantPaye: 0,
      };
    });

    await prisma.echeancier.createMany({ data: echeances });
    const created = await prisma.echeancier.findMany({
      where: { venteId: req.params.id },
      orderBy: { numero: 'asc' }
    });

    res.status(201).json({ count: created.length, echeanciers: created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
