const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale, requireRole } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

// GET /api/toptelsig/depenses
router.get('/', auth, toptelsig, async (req, res) => {
  try {
    const { projetId, categorie, statut, page = 1, limit = 30 } = req.query;
    const where = {};
    if (projetId) where.projetId = projetId;
    if (categorie) where.categorie = categorie;
    if (statut) where.statut = statut;

    const [total, depenses] = await Promise.all([
      prisma.depenseFoncier.count({ where }),
      prisma.depenseFoncier.findMany({
      include: {
        projet: { select: { nom: true, code: true } },
        initiateur: { select: { nom: true, prenom: true, poste: true } },
      },
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { date: 'desc' },
        include: { projet: { select: { nom: true, code: true } } }
      })
    ]);

    const totalMontant = await prisma.depenseFoncier.aggregate({ _sum: { montant: true }, where });
    res.json({ data: depenses, total, totalMontant: totalMontant._sum.montant || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/toptelsig/depenses — Création (statut EN_ATTENTE par défaut)
router.post('/', auth, toptelsig, async (req, res) => {
  try {
    const depense = await prisma.depenseFoncier.create({
      data: {
        ...req.body,
        montant: Number(req.body.montant),
        statut: 'EN_ATTENTE',
        valideN1: false,
        valideFinale: false,
        paye: false,
      }
    });

    await prisma.auditLog.create({
      data: {
        utilisateurId: req.user.id,
        utilisateurNom: `${req.user.prenom} ${req.user.nom}`,
        filiale: 'TOPTELSIG',
        action: 'CREATE',
        entite: 'DepenseFoncier',
        entiteId: depense.id,
        entiteLabel: `${depense.categorie} — ${depense.montant.toLocaleString('fr')} F`,
        apres: { montant: depense.montant, categorie: depense.categorie, statut: depense.statut },
      }
    });

    res.status(201).json(depense);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Fix 6 : Workflow 3 niveaux ─────────────────────────────────────────────

// PUT /:id/valider-n1 — Niveau 1 : Chef Projet / RESP_FONCIER
router.put('/:id/valider-n1', auth, requireRole('DG', 'DIRECTEUR', 'RESP_FONCIER'), async (req, res) => {
  try {
    const dep = await prisma.depenseFoncier.findUnique({ where: { id: req.params.id } });
    if (!dep) return res.status(404).json({ error: 'Dépense introuvable' });
    if (dep.statut !== 'EN_ATTENTE') return res.status(400).json({ error: `Statut actuel "${dep.statut}" — validation N1 impossible` });
    if (dep.rejete) return res.status(400).json({ error: 'Dépense rejetée — ne peut plus être validée' });

    const updated = await prisma.depenseFoncier.update({
      where: { id: req.params.id },
      data: {
        valideN1: true,
        valideN1Par: req.user.id,
        valideN1Nom: `${req.user.prenom} ${req.user.nom}`,
        valideN1Le: new Date(),
        statut: 'VALIDEE_N1',
      }
    });

    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'VALIDATE', entite: 'DepenseFoncier', entiteId: dep.id, entiteLabel: `Validation N1 — ${dep.categorie}`, avant: { statut: 'EN_ATTENTE' }, apres: { statut: 'VALIDEE_N1' } } });

    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/valider-finale — Niveau 2 : DG ou Directeur uniquement
router.put('/:id/valider-finale', auth, requireRole('DG', 'DIRECTEUR'), async (req, res) => {
  try {
    const dep = await prisma.depenseFoncier.findUnique({ where: { id: req.params.id } });
    if (!dep) return res.status(404).json({ error: 'Dépense introuvable' });
    if (dep.statut !== 'VALIDEE_N1') return res.status(400).json({ error: `Validation N1 requise avant la validation finale (statut actuel : ${dep.statut})` });

    const updated = await prisma.depenseFoncier.update({
      where: { id: req.params.id },
      data: {
        valideFinale: true,
        valideFinalePar: req.user.id,
        valideFinalNom: `${req.user.prenom} ${req.user.nom}`,
        valideFinaleLe: new Date(),
        statut: 'VALIDEE_FINALE',
      }
    });

    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'VALIDATE', entite: 'DepenseFoncier', entiteId: dep.id, entiteLabel: `Validation Finale — ${dep.categorie}`, avant: { statut: 'VALIDEE_N1' }, apres: { statut: 'VALIDEE_FINALE' } } });

    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/payer — Niveau 3 : Comptable enregistre le paiement effectif
router.put('/:id/payer', auth, requireRole('DG', 'COMPTABLE'), async (req, res) => {
  try {
    const dep = await prisma.depenseFoncier.findUnique({ where: { id: req.params.id } });
    if (!dep) return res.status(404).json({ error: 'Dépense introuvable' });
    if (dep.statut !== 'VALIDEE_FINALE') {
      return res.status(400).json({ error: `Validation finale Direction requise avant paiement (statut : ${dep.statut})` });
    }

    const { referenceVirement } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.depenseFoncier.update({
        where: { id: req.params.id },
        data: {
          paye: true,
          payePar: req.user.id,
          payeLe: new Date(),
          referenceVirement,
          statut: 'PAYEE',
        }
      });

      // Décaissement dans la caisse TOPTELSIG
      const caisse = await tx.caisse.findFirst({ where: { filiale: 'TOPTELSIG', actif: true } });
      if (caisse) {
        await tx.decaissement.create({
          data: {
            caisseId: caisse.id,
            filiale: 'TOPTELSIG',
            montant: dep.montant,
            typePaiement: dep.typePaiement || 'ESPECES',
            reference: referenceVirement,
            motif: dep.description,
            categorie: dep.categorie,
            beneficiaire: dep.beneficiaire,
            valide: true,
            validePar: req.user.id,
          }
        });
        await tx.caisse.update({ where: { id: caisse.id }, data: { solde: { decrement: dep.montant } } });
      }

      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'VALIDATE', entite: 'DepenseFoncier', entiteId: dep.id, entiteLabel: `Paiement effectué — ${dep.montant.toLocaleString('fr')} F`, avant: { statut: 'VALIDEE_FINALE' }, apres: { statut: 'PAYEE' } } });

      return d;
    });

    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/rejeter — Rejet à n'importe quelle étape
router.put('/:id/rejeter', auth, requireRole('DG', 'DIRECTEUR', 'RESP_FONCIER', 'COMPTABLE'), async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif || motif.trim() === '') {
      return res.status(400).json({ error: 'Le motif de rejet est obligatoire' });
    }

    const dep = await prisma.depenseFoncier.findUnique({ where: { id: req.params.id } });
    if (!dep) return res.status(404).json({ error: 'Dépense introuvable' });
    if (['PAYEE', 'ARCHIVEE'].includes(dep.statut)) {
      return res.status(400).json({ error: `Impossible de rejeter une dépense ${dep.statut}` });
    }

    const updated = await prisma.depenseFoncier.update({
      where: { id: req.params.id },
      data: {
        rejete: true,
        rejetePar: req.user.id,
        rejeteMotif: motif,
        statut: 'REJETEE',
      }
    });

    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'REJECT', entite: 'DepenseFoncier', entiteId: dep.id, entiteLabel: `Rejet — ${motif}`, avant: { statut: dep.statut }, apres: { statut: 'REJETEE', motif } } });

    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Stats dépenses par catégorie
router.get('/stats', auth, toptelsig, async (req, res) => {
  try {
    const { projetId } = req.query;
    const stats = await prisma.depenseFoncier.groupBy({
      by: ['categorie'],
      _sum: { montant: true },
      _count: { id: true },
      where: projetId ? { projetId } : undefined,
    });
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET catégories depuis le PCR
router.get('/categories', auth, toptelsig, (req, res) => {
  res.json(getCategoriesDepenses());
});

function getCategoriesDepenses() {
  return {
    'Coutumier & Acquisition Foncière': ['Dotation chef de village', 'Dotation notables', 'Dotation propriétaires terriens', 'Frais de négociation foncière', 'Indemnisation exploitants agricoles', 'Indemnisation occupants', 'Achat de terrain', 'Frais de convention foncière', 'Cadeaux et relations coutumières', 'Organisation de réunions villageoises', 'Transport autorités coutumières'],
    'Topographie & Études': ['Délimitation terrain', 'Coupe et ouverture de layons', 'Piquets et bornes provisoires', 'GPS et rattachement', 'Levé topographique', 'Plan d\'urbanisme', 'Plan parcellaire', 'Impression plans', 'Signature géomètre expert', 'Mission topographique', 'Location matériel topo'],
    'Administratif & Dossiers': ['Frais de timbres', 'Frais de légalisation', 'Photocopies et impressions', 'Frais de dépôt de dossier', 'Courriers administratifs', 'Transport dossiers', 'Honoraires juridiques', 'Honoraires consultant'],
    'Lotissement & Bornage': ['Application du lotissement', 'Bornage définitif', 'Implantation des bornes', 'Achat de bornes', 'Main d\'œuvre bornage', 'Contrôle de bornage'],
    'Ouverture de Voies & Viabilisation': ['Ouverture des voies', 'Décapage', 'Nivellement', 'Compactage', 'Location bulldozer', 'Location niveleuse', 'Carburant engins', 'Main d\'œuvre chantier'],
    'DTC & Services Techniques': ['Contrôle DTC', 'Frais DTC', 'Certificat DTC', 'Frais cadastraux', 'Numérotation cadastrale'],
    'Transport & Déplacements': ['Carburant véhicule', 'Péage', 'Entretien véhicule', 'Location véhicule', 'Transport personnel', 'Hébergement mission', 'Per diem mission'],
    'Personnel': ['Salaires', 'Primes terrain', 'Primes chantier', 'Heures supplémentaires', 'Indemnités de mission', 'Équipements de protection'],
    'Frais Financiers': ['Frais bancaires', 'Retrait mobile money', 'Transfert d\'argent', 'Intérêts'],
    'Autres Dépenses': ['Dépenses exceptionnelles', 'Imprévus chantier', 'Assistance sociale', 'Divers'],
  };
}


// GET /export — Export Excel dépenses
router.get('/export', auth, toptelsig, async (req, res) => {
  try {
    const { projetId, statut } = req.query;
    const where = {};
    if (projetId) where.projetId = projetId;
    if (statut) where.statut = statut;
    const depenses = await prisma.depenseFoncier.findMany({ where, orderBy: { createdAt: 'desc' },
      include: { projet: { select: { nom: true, code: true } } } });
    const xlsx = require('xlsx');
    const data = depenses.map(d => ({
      Projet: d.projet?.nom || '—', Catégorie: d.categorie, 'Sous-catégorie': d.sousCategorie || '',
      Montant: d.montant, Description: d.description, Bénéficiaire: d.beneficiaire || '',
      'Type paiement': d.typePaiement || '', Statut: d.statut,
      Date: new Date(d.date).toLocaleDateString('fr'),
    }));
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Dépenses');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="depenses_foncier.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
