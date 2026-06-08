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

// POST /stocks/seed-yakro — Initialiser le stock Yakro Grill depuis le catalogue menu
router.post('/seed-yakro', auth, async (req, res) => {
  try {
    if (!['DG','DIRECTEUR','MANAGER','MAGASINIER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    // Importer le catalogue côté serveur
    const STOCK_ITEMS = [
      { reference:'YG-VIAN-001', nom:'Poulet de chair (kg)', categorie:'VIANDES_PROTEINES', unite:'kg', prixAchat:2500, stockAlert:10 },
      { reference:'YG-VIAN-002', nom:'Poulet hybride (kg)', categorie:'VIANDES_PROTEINES', unite:'kg', prixAchat:3000, stockAlert:5 },
      { reference:'YG-VIAN-003', nom:'Viande de bœuf (kg)', categorie:'VIANDES_PROTEINES', unite:'kg', prixAchat:5500, stockAlert:5 },
      { reference:'YG-VIAN-004', nom:'Entrecôte de bœuf (kg)', categorie:'VIANDES_PROTEINES', unite:'kg', prixAchat:6000, stockAlert:3 },
      { reference:'YG-VIAN-005', nom:'Viande de porc (kg)', categorie:'VIANDES_PROTEINES', unite:'kg', prixAchat:3500, stockAlert:5 },
      { reference:'YG-VIAN-006', nom:'Cabri (kg)', categorie:'VIANDES_PROTEINES', unite:'kg', prixAchat:4500, stockAlert:5 },
      { reference:'YG-VIAN-007', nom:'Mouton (kg)', categorie:'VIANDES_PROTEINES', unite:'kg', prixAchat:5000, stockAlert:5 },
      { reference:'YG-VIAN-008', nom:'Gambas (kg)', categorie:'VIANDES_PROTEINES', unite:'kg', prixAchat:8000, stockAlert:2 },
      { reference:'YG-VIAN-009', nom:'Gésiers de poulet (kg)', categorie:'VIANDES_PROTEINES', unite:'kg', prixAchat:2000, stockAlert:3 },
      { reference:'YG-FEC-001', nom:'Riz (sac 25kg)', categorie:'FECULENTS', unite:'sac', prixAchat:25000, stockAlert:3 },
      { reference:'YG-FEC-002', nom:'Attiéké (kg)', categorie:'FECULENTS', unite:'kg', prixAchat:800, stockAlert:10 },
      { reference:'YG-FEC-003', nom:'Pommes de terre (kg)', categorie:'FECULENTS', unite:'kg', prixAchat:1200, stockAlert:10 },
      { reference:'YG-FEC-004', nom:'Igname (kg)', categorie:'FECULENTS', unite:'kg', prixAchat:900, stockAlert:10 },
      { reference:'YG-FEC-005', nom:'Plantain (régime)', categorie:'FECULENTS', unite:'régime', prixAchat:3000, stockAlert:5 },
      { reference:'YG-BRD-001', nom:'Farine de blé (kg)', categorie:'FECULENTS', unite:'kg', prixAchat:700, stockAlert:10 },
      { reference:'YG-LEG-001', nom:'Oignons (kg)', categorie:'LEGUMES_CONDIMENTS', unite:'kg', prixAchat:500, stockAlert:5 },
      { reference:'YG-LEG-002', nom:'Tomates fraîches (kg)', categorie:'LEGUMES_CONDIMENTS', unite:'kg', prixAchat:600, stockAlert:5 },
      { reference:'YG-LEG-003', nom:'Ail (kg)', categorie:'LEGUMES_CONDIMENTS', unite:'kg', prixAchat:3000, stockAlert:2 },
      { reference:'YG-LAI-001', nom:'Crème fraîche (L)', categorie:'LAITIERS_SAUCES', unite:'litre', prixAchat:2500, stockAlert:3 },
      { reference:'YG-LAI-002', nom:'Beurre (kg)', categorie:'LAITIERS_SAUCES', unite:'kg', prixAchat:4000, stockAlert:2 },
      { reference:'YG-PIZ-001', nom:'Pâte à pizza (kg)', categorie:'PIZZA_CHAWARMA', unite:'kg', prixAchat:1500, stockAlert:5 },
      { reference:'YG-PIZ-002', nom:'Pain pita (unité)', categorie:'PIZZA_CHAWARMA', unite:'unité', prixAchat:300, stockAlert:30 },
      { reference:'YG-BOI-001', nom:'Heineken (casier 24)', categorie:'BOISSONS', unite:'casier', prixAchat:18000, stockAlert:5 },
      { reference:'YG-BOI-002', nom:'Desperados (casier 24)', categorie:'BOISSONS', unite:'casier', prixAchat:22000, stockAlert:3 },
      { reference:'YG-BOI-003', nom:'Guinness (casier 24)', categorie:'BOISSONS', unite:'casier', prixAchat:24000, stockAlert:3 },
      { reference:'YG-BOI-004', nom:'Fanta (casier 24)', categorie:'BOISSONS', unite:'casier', prixAchat:12000, stockAlert:3 },
      { reference:'YG-BOI-005', nom:'Coca-cola (casier 24)', categorie:'BOISSONS', unite:'casier', prixAchat:12000, stockAlert:3 },
      { reference:'YG-BOI-006', nom:'Eau minérale (casier)', categorie:'BOISSONS', unite:'casier', prixAchat:6000, stockAlert:5 },
      { reference:'YG-ALC-001', nom:'Rhum blanc (bouteille)', categorie:'ALCOOLS_BAR', unite:'bouteille', prixAchat:8000, stockAlert:3 },
      { reference:'YG-ALC-002', nom:'Champagne Moët', categorie:'ALCOOLS_BAR', unite:'bouteille', prixAchat:45000, stockAlert:2 },
      { reference:'YG-ALC-003', nom:'Vin rouge Bordeaux', categorie:'ALCOOLS_BAR', unite:'bouteille', prixAchat:8000, stockAlert:5 },
      { reference:'YG-EPI-001', nom:'Huile végétale (bidon 20L)', categorie:'EPICERIE', unite:'bidon', prixAchat:25000, stockAlert:3 },
      { reference:'YG-EPI-002', nom:'Sel (kg)', categorie:'EPICERIE', unite:'kg', prixAchat:300, stockAlert:5 },
      { reference:'YG-EPI-003', nom:'Sucre (kg)', categorie:'EPICERIE', unite:'kg', prixAchat:700, stockAlert:5 },
      { reference:'YG-GAZ-001', nom:'Bouteille gaz 12kg', categorie:'GAZ_ENERGIE', unite:'bouteille', prixAchat:9000, stockAlert:2 },
    ];

    let created = 0, skipped = 0;
    for (const item of STOCK_ITEMS) {
      const exists = await prisma.produit.findUnique({ where: { reference: item.reference } });
      if (exists) { skipped++; continue; }
      const produit = await prisma.produit.create({ data: { ...item, filiale: 'YAKRO_GRILL', prixVente: item.prixAchat * 1.3 } });
      await prisma.stock.create({ data: { produitId: produit.id, filiale: 'YAKRO_GRILL', quantite: 0, depot: 'Principal' } });
      created++;
    }
    res.json({ message: `Stock Yakro initialisé`, created, skipped, total: STOCK_ITEMS.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /stocks/template-import — Template CSV pour import stock
router.get('/template-import', auth, (req, res) => {
  const headers = ['reference','nom','categorie','unite','prixAchat','prixVente','stockAlert'];
  const example = [['YG-001','Poulet de chair (kg)','VIANDES_PROTEINES','kg',2500,3500,10]];
  res.setHeader('Content-Disposition', 'attachment; filename="template_stock.csv"');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + [headers, ...example].map(r => r.join(';')).join('\r\n'));
});
