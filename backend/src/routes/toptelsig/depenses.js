/**
 * TOPTELSIG — Dépenses Foncières
 * Workflow : BROUILLON → DEMANDEE → VALIDATION_RP → VALIDATION_DIR → AUTORISATION_PAIEMENT → PAYEE → JUSTIFIEE → CLOTUREE
 * Compatibilité ascendante avec l'ancien workflow EN_ATTENTE → VALIDEE_N1 → VALIDEE_FINALE → PAYEE
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale, requireRole } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

const CATEGORIES_MAP = {
  'Coutumier & Acquisition Foncière': [
    'Indemnisation propriétaire','Indemnisation exploitant','Indemnisation occupant',
    'Frais coutumiers','Frais notaire','Acte foncier','Autres coutumier'
  ],
  'Topographie & Études': [
    'Levé topographique','Étude géotechnique','Plan parcellaire','Rapport topographique',
    'Bornage','Géomètre','Autres études'
  ],
  'Administratif & Dossiers': [
    'Frais dossier','Frais enregistrement','Frais timbre','Légalisation',
    'Frais notarié','Frais DOMANIAL','Autres administratif'
  ],
  'Lotissement & Bornage': [
    'Bornes','Implantation bornes','Plan de lotissement','Dossier lotissement','Autres lotissement'
  ],
  'Ouverture de Voies & Viabilisation': [
    'Ouverture piste','Nivellement','Compactage','Bordures','Caniveaux','Enrobé','Autres voies'
  ],
  'DTC & Services Techniques': [
    'Électricité','Eau potable','Éclairage public','Télécommunications','Autres DTC'
  ],
  'Assainissement & Environnement': [
    'Drainage','Évacuation eaux','Débroussaillage','Reboisement','Autres assainissement'
  ],
  'Enquêtes & Commissions': [
    'Enquête parcellaire','Commission cadastre','Commission urbanisme','Frais commission','Autres enquête'
  ],
  'Travaux de Construction': [
    'Maçonnerie','Ferraillage','Béton','Finitions','Clôture','Portail','Autres construction'
  ],
  'Transport & Déplacements': [
    'Carburant','Location véhicule','Transport matériaux','Per diem','Autres transport'
  ],
  'Personnel': [
    'Salaires','Primes','Heures sup','Charges sociales','Formation','Autres personnel'
  ],
  'Commercial & Marketing': [
    'Publicité','Impression','Événementiel','Commissions agents','Frais commercial','Autres marketing'
  ],
  'Fournitures & Fonctionnement': [
    'Bureau','Informatique','Téléphone','Internet','Maintenance','Autres fournitures'
  ],
  'Frais Financiers': [
    'Intérêts banque','Frais bancaires','Garanties','Assurances','Autres financiers'
  ],
  'Autres Dépenses': [
    'Imprévus','Divers','Autres'
  ],
};

const CATEGORIES = Object.keys(CATEGORIES_MAP);

const TYPES_BENEFICIAIRES = [
  'Employé','Propriétaire terrien','Exploitant agricole','Occupant',
  'Autorité coutumière','Administration publique','Fournisseur','Entreprise',
  'Bureau d\'étude','Géomètre','Association','Coopérative','Partenaire','Autre'
];

const STATUTS_WORKFLOW = [
  'BROUILLON','DEMANDEE','VALIDATION_RP','VALIDATION_DIR',
  'AUTORISATION_PAIEMENT','PAYEE','JUSTIFIEE','CLOTUREE','REJETEE'
];

// Helper : normaliser anciens statuts vers nouveau workflow
function normaliserStatut(statut) {
  const map = { EN_ATTENTE:'DEMANDEE', VALIDEE_N1:'VALIDATION_DIR', VALIDEE_FINALE:'AUTORISATION_PAIEMENT', ARCHIVEE:'CLOTUREE' };
  return map[statut] || statut;
}

async function logAudit(tx, userId, nom, entiteId, label, avant, apres) {
  try {
    await tx.auditLog.create({ data: {
      utilisateurId: userId, utilisateurNom: nom, filiale: 'TOPTELSIG',
      action: 'UPDATE', entite: 'DepenseFoncier', entiteId, entiteLabel: label,
      avant: avant ? JSON.stringify(avant) : null,
      apres: apres ? JSON.stringify(apres) : null,
    }});
  } catch {}
}

// ── GET / — Liste dépenses ────────────────────────────────────────────────────
router.get('/', auth, toptelsig, async (req, res) => {
  try {
    const { projetId, statut, phaseId, limit = 100, offset = 0 } = req.query;
    const where = {};
    if (projetId) where.projetId = projetId;
    if (statut) where.statut = statut;
    if (phaseId) where.phaseId = phaseId;

    const [data, total] = await Promise.all([
      prisma.depenseFoncier.findMany({
        where, skip: Number(offset), take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          projet: { select: { nom: true, code: true } },
          phase: { select: { nom: true } },
          activite: { select: { nom: true } },
        }
      }),
      prisma.depenseFoncier.count({ where })
    ]);

    // Normaliser statuts anciens
    const normalized = data.map(d => ({ ...d, statut: normaliserStatut(d.statut) }));
    res.json({ data: normalized, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /categories — Liste des catégories ───────────────────────────────────
router.get('/categories', auth, (req, res) => {
  res.json(CATEGORIES_MAP);
});

// ── GET /types-beneficiaires ─────────────────────────────────────────────────
router.get('/types-beneficiaires', auth, (req, res) => {
  res.json(TYPES_BENEFICIAIRES);
});

// ── POST / — Créer une dépense ────────────────────────────────────────────────
router.post('/', auth, toptelsig, async (req, res) => {
  try {
    const {
      projetId, phaseId, activiteId,
      categorie, sousCategorie, description, observations,
      montantPrevu, montantDemande, montant,
      beneficiaire, typeBeneficiaire, beneficiaireId,
      typePaiement, date, initiateurId
    } = req.body;

    if (!projetId) return res.status(400).json({ error: 'projetId requis' });
    if (!categorie) return res.status(400).json({ error: 'categorie requise' });
    if (!description) return res.status(400).json({ error: 'description requise' });
    if (!montant && !montantDemande) return res.status(400).json({ error: 'montant requis' });

    const dep = await prisma.depenseFoncier.create({
      data: {
        projetId, phaseId: phaseId || null, activiteId: activiteId || null,
        categorie, sousCategorie,
        description, observations,
        montantPrevu: montantPrevu ? Number(montantPrevu) : null,
        montantDemande: montantDemande ? Number(montantDemande) : Number(montant),
        montant: Number(montant || montantDemande),
        beneficiaire, typeBeneficiaire, beneficiaireId: beneficiaireId || null,
        typePaiement: typePaiement || null,
        date: date ? new Date(date) : new Date(),
        dateDemande: new Date(),
        initiateurId: initiateurId || req.user.id,
        statut: 'DEMANDEE',
      }
    });

    await prisma.auditLog.create({ data: {
      utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`,
      filiale: 'TOPTELSIG', action: 'CREATE', entite: 'DepenseFoncier', entiteId: dep.id,
      entiteLabel: `${categorie} — ${description.slice(0, 50)} — ${Number(montant || montantDemande).toLocaleString('fr')} F`
    }});

    res.status(201).json(dep);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /:id — Modifier une dépense (si BROUILLON ou DEMANDEE) ────────────────
router.put('/:id', auth, toptelsig, async (req, res) => {
  try {
    const dep = await prisma.depenseFoncier.findUnique({ where: { id: req.params.id } });
    if (!dep) return res.status(404).json({ error: 'Dépense introuvable' });
    const statut = normaliserStatut(dep.statut);
    if (!['BROUILLON','DEMANDEE'].includes(statut)) return res.status(400).json({ error: `Impossible de modifier en statut ${statut}` });

    const { phaseId, activiteId, categorie, sousCategorie, description, observations, montantPrevu, montantDemande, montant, beneficiaire, typeBeneficiaire, typePaiement, date } = req.body;
    const updated = await prisma.depenseFoncier.update({
      where: { id: req.params.id },
      data: {
        ...(phaseId !== undefined && { phaseId: phaseId || null }),
        ...(activiteId !== undefined && { activiteId: activiteId || null }),
        ...(categorie && { categorie }),
        ...(sousCategorie !== undefined && { sousCategorie }),
        ...(description && { description }),
        ...(observations !== undefined && { observations }),
        ...(montantPrevu !== undefined && { montantPrevu: Number(montantPrevu) }),
        ...(montantDemande !== undefined && { montantDemande: Number(montantDemande) }),
        ...(montant !== undefined && { montant: Number(montant) }),
        ...(beneficiaire !== undefined && { beneficiaire }),
        ...(typeBeneficiaire !== undefined && { typeBeneficiaire }),
        ...(typePaiement !== undefined && { typePaiement }),
        ...(date && { date: new Date(date) }),
      }
    });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /:id/workflow — Avancer dans le workflow ──────────────────────────────
router.put('/:id/workflow', auth, toptelsig, async (req, res) => {
  try {
    const { action, motif } = req.body; // action: valider_rp | valider_dir | autoriser | payer | justifier | cloturer | rejeter
    const dep = await prisma.depenseFoncier.findUnique({ where: { id: req.params.id } });
    if (!dep) return res.status(404).json({ error: 'Dépense introuvable' });

    const statutActuel = normaliserStatut(dep.statut);
    let nouveauStatut = statutActuel;
    const data = {};
    const now = new Date();
    const acteurNom = `${req.user.prenom} ${req.user.nom}`;

    const transitions = {
      valider_rp:  { requis: ['DEMANDEE'],              suivant: 'VALIDATION_DIR',          roles: ['DG','DIRECTEUR','RESP_FONCIER','MANAGER'] },
      valider_dir: { requis: ['VALIDATION_DIR'],         suivant: 'AUTORISATION_PAIEMENT',   roles: ['DG','DIRECTEUR'] },
      autoriser:   { requis: ['AUTORISATION_PAIEMENT'], suivant: 'PAYEE',                   roles: ['DG','DIRECTEUR','COMPTABLE'] },
      payer:       { requis: ['AUTORISATION_PAIEMENT','PAYEE'], suivant: 'PAYEE',            roles: ['DG','COMPTABLE'] },
      justifier:   { requis: ['PAYEE'],                 suivant: 'JUSTIFIEE',               roles: ['DG','DIRECTEUR','RESP_FONCIER','COMPTABLE'] },
      cloturer:    { requis: ['JUSTIFIEE'],              suivant: 'CLOTUREE',               roles: ['DG','DIRECTEUR'] },
      rejeter:     { requis: STATUTS_WORKFLOW.filter(s => !['PAYEE','CLOTUREE','REJETEE'].includes(s)), suivant: 'REJETEE', roles: ['DG','DIRECTEUR','RESP_FONCIER'] },
      // Compatibilité anciens boutons
      valider_n1:     { requis: ['DEMANDEE','EN_ATTENTE'],    suivant: 'VALIDATION_DIR',        roles: ['DG','DIRECTEUR','RESP_FONCIER'] },
      valider_finale: { requis: ['VALIDATION_DIR','VALIDEE_N1'], suivant: 'AUTORISATION_PAIEMENT', roles: ['DG','DIRECTEUR'] },
    };

    const trans = transitions[action];
    if (!trans) return res.status(400).json({ error: `Action '${action}' inconnue` });
    if (!trans.roles.includes(req.user.role)) return res.status(403).json({ error: `Rôle insuffisant pour ${action}` });
    if (!trans.requis.some(s => [statutActuel, dep.statut].includes(s))) {
      return res.status(400).json({ error: `Action '${action}' impossible en statut ${statutActuel}` });
    }

    nouveauStatut = trans.suivant;
    data.statut = nouveauStatut;

    if (action === 'rejeter') {
      if (!motif) return res.status(400).json({ error: 'Motif de rejet obligatoire' });
      data.rejete = true; data.rejetePar = req.user.id; data.rejeteMotif = motif;
    }
    if (['payer','autoriser'].includes(action)) {
      data.paye = true; data.payePar = req.user.id; data.payeLe = now;
      data.datePaiement = now;
      data.montantPaye = dep.montant;
      if (req.body.referenceVirement) data.referenceVirement = req.body.referenceVirement;
    }
    if (['valider_rp','valider_n1'].includes(action)) {
      data.valideN1 = true; data.valideN1Par = req.user.id; data.valideN1Le = now; data.valideN1Nom = acteurNom;
      data.dateValidation = now;
    }
    if (['valider_dir','valider_finale'].includes(action)) {
      data.valideFinale = true; data.valideFinalePar = req.user.id; data.valideFinaleLe = now; data.valideFinalNom = acteurNom;
      data.dateValidation = now;
    }

    const updated = await prisma.$transaction(async tx => {
      const dep2 = await tx.depenseFoncier.update({ where: { id: req.params.id }, data });
      await logAudit(tx, req.user.id, acteurNom, dep2.id, `${action} — ${dep2.description?.slice(0,40)}`, { statut: statutActuel }, { statut: nouveauStatut, action, motif });

      // Impact budgétaire si payée
      if (data.paye) {
        const caisse = await tx.caisse.findFirst({ where: { filiale: 'TOPTELSIG', actif: true } });
        if (caisse) {
          await tx.encaissement.create({ data: {
            caisseId: caisse.id, filiale: 'TOPTELSIG', montant: -dep2.montant,
            typePaiement: dep2.typePaiement || 'ESPECES',
            motif: `Dépense: ${dep2.description?.slice(0,50)}`,
            entiteRef: dep2.id, entiteType: 'depense', operateurId: req.user.id,
          }}).catch(() => {});
          await tx.caisse.update({ where: { id: caisse.id }, data: { solde: { decrement: dep2.montant } } }).catch(() => {});
        }
      }
      return dep2;
    });

    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Routes compatibilité ancienne API (conservées) ───────────────────────────
router.put('/:id/valider-n1', auth, requireRole('DG','DIRECTEUR','RESP_FONCIER'), async (req, res) => {
  req.body.action = 'valider_rp';
  return router.handle({ ...req, url: `/${req.params.id}/workflow`, method: 'PUT' }, res, () => {
    res.status(500).json({ error: 'Redirection interne échouée' });
  });
});

// Fallback simple pour anciens boutons
router.put('/:id/valider-finale', auth, requireRole('DG','DIRECTEUR'), async (req, res) => {
  try {
    const dep = await prisma.depenseFoncier.update({
      where: { id: req.params.id },
      data: { statut: 'AUTORISATION_PAIEMENT', valideFinale: true, valideFinalePar: req.user.id, valideFinaleLe: new Date(), valideFinalNom: `${req.user.prenom} ${req.user.nom}`, dateValidation: new Date() }
    });
    res.json(dep);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/payer', auth, requireRole('DG','COMPTABLE'), async (req, res) => {
  try {
    const dep = await prisma.depenseFoncier.update({
      where: { id: req.params.id },
      data: { statut: 'PAYEE', paye: true, payePar: req.user.id, payeLe: new Date(), datePaiement: new Date(), montantPaye: (await prisma.depenseFoncier.findUnique({ where: { id: req.params.id }, select: { montant: true } })).montant, referenceVirement: req.body.referenceVirement }
    });
    res.json(dep);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/rejeter', auth, requireRole('DG','DIRECTEUR','RESP_FONCIER','COMPTABLE'), async (req, res) => {
  try {
    if (!req.body.motif) return res.status(400).json({ error: 'Motif requis' });
    const dep = await prisma.depenseFoncier.update({
      where: { id: req.params.id },
      data: { statut: 'REJETEE', rejete: true, rejetePar: req.user.id, rejeteMotif: req.body.motif }
    });
    res.json(dep);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /stats ────────────────────────────────────────────────────────────────
router.get('/stats', auth, toptelsig, async (req, res) => {
  try {
    const { projetId } = req.query;
    const where = projetId ? { projetId } : {};

    const [total, parStatut, parCategorie] = await Promise.all([
      prisma.depenseFoncier.aggregate({ _sum: { montant: true }, _count: { id: true }, where }),
      prisma.depenseFoncier.groupBy({ by: ['statut'], _sum: { montant: true }, _count: { id: true }, where }),
      prisma.depenseFoncier.groupBy({ by: ['categorie'], _sum: { montant: true }, where, orderBy: { _sum: { montant: 'desc' } }, take: 10 }),
    ]);

    res.json({
      total: total._sum.montant || 0,
      nbDepenses: total._count.id || 0,
      parStatut: parStatut.map(s => ({ statut: normaliserStatut(s.statut), montant: s._sum.montant || 0, count: s._count.id })),
      parCategorie: parCategorie.map(c => ({ categorie: c.categorie, montant: c._sum.montant || 0 })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /export ───────────────────────────────────────────────────────────────
router.get('/export', auth, toptelsig, async (req, res) => {
  try {
    const { projetId, statut } = req.query;
    const where = {};
    if (projetId) where.projetId = projetId;
    if (statut) where.statut = statut;
    const depenses = await prisma.depenseFoncier.findMany({
      where, orderBy: { date: 'desc' },
      include: { projet: { select: { nom: true } }, phase: { select: { nom: true } } }
    });
    res.json(depenses);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
