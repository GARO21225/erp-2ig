/**
 * TOPTELSIG — Souscripteurs
 * Règle : Souscripteur = contact ayant effectué AU MOINS UN paiement
 * CRM = Prospects sans paiement
 * Statuts par projet, pas globalement
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale, requireRole } = require('../../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const toptelsig = requireFiliale('TOPTELSIG');
const upload2 = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Helper : statut souscripteur calculé depuis ses ventes/paiements
function calculerStatutSouscripteur(souscripteur) {
  const ventes = souscripteur.ventes || [];
  if (!ventes.length) return 'PROSPECT';

  const avecPaiement = ventes.filter(v => (v.paiements?.length || v._count?.paiements) > 0);
  if (!avecPaiement.length) return 'PROSPECT';

  const tousUneVente = ventes.every(v => v.statut === 'SOLDE');
  if (tousUneVente) return 'SOLDE';

  const enRetard = ventes.some(v =>
    v.echeanciers?.some(e => e.statut === 'RETARD')
  );
  if (enRetard) return 'EN_RETARD';

  return 'ACTIF';
}

// Helper : premier paiement date
function premierPaiement(ventes) {
  const all = ventes.flatMap(v => v.paiements || []);
  if (!all.length) return null;
  return all.reduce((min, p) => !min || new Date(p.createdAt) < new Date(min) ? p.createdAt : min, null);
}

// ── GET / — Liste souscripteurs (avec paiements seulement) ────────────────────
router.get('/', auth, toptelsig, async (req, res) => {
  try {
    const {
      search, projetId, commercialId, statut,
      page = 1, limit = 50, inclureCRM = 'false'
    } = req.query;

    const where = {};

    // Souscripteurs = contacts ayant effectué AU MOINS UN paiement
    if (inclureCRM !== 'true') {
      where.paiements = { some: {} };
    }

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { telephone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { code: { contains: search } },
        { ventes: { some: { lot: { numero: { contains: search, mode: 'insensitive' } } } } },
      ];
    }

    if (projetId) {
      where.ventes = { some: { lot: { projetId } } };
    }

    if (commercialId) {
      where.commercialId = commercialId;
    }

    // Statut calculé (filtre post-requête si nécessaire)
    const [total, souscripteurs] = await Promise.all([
      prisma.souscripteur.count({ where }),
      prisma.souscripteur.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          prescripteur: { select: { nom: true, prenom: true } },
          ventes: {
            include: {
              lot: { include: { projet: { select: { id:true, nom: true, code: true, ville: true } } } },
              echeanciers: { orderBy: { dateEcheance: 'asc' }, select: { id:true, numero:true, montant:true, dateEcheance:true, statut:true, montantPaye:true } },
              paiements: { orderBy: { createdAt: 'desc' }, select: { id:true, montant:true, createdAt:true, typePaiement:true, reference:true } },
              _count: { select: { paiements: true } },
            }
          },
          relances: { orderBy: { dateRelance: 'desc' }, take: 3, select: { id:true, canal:true, dateRelance:true, resultat:true } },
          _count: { select: { paiements: true, ventes: true } },
        }
      })
    ]);

    // Enrichir avec statut calculé
    const enriched = souscripteurs.map(s => {
      const statutCalc = calculerStatutSouscripteur(s);
      const premPmt = premierPaiement(s.ventes);
      const totalPaye = s.ventes.reduce((sum, v) => sum + v.paiements.reduce((s2, p) => s2 + p.montant, 0), 0);
      const totalDu = s.ventes.reduce((sum, v) => sum + (v.prixVente || 0), 0);
      const prochEcheance = s.ventes.flatMap(v => v.echeanciers?.filter(e => e.statut === 'EN_ATTENTE') || [])
        .sort((a, b) => new Date(a.dateEcheance) - new Date(b.dateEcheance))[0];

      return {
        ...s,
        statutCalc,
        premierPaiement: premPmt,
        totalPaye,
        totalDu,
        restant: totalDu - totalPaye,
        tauxPaiement: totalDu > 0 ? Math.round(totalPaye / totalDu * 100) : 0,
        prochEcheance: prochEcheance || null,
      };
    });

    // Filtrer par statut calculé si demandé
    const filtered = statut ? enriched.filter(s => s.statutCalc === statut) : enriched;

    res.json({
      data: filtered,
      total: filtered.length,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /dashboard — KPI souscripteurs ───────────────────────────────────────
router.get('/dashboard', auth, toptelsig, async (req, res) => {
  try {
    const { projetId } = req.query;
    const whereVente = projetId ? { lot: { projetId } } : {};

    const [nbTotal, totalMontants, ventesSoldes, ventesEnCours, retards, nouveaux] = await Promise.all([
      prisma.souscripteur.count({ where: { paiements: { some: {} } } }),
      prisma.paiementFoncier.aggregate({ _sum: { montant: true }, where: projetId ? { vente: { lot: { projetId } } } : {} }),
      prisma.venteFoncier.count({ where: { ...whereVente, statut: 'SOLDE' } }),
      prisma.venteFoncier.count({ where: { ...whereVente, statut: 'EN_COURS' } }),
      prisma.echeancier.count({ where: { statut: 'RETARD', ...(projetId ? { vente: { lot: { projetId } } } : {}) } }),
      prisma.souscripteur.count({
        where: {
          paiements: { some: {} },
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
        }
      }),
    ]);

    const totalDu = await prisma.venteFoncier.aggregate({ _sum: { prixVente: true }, where: whereVente });
    const totalEncaisse = totalMontants._sum.montant || 0;
    const totalPrevu = totalDu._sum.prixVente || 0;

    res.json({
      nbTotal,
      nbNouveaux: nouveaux,
      nbActifs: ventesEnCours,
      nbSoldes: ventesSoldes,
      nbEnRetard: retards,
      totalSouscrit: totalPrevu,
      totalEncaisse,
      totalRestant: totalPrevu - totalEncaisse,
      tauxRecouvrement: totalPrevu > 0 ? Math.round(totalEncaisse / totalPrevu * 100) : 0,
      montantMoyen: nbTotal > 0 ? Math.round(totalEncaisse / nbTotal) : 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /:id — Vue 360° souscripteur ─────────────────────────────────────────
router.get('/:id', auth, toptelsig, async (req, res) => {
  try {
    const s = await prisma.souscripteur.findUnique({
      where: { id: req.params.id },
      include: {
        prescripteur: true,
        relances: { orderBy: { dateRelance: 'desc' }, take: 20 },
        ventes: {
          include: {
            lot: { include: { projet: true } },
            echeanciers: { orderBy: { numero: 'asc' } },
            paiements: {
              orderBy: { createdAt: 'asc' },
              include: { vente: { include: { lot: { select: { numero: true } } } } }
            },
          }
        },
        documents: { orderBy: { createdAt: 'desc' } },
        paiements: { orderBy: { createdAt: 'desc' }, take: 50, include: { vente: { include: { lot: { select: { numero:true, projet:{ select:{ nom:true } } } } } } } },
      }
    });
    if (!s) return res.status(404).json({ error: 'Souscripteur introuvable' });

    const statutCalc = calculerStatutSouscripteur(s);
    const totalPaye = s.paiements.reduce((sum, p) => sum + p.montant, 0);
    const totalDu = s.ventes.reduce((sum, v) => sum + (v.prixVente || 0), 0);

    res.json({
      ...s,
      statutCalc,
      totalPaye,
      totalDu,
      restant: totalDu - totalPaye,
      tauxPaiement: totalDu > 0 ? Math.round(totalPaye / totalDu * 100) : 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST / — Créer un contact (prospect ou souscripteur) ─────────────────────
router.post('/', auth, toptelsig, async (req, res) => {
  try {
    const { nom, prenom, telephone, email, adresse, profession, numeroCni,
      sourceAcquisition, commercialId, commercialNom, statut = 'PROSPECT', code } = req.body;

    if (!nom || !prenom || !telephone) return res.status(400).json({ error: 'nom, prenom, telephone requis' });

    const genCode = () => `2IG-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const s = await prisma.souscripteur.create({
      data: { code: code || genCode(), nom, prenom, telephone, email, adresse, profession, numeroCni,
        sourceAcquisition, commercialId, commercialNom, statut }
    });
    res.status(201).json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /:id — Modifier ───────────────────────────────────────────────────────
router.put('/:id', auth, toptelsig, async (req, res) => {
  try {
    const { nom, prenom, telephone, email, adresse, profession, numeroCni,
      sourceAcquisition, commercialId, commercialNom, statut,
      raisonPerte, canalConversion } = req.body;
    const s = await prisma.souscripteur.update({
      where: { id: req.params.id },
      data: {
        ...(nom && { nom }), ...(prenom && { prenom }),
        ...(telephone && { telephone }), ...(email !== undefined && { email }),
        ...(adresse !== undefined && { adresse }), ...(profession !== undefined && { profession }),
        ...(numeroCni !== undefined && { numeroCni }), ...(sourceAcquisition !== undefined && { sourceAcquisition }),
        ...(commercialId !== undefined && { commercialId }), ...(commercialNom !== undefined && { commercialNom }),
        ...(statut && { statut }), ...(raisonPerte !== undefined && { raisonPerte }),
        ...(canalConversion !== undefined && { canalConversion }),
      }
    });
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /:id/paiements — Ajouter un paiement + conversion auto ───────────────
router.post('/:id/paiements', auth, toptelsig, async (req, res) => {
  try {
    const { venteId, echeancierId, montant, typePaiement, reference, agentNom } = req.body;
    if (!venteId || !montant || !typePaiement) return res.status(400).json({ error: 'venteId, montant, typePaiement requis' });

    const vente = await prisma.venteFoncier.findUnique({
      where: { id: venteId },
      include: { souscripteur: true, paiements: true, echeanciers: true, lot: { include: { projet: true } } }
    });
    if (!vente) return res.status(404).json({ error: 'Vente introuvable' });

    const pmt = await prisma.$transaction(async (tx) => {
      // Créer le paiement
      const p = await tx.paiementFoncier.create({
        data: {
          venteId, souscripteurId: req.params.id,
          montant: Number(montant), typePaiement, reference,
          agentId: req.user.id, agentNom: agentNom || `${req.user.prenom} ${req.user.nom}`,
          ...(echeancierId && { echeancierId }),
        }
      });

      // Mettre à jour l'échéancier si spécifié
      if (echeancierId) {
        const ech = vente.echeanciers.find(e => e.id === echeancierId);
        if (ech) {
          const nouveauPaye = (ech.montantPaye || 0) + Number(montant);
          await tx.echeancier.update({
            where: { id: echeancierId },
            data: {
              montantPaye: nouveauPaye,
              statut: nouveauPaye >= ech.montant ? 'PAYE' : 'PARTIEL'
            }
          });
        }
      }

      // Vérifier si la vente est soldée
      const tousLespmts = await tx.paiementFoncier.aggregate({ _sum: { montant: true }, where: { venteId } });
      const totalPaye = tousLespmts._sum.montant || 0;
      if (totalPaye >= vente.prixVente) {
        await tx.venteFoncier.update({ where: { id: venteId }, data: { statut: 'SOLDE' } });
      }

      // CONVERSION AUTOMATIQUE : Premier paiement → statut ACTIF
      const estPremierPaiement = vente.paiements.length === 0;
      if (estPremierPaiement && vente.souscripteur.statut === 'PROSPECT') {
        await tx.souscripteur.update({
          where: { id: req.params.id },
          data: { statut: 'ACTIF', canalConversion: typePaiement, raisonConversion: `Premier paiement sur ${vente.lot?.projet?.nom || 'projet'}` }
        });
      }

      return p;
    });

    res.status(201).json(pmt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /template — Template import ──────────────────────────────────────────
router.get('/template', auth, toptelsig, (_, res) => {
  const headers = ['code','nom *','prenom *','telephone *','email','profession','adresse','cni','source','commercial_nom'];
  const examples = [
    ['2IG-00001','KOUAME','Jean','0708937608','jean@example.ci','Commerçant','Abidjan','CI1234','Facebook','Marie DUPONT'],
    ['2IG-00002','TRAORE','Awa','0507123456','awa@example.ci','Fonctionnaire','Yamoussoukro','CI5678','Référence','Paul DIALLO'],
  ];
  res.setHeader('Content-Disposition','attachment; filename="template_souscripteurs.csv"');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.send('\uFEFF' + [headers,...examples].map(r=>r.join(';')).join('\r\n'));
});

// ── POST /import — Import Excel ───────────────────────────────────────────────
router.post('/import', auth, toptelsig, upload2.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const wb = XLSX.read(req.file.buffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
    const headers = rows[0].map(h => String(h).toLowerCase().replace(/\s+\*.*$/, '').trim());

    let created = 0, errors = 0;
    for (const row of rows.slice(1)) {
      const get = (k) => String(row[headers.indexOf(k)] || '').trim();
      const nom = get('nom'); const prenom = get('prenom'); const tel = get('telephone');
      if (!nom || !prenom || !tel) { errors++; continue; }
      try {
        const code = get('code') || `IMP-${Date.now().toString(36).toUpperCase().slice(-5)}`;
        await prisma.souscripteur.upsert({
          where: { code },
          update: { nom, prenom, telephone: tel, email: get('email')||null, profession: get('profession')||null, adresse: get('adresse')||null, commercialNom: get('commercial_nom')||null },
          create: { code, nom, prenom, telephone: tel, email: get('email')||null, profession: get('profession')||null, adresse: get('adresse')||null, numeroCni: get('cni')||null, sourceAcquisition: get('source')||null, commercialNom: get('commercial_nom')||null, statut: 'PROSPECT' }
        });
        created++;
      } catch { errors++; }
    }
    res.json({ message: `Import terminé`, created, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
