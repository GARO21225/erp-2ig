// ── FINANCE ──────────────────────────────
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/finance/caisses
router.get('/caisses', auth, async (req, res) => {
  try {
    const { filiale } = req.query;
    const where = req.user.filiale === 'GROUPE' ? {} : { filiale: req.user.filiale };
    if (filiale) where.filiale = filiale;

    const caisses = await prisma.caisse.findMany({
      where,
      include: {
        _count: { select: { encaissements: true, decaissements: true } }
      }
    });
    res.json(caisses);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/caisses', auth, requireRole('DG', 'COMPTABLE'), async (req, res) => {
  try {
    const caisse = await prisma.caisse.create({ data: req.body });
    res.status(201).json(caisse);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Encaissements
router.get('/encaissements', auth, async (req, res) => {
  try {
    const { filiale, dateDebut, dateFin, page = 1, limit = 30 } = req.query;
    const where = {};
    if (filiale) where.filiale = filiale;
    else if (req.user.filiale !== 'GROUPE') where.filiale = req.user.filiale;
    if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin) where.createdAt.lte = new Date(dateFin);
    }

    const [total, data, totalMontant] = await Promise.all([
      prisma.encaissement.count({ where }),
      prisma.encaissement.findMany({
        where, skip: (page - 1) * limit, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { caisse: { select: { nom: true } } }
      }),
      prisma.encaissement.aggregate({ _sum: { montant: true }, where })
    ]);

    res.json({ data, total, totalMontant: totalMontant._sum.montant || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/encaissements', auth, requireRole('DG', 'COMPTABLE', 'MANAGER'), async (req, res) => {
  try {
    const [enc] = await prisma.$transaction([
      prisma.encaissement.create({ data: { ...req.body, montant: Number(req.body.montant), operateurId: req.user.id } }),
      prisma.caisse.update({ where: { id: req.body.caisseId }, data: { solde: { increment: Number(req.body.montant) } } })
    ]);
    res.status(201).json(enc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Décaissements
router.get('/decaissements', auth, async (req, res) => {
  try {
    const { filiale, valide, page = 1, limit = 30 } = req.query;
    const where = {};
    if (filiale) where.filiale = filiale;
    else if (req.user.filiale !== 'GROUPE') where.filiale = req.user.filiale;
    if (valide !== undefined) where.valide = valide === 'true';

    const [total, data] = await Promise.all([
      prisma.decaissement.count({ where }),
      prisma.decaissement.findMany({
        where, skip: (page - 1) * limit, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { caisse: { select: { nom: true } } }
      })
    ]);
    res.json({ data, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/decaissements', auth, async (req, res) => {
  try {
    const dec = await prisma.decaissement.create({
      data: { ...req.body, montant: Number(req.body.montant) }
    });
    res.status(201).json(dec);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/decaissements/:id/valider', auth, requireRole('DG', 'DIRECTEUR', 'COMPTABLE'), async (req, res) => {
  try {
    const [dec] = await prisma.$transaction([
      prisma.decaissement.update({
        where: { id: req.params.id },
        data: { valide: true, validePar: req.user.id }
      }),
      prisma.caisse.update({
        where: { id: req.body.caisseId },
        data: { solde: { decrement: Number(req.body.montant) } }
      })
    ]);
    res.json(dec);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rapport financier consolidé
router.get('/rapport', auth, async (req, res) => {
  try {
    const { annee = new Date().getFullYear(), mois } = req.query;
    const debut = mois
      ? new Date(annee, mois - 1, 1)
      : new Date(annee, 0, 1);
    const fin = mois
      ? new Date(annee, mois, 0, 23, 59, 59)
      : new Date(annee, 11, 31, 23, 59, 59);

    const [encParFiliale, decParFiliale, encParType] = await Promise.all([
      prisma.encaissement.groupBy({
        by: ['filiale'],
        _sum: { montant: true },
        where: { createdAt: { gte: debut, lte: fin } }
      }),
      prisma.decaissement.groupBy({
        by: ['filiale'],
        _sum: { montant: true },
        where: { createdAt: { gte: debut, lte: fin }, valide: true }
      }),
      prisma.encaissement.groupBy({
        by: ['typePaiement'],
        _sum: { montant: true },
        where: { createdAt: { gte: debut, lte: fin } }
      }),
    ]);

    const rapport = {};
    for (const e of encParFiliale) {
      rapport[e.filiale] = { encaissements: e._sum.montant || 0, decaissements: 0 };
    }
    for (const d of decParFiliale) {
      if (!rapport[d.filiale]) rapport[d.filiale] = { encaissements: 0, decaissements: 0 };
      rapport[d.filiale].decaissements = d._sum.montant || 0;
    }
    for (const k of Object.keys(rapport)) {
      rapport[k].resultat = rapport[k].encaissements - rapport[k].decaissements;
    }

    res.json({ rapport, encParType, periode: { debut, fin } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// POST /finance/caisses/:id/correction — Correction d'écart de caisse
router.post('/caisses/:id/correction', auth, requireRole('DG', 'COMPTABLE'), async (req, res) => {
  try {
    const { montantReel, motif } = req.body;
    if (montantReel === undefined || !motif) return res.status(400).json({ error: 'montantReel et motif obligatoires' });
    const caisse = await prisma.caisse.findUnique({ where: { id: req.params.id } });
    if (!caisse) return res.status(404).json({ error: 'Caisse introuvable' });
    const ecart = Number(montantReel) - caisse.solde;
    await prisma.$transaction(async (tx) => {
      await tx.caisse.update({ where: { id: req.params.id }, data: { solde: Number(montantReel) } });
      // Créer un mouvement correctif
      if (ecart !== 0) {
        const data = { caisseId: req.params.id, filiale: caisse.filiale, montant: Math.abs(ecart), typePaiement: 'ESPECES', motif: `Correction caisse: ${motif}`, categorie: 'CORRECTION_CAISSE' };
        if (ecart > 0) {
          await tx.encaissement.create({ data: { ...data, operateurId: req.user.id } });
        } else {
          await tx.decaissement.create({ data: { ...data, valide: true, validePar: req.user.id } });
        }
      }
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: caisse.filiale, action: 'UPDATE', entite: 'Caisse', entiteId: caisse.id, entiteLabel: `Correction écart: ${ecart > 0 ? '+' : ''}${ecart.toLocaleString('fr')} F — ${motif}`, avant: { solde: caisse.solde }, apres: { solde: Number(montantReel), ecart, motif } } });
    });
    res.json({ message: 'Correction caisse effectuée', ecart, nouveauSolde: Number(montantReel) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /finance/decaissements/:id/annuler — Annuler un décaissement non validé
router.post('/decaissements/:id/annuler', auth, requireRole('DG', 'COMPTABLE'), async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif d\'annulation obligatoire' });
    const dec = await prisma.decaissement.findUnique({ where: { id: req.params.id } });
    if (!dec) return res.status(404).json({ error: 'Décaissement introuvable' });
    if (dec.valide) return res.status(400).json({ error: 'Décaissement déjà validé — annulation impossible sans correction caisse' });
    // Soft delete via champ motif annulation
    await prisma.decaissement.update({ where: { id: req.params.id }, data: { valide: false, motif: `ANNULE: ${motif} | ${dec.motif}` } });
    res.json({ message: 'Décaissement annulé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /finance/caisses/:id/journal — Journal de caisse (chronologique)
router.get('/caisses/:id/journal', auth, async (req, res) => {
  try {
    const { dateDebut, dateFin, page = 1, limit = 50 } = req.query;
    const where = { caisseId: req.params.id };
    if (dateDebut || dateFin) { where.createdAt = {}; if (dateDebut) where.createdAt.gte = new Date(dateDebut); if (dateFin) where.createdAt.lte = new Date(dateFin); }
    const [encaissements, decaissements] = await Promise.all([
      prisma.encaissement.findMany({ where, orderBy: { createdAt: 'desc' }, take: Number(limit) }),
      prisma.decaissement.findMany({ where, orderBy: { createdAt: 'desc' }, take: Number(limit) })
    ]);
    const journal = [
      ...encaissements.map(e => ({ ...e, sens: 'CREDIT', signeMontant: +e.montant })),
      ...decaissements.map(d => ({ ...d, sens: 'DEBIT', signeMontant: -d.montant })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, Number(limit));
    res.json(journal);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/finance/stats — KPI finance avec courbe
router.get('/stats', auth, async (req, res) => {
  try {
    const { periode = 'month', filiale } = req.query;
    const now = new Date();
    let debut;
    if (periode === 'today' || periode === 'aujourd') { debut = new Date(now); debut.setHours(0,0,0,0); }
    else if (periode === 'week' || periode === 'semaine') { debut = new Date(now); debut.setDate(now.getDate()-7); }
    else if (periode === 'month' || periode === 'mois') { debut = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (periode === 'year' || periode === 'trimestre') { debut = new Date(now.getFullYear(), 0, 1); }
    else debut = new Date(2020, 0, 1);

    const whereBase = { createdAt: { gte: debut } };
    if (filiale && req.user.filiale !== 'GROUPE') whereBase.filiale = req.user.filiale;
    else if (filiale) whereBase.filiale = filiale;

    const [encTotal, decTotal, encParJour, decParJour, decParCateg] = await Promise.all([
      prisma.encaissement.aggregate({ _sum: { montant: true }, where: whereBase }),
      prisma.decaissement.aggregate({ _sum: { montant: true }, where: whereBase }),
      prisma.encaissement.groupBy({ by: ['createdAt'], _sum: { montant: true }, where: whereBase, orderBy: { createdAt: 'asc' } }),
      prisma.decaissement.groupBy({ by: ['createdAt'], _sum: { montant: true }, where: whereBase, orderBy: { createdAt: 'asc' } }),
      prisma.decaissement.groupBy({ by: ['categorie'], _sum: { montant: true }, where: whereBase, orderBy: { _sum: { montant: 'desc' } }, take: 6 }),
    ]);

    // Construire courbe 7 jours
    const courbeMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.toLocaleDateString('fr', { weekday: 'short', day: 'numeric' });
      courbeMap[k] = { jour: k, encaissements: 0, decaissements: 0 };
    }
    encParJour.forEach(e => {
      const k = new Date(e.createdAt).toLocaleDateString('fr', { weekday: 'short', day: 'numeric' });
      if (courbeMap[k]) courbeMap[k].encaissements += e._sum.montant || 0;
    });
    decParJour.forEach(e => {
      const k = new Date(e.createdAt).toLocaleDateString('fr', { weekday: 'short', day: 'numeric' });
      if (courbeMap[k]) courbeMap[k].decaissements += e._sum.montant || 0;
    });

    // Répartition par type de paiement
    const encParPaiement = await prisma.encaissement.groupBy({
      by: ['typePaiement'], _sum: { montant: true }, where: whereBase,
      orderBy: { _sum: { montant: 'desc' } }
    });

    res.json({
      totalEncaissements: encTotal._sum.montant || 0,
      totalDecaissements: decTotal._sum.montant || 0,
      courbe: Object.values(courbeMap),
      parCategorie: decParCateg.map(d => ({ categorie: d.categorie || 'Autre', montant: d._sum.montant || 0 })),
      parTypePaiement: encParPaiement.map(e => ({
        name: e.typePaiement?.replace('_', ' ') || 'Autre',
        value: e._sum.montant || 0
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// ── GET /api/finance/pilotage ── Centre de pilotage DG ────────────────────
router.get('/pilotage', auth, async (req, res) => {
  try {
    const { debut, fin, filiale, periode = 'mois' } = req.query;
    const now = new Date();

    // Calcul des plages de dates
    let dateDebut, dateFin, dateDebutPrec, dateFinPrec;
    if (debut && fin) {
      dateDebut = new Date(debut); dateFin = new Date(fin);
      const diff = dateFin - dateDebut;
      dateDebutPrec = new Date(dateDebut - diff); dateFinPrec = new Date(dateDebut);
    } else {
      const map = {
        aujourd: [new Date(now.getFullYear(), now.getMonth(), now.getDate()), new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)],
        hier: [new Date(now.getFullYear(), now.getMonth(), now.getDate()-1), new Date(now.getFullYear(), now.getMonth(), now.getDate()-1, 23, 59, 59)],
        semaine: [new Date(now.setDate(now.getDate() - now.getDay())), new Date()],
        mois: [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()],
        trimestre: [new Date(new Date().getFullYear(), Math.floor(new Date().getMonth()/3)*3, 1), new Date()],
        annee: [new Date(new Date().getFullYear(), 0, 1), new Date()],
      };
      [dateDebut, dateFin] = map[periode] || map['mois'];
      // Période précédente (même durée)
      const diff = dateFin - dateDebut;
      dateDebutPrec = new Date(dateDebut.getTime() - diff);
      dateFinPrec = new Date(dateDebut.getTime());
    }
    const now2 = new Date();
    dateDebut = new Date(now2.getFullYear(), now2.getMonth(), 1); // reset
    dateFin = new Date();
    dateDebutPrec = new Date(now2.getFullYear(), now2.getMonth()-1, 1);
    dateFinPrec = new Date(now2.getFullYear(), now2.getMonth(), 1);

    const where = { createdAt: { gte: dateDebut, lte: dateFin } };
    const wherePrec = { createdAt: { gte: dateDebutPrec, lte: dateFinPrec } };
    const whereFiliale = filiale ? { ...where, filiale } : where;

    // Requêtes parallèles
    const [
      encTotal, decTotal, encPrec, decPrec,
      encParFiliale, decParFiliale,
      encParType, decParCateg,
      caisses,
      caYakro, nbCommandesYakro,
      lotsVendus, caFoncier,
      livTotal, caLiya,
      encCourbe, decCourbe,
      retardsPmt,
    ] = await Promise.all([
      // CA et dépenses période actuelle
      prisma.encaissement.aggregate({ _sum:{ montant:true }, where: whereFiliale }),
      prisma.decaissement.aggregate({ _sum:{ montant:true }, where: whereFiliale }),
      // Période précédente pour comparaison
      prisma.encaissement.aggregate({ _sum:{ montant:true }, where: filiale ? { ...wherePrec, filiale } : wherePrec }),
      prisma.decaissement.aggregate({ _sum:{ montant:true }, where: filiale ? { ...wherePrec, filiale } : wherePrec }),
      // Répartition par filiale
      prisma.encaissement.groupBy({ by:['filiale'], _sum:{ montant:true }, where }),
      prisma.decaissement.groupBy({ by:['filiale'], _sum:{ montant:true }, where }),
      // Par mode de paiement
      prisma.encaissement.groupBy({ by:['typePaiement'], _sum:{ montant:true }, _count:{ id:true }, where: whereFiliale }),
      // Par catégorie de dépense
      prisma.decaissement.groupBy({ by:['categorie'], _sum:{ montant:true }, where: whereFiliale, orderBy:{ _sum:{ montant:'desc' } }, take:10 }),
      // Caisses
      prisma.caisse.findMany({ where:{ actif:true }, orderBy:{ filiale:'asc' } }),
      // Yakro
      prisma.paiementYakro.aggregate({ _sum:{ montant:true }, where:{ createdAt:{ gte:dateDebut } } }),
      prisma.commandeYakro.count({ where:{ statut:'PAYEE', createdAt:{ gte:dateDebut } } }),
      // TOPTELSIG
      prisma.lot.count({ where:{ statut:'VENDU' } }),
      prisma.paiementFoncier.aggregate({ _sum:{ montant:true }, where:{ createdAt:{ gte:dateDebut } } }),
      // LiYA
      prisma.livraison.count({ where:{ createdAt:{ gte:dateDebut } } }),
      prisma.encaissement.aggregate({ _sum:{ montant:true }, where:{ filiale:'LIYA', createdAt:{ gte:dateDebut } } }),
      // Courbes 30 jours
      prisma.encaissement.groupBy({ by:['createdAt'], _sum:{ montant:true }, where: whereFiliale }),
      prisma.decaissement.groupBy({ by:['createdAt'], _sum:{ montant:true }, where: whereFiliale }),
      // Impayés / retards
      prisma.echeancier.count({ where:{ statut:'RETARD' } }),
    ]);

    const caTotal = encTotal._sum.montant || 0;
    const depTotal = decTotal._sum.montant || 0;
    const caPrecVal = encPrec._sum.montant || 0;
    const depPrecVal = decPrec._sum.montant || 0;
    const variationCA = caPrecVal > 0 ? Math.round((caTotal-caPrecVal)/caPrecVal*100) : 0;
    const variationDep = depPrecVal > 0 ? Math.round((depTotal-depPrecVal)/depPrecVal*100) : 0;
    const resultatBrut = caTotal - depTotal;
    const marge = caTotal > 0 ? Math.round(resultatBrut/caTotal*100) : 0;
    const tresorerie = caisses.reduce((s,c)=>s+c.solde,0);

    // Enrichir filiales
    const filialesMap = {};
    encParFiliale.forEach(e => { filialesMap[e.filiale] = { filiale:e.filiale, ca:e._sum.montant||0, dep:0, pct:0 }; });
    decParFiliale.forEach(e => { if(!filialesMap[e.filiale]) filialesMap[e.filiale]={filiale:e.filiale,ca:0,dep:0,pct:0}; filialesMap[e.filiale].dep=e._sum.montant||0; });
    const filiales = Object.values(filialesMap).map(f=>({ ...f, resultat:f.ca-f.dep, marge:f.ca>0?Math.round((f.ca-f.dep)/f.ca*100):0, pct:caTotal>0?Math.round(f.ca/caTotal*100):0 }));

    // Courbe 7 jours
    const courbe30 = {};
    for (let i=29; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const k = d.toLocaleDateString('fr', { day:'2-digit', month:'short' });
      courbe30[k] = { date:k, encaissements:0, decaissements:0 };
    }
    encCourbe.forEach(e => { const k = new Date(e.createdAt).toLocaleDateString('fr',{day:'2-digit',month:'short'}); if(courbe30[k]) courbe30[k].encaissements+=e._sum.montant||0; });
    decCourbe.forEach(e => { const k = new Date(e.createdAt).toLocaleDateString('fr',{day:'2-digit',month:'short'}); if(courbe30[k]) courbe30[k].decaissements+=e._sum.montant||0; });

    // Alertes
    const alertes = [];
    if (resultatBrut < 0) alertes.push({ type:'DEFICIT', gravite:'CRITIQUE', msg:`Résultat négatif: ${Math.abs(resultatBrut).toLocaleString('fr')} F` });
    if (variationCA < -10) alertes.push({ type:'BAISSE_CA', gravite:'ATTENTION', msg:`CA en baisse de ${Math.abs(variationCA)}% vs période précédente` });
    caisses.filter(c=>c.solde<0).forEach(c=>alertes.push({ type:'CAISSE_NEG', gravite:'CRITIQUE', msg:`Caisse "${c.nom}" négative: ${c.solde.toLocaleString('fr')} F` }));
    if (retardsPmt > 0) alertes.push({ type:'RETARDS', gravite:'ATTENTION', msg:`${retardsPmt} échéance(s) foncière(s) en retard` });

    res.json({
      periode: { debut: dateDebut, fin: dateFin },
      kpi: { caTotal, depTotal, resultatBrut, resultatNet: resultatBrut, marge, tresorerie, variationCA, variationDep, retardsPmt, caPrec: caPrecVal, depPrec: depPrecVal },
      filiales,
      paiements: encParType.map(e=>({ mode:e.typePaiement, montant:e._sum.montant||0, nbTransactions:e._count.id||0, ticketMoyen:e._count.id>0?Math.round((e._sum.montant||0)/e._count.id):0 })),
      depenses: decParCateg.map(d=>({ categorie:d.categorie||'Autre', montant:d._sum.montant||0, pct:depTotal>0?Math.round((d._sum.montant||0)/depTotal*100):0 })),
      caisses: caisses.map(c=>({ id:c.id, nom:c.nom, filiale:c.filiale, solde:c.solde })),
      activites: {
        yakro: { ca:caYakro._sum.montant||0, nbCommandes:nbCommandesYakro },
        toptelsig: { ca:caFoncier._sum.montant||0, lotsVendus },
        liya: { ca:caLiya._sum.montant||0, nbLivraisons:livTotal },
      },
      courbe: Object.values(courbe30),
      alertes,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
