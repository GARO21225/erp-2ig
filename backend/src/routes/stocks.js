// ── STOCKS ──────────────────────────────
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');

router.get('/produits', auth, async (req, res) => {
  try {
    const { filiale, categorie, search } = req.query;
    const where = {};
    if (filiale) where.filiale = filiale;
    else if (req.user.filiale !== 'GROUPE') where.filiale = req.user.filiale;
    if (categorie) where.categorie = categorie;
    if (search) where.nom = { contains: search, mode: 'insensitive' };

    const produits = await prisma.produit.findMany({
      where,
      include: { stocks: true },
      orderBy: { nom: 'asc' }
    });

    // Enrichir avec alertes
    const enriched = produits.map(p => ({
      ...p,
      stockTotal: p.stocks.reduce((s, st) => s + st.quantite, 0),
      enAlerte: p.stocks.some(st => st.quantite <= p.stockAlert),
    }));

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/produits', auth, async (req, res) => {
  try {
    const ref = `PRD-${Date.now()}`;
    const produit = await prisma.produit.create({ data: { ...req.body, reference: req.body.reference || ref } });
    res.status(201).json(produit);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mouvements de stock
const MOTIFS_PERTE = ['PEREMPTION', 'CASSE', 'VOL', 'CONSO_INTERNE', 'OFFERT_CLIENT'];

router.post('/mouvements', auth, async (req, res) => {
  try {
    const { produitId, filiale, type, quantite, motif, typeMotif, depot = 'Principal' } = req.body;
    const qte = Number(quantite);

    // Fix 4 — Motif OBLIGATOIRE pour les pertes
    if (type === 'PERTE') {
      if (!motif || motif.trim() === '') {
        return res.status(400).json({ error: 'Le motif est obligatoire pour une perte de stock' });
      }
      if (typeMotif && !MOTIFS_PERTE.includes(typeMotif)) {
        return res.status(400).json({
          error: `typeMotif invalide. Valeurs acceptées : ${MOTIFS_PERTE.join(', ')}`
        });
      }
    }

    if (!produitId || !filiale || !type || !qte || qte <= 0) {
      return res.status(400).json({ error: 'produitId, filiale, type, quantite (> 0) sont requis' });
    }

    const mouvement = await prisma.$transaction(async (tx) => {
      const mvt = await tx.mouvementStock.create({
        data: { produitId, filiale, type, quantite: qte, motif, typeMotif, operateurId: req.user.id }
      });

      const delta = ['ENTREE', 'INVENTAIRE'].includes(type) ? qte : -qte;

      await tx.stock.upsert({
        where: { produitId_filiale_depot: { produitId, filiale, depot } },
        create: { produitId, filiale, depot, quantite: Math.max(0, delta) },
        update: { quantite: { increment: delta } }
      });

      // Audit
      await tx.auditLog.create({
        data: {
          utilisateurId: req.user.id,
          utilisateurNom: `${req.user.prenom} ${req.user.nom}`,
          filiale,
          action: 'CREATE',
          entite: 'MouvementStock',
          entiteId: mvt.id,
          entiteLabel: `${type} ${qte} unités — ${typeMotif || motif || ''}`,
          apres: { type, quantite: qte, motif, typeMotif, produitId },
        }
      });

      return mvt;
    });

    res.status(201).json(mouvement);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/mouvements', auth, async (req, res) => {
  try {
    const { filiale, produitId, type, page = 1, limit = 30 } = req.query;
    const where = {};
    if (filiale) where.filiale = filiale;
    if (produitId) where.produitId = produitId;
    if (type) where.type = type;

    const data = await prisma.mouvementStock.findMany({
      where,
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { produit: { select: { nom: true, reference: true } } }
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Achats / Approvisionnements
router.get('/achats', auth, async (req, res) => {
  try {
    const achats = await prisma.achat.findMany({
      where: req.user.filiale !== 'GROUPE' ? { filiale: req.user.filiale } : {},
      orderBy: { createdAt: 'desc' },
      include: { fournisseur: true, lignes: { include: { produit: true } } }
    });
    res.json(achats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/achats', auth, async (req, res) => {
  try {
    const ref = `ACH-${Date.now()}`;
    const montantTotal = req.body.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
    const achat = await prisma.achat.create({
      data: {
        ...req.body,
        reference: ref,
        montantTotal,
        lignes: { create: req.body.lignes }
      },
      include: { lignes: true }
    });
    res.status(201).json(achat);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Réception achat
router.put('/achats/:id/reception', auth, async (req, res) => {
  try {
    const { lignes } = req.body; // [{ ligneId, quantiteRecue }]
    const achat = await prisma.achat.findUnique({ where: { id: req.params.id }, include: { lignes: true } });

    for (const l of lignes) {
      const ligne = achat.lignes.find(al => al.id === l.ligneId);
      if (!ligne) continue;

      await prisma.ligneAchat.update({
        where: { id: l.ligneId },
        data: { quantiteRecue: l.quantiteRecue }
      });

      // Entrée stock
      await prisma.mouvementStock.create({
        data: { produitId: ligne.produitId, filiale: achat.filiale, type: 'ENTREE', quantite: l.quantiteRecue, motif: `Réception achat ${achat.reference}`, refDocument: achat.id, operateurId: req.user.id }
      });
      await prisma.stock.upsert({
        where: { produitId_filiale_depot: { produitId: ligne.produitId, filiale: achat.filiale, depot: 'Principal' } },
        create: { produitId: ligne.produitId, filiale: achat.filiale, depot: 'Principal', quantite: l.quantiteRecue },
        update: { quantite: { increment: l.quantiteRecue } }
      });
    }

    const updated = await prisma.achat.update({
      where: { id: req.params.id },
      data: { statut: 'RECU', dateReception: new Date() }
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

// POST /stocks/mouvements/transfert — Transfert inter-filiales ou inter-dépôts
router.post('/mouvements/transfert', auth, async (req, res) => {
  try {
    const { produitId, filialeSource, filialeDest, depotSource = 'Principal', depotDest = 'Principal', quantite, motif } = req.body;
    if (!produitId || !filialeSource || !filialeDest || !quantite || !motif) return res.status(400).json({ error: 'produitId, filialeSource, filialeDest, quantite, motif requis' });
    const qte = Number(quantite);
    if (qte <= 0) return res.status(400).json({ error: 'Quantité doit être > 0' });

    // Vérifier stock source suffisant
    const stockSource = await prisma.stock.findUnique({ where: { produitId_filiale_depot: { produitId, filiale: filialeSource, depot: depotSource } } });
    if (!stockSource || stockSource.quantite < qte) return res.status(400).json({ error: `Stock insuffisant: ${stockSource?.quantite || 0} disponible, ${qte} demandé` });

    const idTransfert = `TRF-${Date.now()}`;
    await prisma.$transaction(async (tx) => {
      // Sortie source
      await tx.mouvementStock.create({ data: { produitId, filiale: filialeSource, type: 'TRANSFERT', quantite: qte, motif: `Transfert → ${filialeDest}/${depotDest}: ${motif}`, refDocument: idTransfert, operateurId: req.user.id } });
      await tx.stock.update({ where: { produitId_filiale_depot: { produitId, filiale: filialeSource, depot: depotSource } }, data: { quantite: { decrement: qte } } });
      // Entrée destination
      await tx.mouvementStock.create({ data: { produitId, filiale: filialeDest, type: 'ENTREE', quantite: qte, motif: `Transfert depuis ${filialeSource}/${depotSource}: ${motif}`, refDocument: idTransfert, operateurId: req.user.id } });
      await tx.stock.upsert({ where: { produitId_filiale_depot: { produitId, filiale: filialeDest, depot: depotDest } }, create: { produitId, filiale: filialeDest, depot: depotDest, quantite: qte }, update: { quantite: { increment: qte } } });
    });
    res.status(201).json({ message: 'Transfert effectué', reference: idTransfert, quantite: qte });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /stocks/inventaire — Inventaire correctif
router.post('/inventaire', auth, async (req, res) => {
  try {
    const { filiale, depot = 'Principal', articles } = req.body;
    // articles: [{ produitId, quantiteReelle }]
    if (!Array.isArray(articles) || articles.length === 0) return res.status(400).json({ error: 'Liste articles requis' });

    const corrections = [];
    await prisma.$transaction(async (tx) => {
      for (const a of articles) {
        const stock = await tx.stock.findUnique({ where: { produitId_filiale_depot: { produitId: a.produitId, filiale, depot } } });
        const qteTheorique = stock?.quantite || 0;
        const qteReelle = Number(a.quantiteReelle);
        const ecart = qteReelle - qteTheorique;
        if (ecart === 0) continue;
        // Créer mouvement d'inventaire
        await tx.mouvementStock.create({ data: { produitId: a.produitId, filiale, type: 'INVENTAIRE', quantite: Math.abs(ecart), motif: `Inventaire correctif: écart ${ecart > 0 ? '+' : ''}${ecart}`, typeMotif: ecart < 0 ? 'INVENTAIRE_NEGATIF' : 'INVENTAIRE_POSITIF', operateurId: req.user.id } });
        await tx.stock.upsert({ where: { produitId_filiale_depot: { produitId: a.produitId, filiale, depot } }, create: { produitId: a.produitId, filiale, depot, quantite: qteReelle }, update: { quantite: qteReelle } });
        corrections.push({ produitId: a.produitId, avant: qteTheorique, apres: qteReelle, ecart });
      }
    });
    res.json({ message: `Inventaire correctif: ${corrections.length} correction(s)`, corrections });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /stocks/retour-fournisseur — Retour marchandise au fournisseur
router.post('/retour-fournisseur', auth, async (req, res) => {
  try {
    const { produitId, filiale, quantite, fournisseurId, motif, achatId } = req.body;
    if (!produitId || !filiale || !quantite || !motif) return res.status(400).json({ error: 'produitId, filiale, quantite, motif requis' });
    const qte = Number(quantite);

    const stock = await prisma.stock.findUnique({ where: { produitId_filiale_depot: { produitId, filiale, depot: 'Principal' } } });
    if (!stock || stock.quantite < qte) return res.status(400).json({ error: `Stock insuffisant pour le retour (${stock?.quantite || 0} disponible)` });

    await prisma.$transaction(async (tx) => {
      await tx.mouvementStock.create({ data: { produitId, filiale, type: 'SORTIE', quantite: qte, motif: `Retour fournisseur: ${motif}`, typeMotif: 'RETOUR_FOURNISSEUR', refDocument: achatId, operateurId: req.user.id } });
      await tx.stock.update({ where: { produitId_filiale_depot: { produitId, filiale, depot: 'Principal' } }, data: { quantite: { decrement: qte } } });
    });
    res.json({ message: 'Retour fournisseur enregistré', quantite: qte });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /stocks/alertes — Produits sous le seuil d'alerte
router.get('/alertes', auth, async (req, res) => {
  try {
    const { filiale } = req.query;
    const produits = await prisma.produit.findMany({
      where: filiale ? { filiale } : (req.user.filiale !== 'GROUPE' ? { filiale: req.user.filiale } : {}),
      include: { stocks: true },
    });
    const alertes = produits
      .map(p => ({ ...p, stockTotal: p.stocks.reduce((s, st) => s + st.quantite, 0) }))
      .filter(p => p.stockTotal <= p.stockAlert)
      .map(p => ({ id: p.id, nom: p.nom, reference: p.reference, filiale: p.filiale, stockTotal: p.stockTotal, stockAlert: p.stockAlert, deficit: p.stockAlert - p.stockTotal }));
    res.json({ total: alertes.length, alertes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
