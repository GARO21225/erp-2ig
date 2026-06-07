// ── PROJETS FONCIERS
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

// Projets
router.get('/', auth, toptelsig, async (req, res) => {
  try {
    const projets = await prisma.projetFoncier.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { lots: true } },
        lots: {
          select: { statut: true },
        }
      }
    });

    const enriched = projets.map(p => {
      const stats = p.lots.reduce((acc, l) => {
        acc[l.statut] = (acc[l.statut] || 0) + 1;
        return acc;
      }, {});
      return { ...p, statsLots: stats };
    });

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', auth, toptelsig, async (req, res) => {
  try {
    const projet = await prisma.projetFoncier.findUnique({
      where: { id: req.params.id },
      include: {
        lots: {
          include: {
            vente: { include: { souscripteur: true, echeanciers: true } },
            reservations: { include: { souscripteur: true } }
          }
        },
        depenses: { orderBy: { date: 'desc' } }
      }
    });
    if (!projet) return res.status(404).json({ error: 'Projet introuvable' });

    // Stats financières
    const depensesTotal = projet.depenses.reduce((s, d) => s + d.montant, 0);
    const ventesTotal = projet.lots
      .filter(l => l.vente)
      .reduce((s, l) => s + l.vente.prixVente, 0);

    res.json({ ...projet, depensesTotal, ventesTotal, rentabilite: ventesTotal - depensesTotal });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, toptelsig, async (req, res) => {
  try {
    const projet = await prisma.projetFoncier.create({ data: req.body });
    res.status(201).json(projet);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', auth, toptelsig, async (req, res) => {
  try {
    const projet = await prisma.projetFoncier.update({ where: { id: req.params.id }, data: req.body });
    res.json(projet);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Seed catégories de dépenses (depuis PDF 2IG)
router.get('/categories-depenses', auth, toptelsig, (req, res) => {
  res.json(getCategoriesDepenses());
});

function getCategoriesDepenses() {
  return {
    'Coutumier & Acquisition Foncière': [
      'Dotation chef de village', 'Dotation notables', 'Dotation propriétaires terriens',
      'Frais de négociation foncière', 'Indemnisation exploitants agricoles', 'Indemnisation occupants',
      'Achat de terrain', 'Frais de convention foncière', 'Cadeaux et relations coutumières',
      'Organisation de réunions villageoises', 'Transport autorités coutumières'
    ],
    'Topographie & Études': [
      'Délimitation terrain', 'Coupe et ouverture de layons', 'Piquets et bornes provisoires',
      'GPS et rattachement', 'Levé topographique', 'Plan d\'urbanisme', 'Plan parcellaire',
      'Impression plans', 'Signature géomètre expert', 'Mission topographique', 'Location matériel topo'
    ],
    'Administratif & Dossiers': [
      'Frais de timbres', 'Frais de légalisation', 'Photocopies et impressions',
      'Frais de dépôt de dossier', 'Courriers administratifs', 'Transport dossiers',
      'Honoraires juridiques', 'Honoraires consultant'
    ],
    'Lotissement & Bornage': [
      'Application du lotissement', 'Bornage définitif', 'Implantation des bornes',
      'Achat de bornes', 'Main d\'œuvre bornage', 'Contrôle de bornage'
    ],
    'Ouverture de Voies & Viabilisation': [
      'Ouverture des voies', 'Décapage', 'Nivellement', 'Compactage',
      'Location bulldozer', 'Location niveleuse', 'Carburant engins', 'Main d\'œuvre chantier'
    ],
    'DTC & Services Techniques': [
      'Contrôle DTC', 'Frais DTC', 'Certificat DTC', 'Frais cadastraux', 'Numérotation cadastrale'
    ],
    'Assainissement & Environnement': [
      'Étude d\'assainissement', 'Drainage', 'Fossés', 'Gestion environnementale'
    ],
    'Transport & Déplacements': [
      'Carburant véhicule', 'Péage', 'Entretien véhicule', 'Location véhicule',
      'Transport personnel', 'Hébergement mission', 'Per diem mission'
    ],
    'Personnel': [
      'Salaires', 'Primes terrain', 'Primes chantier', 'Heures supplémentaires',
      'Indemnités de mission', 'Équipements de protection'
    ],
    'Frais Financiers': [
      'Frais bancaires', 'Retrait mobile money', 'Transfert d\'argent', 'Intérêts'
    ],
    'Autres Dépenses': [
      'Dépenses exceptionnelles', 'Imprévus chantier', 'Assistance sociale', 'Divers'
    ]
  };
}

module.exports = router;
