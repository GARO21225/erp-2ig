const router = require('express').Router();
const safe = async (fn) => { try { return await fn(); } catch { return null; } };
const prisma = require('../lib/prisma');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/employes
router.get('/', auth, async (req, res) => {
  try {
    const { filiale, statut, search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (filiale) where.filiale = filiale;
    if (statut) where.statut = statut;
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { matricule: { contains: search, mode: 'insensitive' } },
        { poste: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Essayer avec les relations, fallback sans si tables absentes
    let employes = [], total = 0;
    try {
      [total, employes] = await Promise.all([
        prisma.employe.count({ where }),
        prisma.employe.findMany({
          where,
          skip: (page - 1) * limit,
          take: Number(limit),
          orderBy: { nom: 'asc' },
          include: {
            conges: { where: { statut: 'APPROUVE', dateFin: { gte: new Date() } }, take: 1 },
            _count: { select: { conges: true, evaluations: true } }
          }
        })
      ]);
    } catch {
      // Fallback sans relations (si tables pas encore créées)
      [total, employes] = await Promise.all([
        prisma.employe.count({ where }),
        prisma.employe.findMany({ where, skip: (page-1)*limit, take: Number(limit), orderBy: { nom: 'asc' } })
      ]);
    }

    res.json({ data: employes, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/employes/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const employe = await prisma.employe.findUnique({
      where: { id: req.params.id },
      include: {
        conges: { orderBy: { createdAt: 'desc' }, take: 10 },
        evaluations: { orderBy: { createdAt: 'desc' }, take: 5 },
        sanctions: { orderBy: { createdAt: 'desc' } },
        avances: { orderBy: { createdAt: 'desc' } },
        bonus: { orderBy: { createdAt: 'desc' }, take: 12 },
        rotationsRepos: { orderBy: { annee: 'desc' }, take: 10 },
        documents: { orderBy: { createdAt: 'desc' } },
        fiches_paie: { orderBy: { annee: 'desc' }, take: 12 },
      }
    });
    if (!employe) return res.status(404).json({ error: 'Employé introuvable' });
    res.json(employe);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/employes
router.post('/', auth, requireRole('DG', 'RH', 'DIRECTEUR'), async (req, res) => {
  try {
    const { matricule, nom, prenom, telephone, email, filiale, poste, departement,
            dateEmbauche, salaireBase, adresse, numeroCni } = req.body;

    const employe = await prisma.employe.create({
      data: { matricule, nom, prenom, telephone, email, filiale, poste, departement,
              dateEmbauche: new Date(dateEmbauche), salaireBase: Number(salaireBase),
              adresse, numeroCni }
    });

    await prisma.auditLog.create({
      data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale, action: 'CREATE', entite: 'Employe', entiteId: employe.id, entiteLabel: `${prenom} ${nom} — ${poste}` }
    });

    res.status(201).json(employe);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Matricule déjà utilisé' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/employes/:id
router.put('/:id', auth, requireRole('DG', 'RH', 'DIRECTEUR'), async (req, res) => {
  try {
    const employe = await prisma.employe.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(employe);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Congés
router.post('/:id/conges', auth, async (req, res) => {
  try {
    const conge = await prisma.conge.create({
      data: { ...req.body, employeId: req.params.id, dateDebut: new Date(req.body.dateDebut), dateFin: new Date(req.body.dateFin) }
    });
    res.status(201).json(conge);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/conges/:congeId', auth, requireRole('DG', 'RH', 'DIRECTEUR', 'MANAGER'), async (req, res) => {
  try {
    const conge = await prisma.conge.update({
      where: { id: req.params.congeId },
      data: { statut: req.body.statut, approuvePar: req.user.id }
    });
    res.json(conge);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Avances
router.post('/:id/avances', auth, async (req, res) => {
  try {
    // Fix 18 — Vérifier qu'il n'y a pas déjà une avance non remboursée
    const avanceActive = await prisma.avance.findFirst({
      where: {
        employeId: req.params.id,
        statut: { in: ['EN_ATTENTE', 'APPROUVEE'] },
      }
    });
    if (avanceActive) {
      return res.status(400).json({
        error: `Cet employé a déjà une avance active (${avanceActive.montant.toLocaleString('fr')} F — statut : ${avanceActive.statut}). Remboursement requis avant nouvelle avance.`
      });
    }

    const avance = await prisma.avance.create({
      data: { ...req.body, employeId: req.params.id, montant: Number(req.body.montant) }
    });
    res.status(201).json(avance);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Évaluations
router.post('/:id/evaluations', auth, requireRole('DG', 'RH', 'DIRECTEUR', 'MANAGER'), async (req, res) => {
  try {
    const eval_ = await prisma.evaluation.create({
      data: { ...req.body, employeId: req.params.id, note: Number(req.body.note), evaluateurId: req.user.id }
    });
    res.status(201).json(eval_);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Rotations repos
router.get('/rotations/semaine', auth, async (req, res) => {
  try {
    const { semaine, annee, filiale } = req.query;
    const rotations = await prisma.rotationRepos.findMany({
      where: { semaine: Number(semaine), annee: Number(annee), employe: { filiale } },
      include: { employe: { select: { nom: true, prenom: true, poste: true } } }
    });
    res.json(rotations);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/rotations', auth, requireRole('DG', 'MANAGER', 'DIRECTEUR'), async (req, res) => {
  try {
    const { rotations } = req.body; // [{ employeId, semaine, annee, jourRepos }]
    const result = await prisma.rotationRepos.createMany({ data: rotations, skipDuplicates: true });
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Fiches de paie
router.post('/:id/paie', auth, requireRole('DG', 'RH', 'COMPTABLE'), async (req, res) => {
  try {
    const employe = await prisma.employe.findUnique({ where: { id: req.params.id } });
    const avances = await prisma.avance.aggregate({
      _sum: { montant: true },
      where: { employeId: req.params.id, statut: 'APPROUVEE' }
    });
    const bonus = await prisma.bonus.aggregate({
      _sum: { montant: true },
      where: { employeId: req.params.id, mois: req.body.mois, annee: req.body.annee }
    });

    const netAPayer = employe.salaireBase + (bonus._sum.montant || 0) - (avances._sum.montant || 0);

    const fiche = await prisma.fichePaie.create({
      data: {
        employeId: req.params.id,
        mois: req.body.mois,
        annee: req.body.annee,
        salaireBase: employe.salaireBase,
        primes: bonus._sum.montant || 0,
        avancesDeduit: avances._sum.montant || 0,
        netAPayer,
      }
    });
    res.status(201).json(fiche);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ── Import Excel employés ─────────────────────────────────────────────────────
const multer = require('multer');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/template', auth, async (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['matricule *', 'nom *', 'prenom *', 'telephone *', 'poste *', 'filiale *', 'departement', 'dateEmbauche * (AAAA-MM-JJ)', 'salaireBase *'],
    ['YG-001', 'KOFFI', 'Adjoua', '07 07 07 07 07', 'Serveuse', 'YAKRO_GRILL', 'Service', '2026-01-15', 120000],
  ]);
  ws['!cols'] = Array(9).fill({ wch: 22 });
  XLSX.utils.book_append_sheet(wb, ws, 'Employés');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="template_employes_2ig.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

router.post('/import', auth, requireRole('DG', 'RH', 'DIRECTEUR'), upload.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) return res.status(400).json({ error: 'Fichier vide' });

    const headers = rows[0].map(h => String(h).toLowerCase().trim().replace(/ \*.*$/, '').replace(/[^a-z]/g, ''));
    const dataRows = rows.slice(1).filter(r => r.some(c => c !== ''));
    const idx = {};
    headers.forEach((h, i) => { idx[h] = i; });

    const resultats = { importes: 0, erreurs: [] };

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const lineNum = i + 2;
      const matricule = String(row[idx['matricule']] || '').trim();
      const nom = String(row[idx['nom']] || '').trim();
      const prenom = String(row[idx['prenom']] || '').trim();
      const telephone = String(row[idx['telephone']] || '').trim();
      const poste = String(row[idx['poste']] || '').trim();
      const filiale = String(row[idx['filiale']] || '').trim();
      const dateEmbauche = String(row[idx['dateembauche']] || row[idx['dateembauchejj']] || '').trim();
      const salaireBase = Number(row[idx['salairebase']] || 0);

      if (!matricule || !nom || !prenom || !telephone || !poste || !filiale || !dateEmbauche || !salaireBase) {
        resultats.erreurs.push(`Ligne ${lineNum} : champs obligatoires manquants`); continue;
      }

      const valid = ['YAKRO_GRILL', 'TOPTELSIG', 'LIYA', 'GROUPE'];
      if (!valid.includes(filiale)) { resultats.erreurs.push(`Ligne ${lineNum} (${matricule}) : filiale invalide "${filiale}"`); continue; }

      const existing = await prisma.employe.findUnique({ where: { matricule } });
      if (existing) { resultats.erreurs.push(`Ligne ${lineNum} (${matricule}) : matricule déjà existant`); continue; }

      await prisma.employe.create({
        data: { matricule, nom, prenom, telephone, poste, filiale, dateEmbauche: new Date(dateEmbauche), salaireBase,
                departement: String(row[idx['departement']] || '').trim() || null }
      });
      resultats.importes++;
    }

    res.json({ message: `${resultats.importes} employé(s) importé(s)`, ...resultats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Génération automatique rotation repos (appelable par cron ou manuellement)
router.post('/rotations/generer', auth, requireRole('DG', 'MANAGER', 'DIRECTEUR', 'RH'), async (req, res) => {
  try {
    const { filiale, semaine, annee } = req.body;
    if (!filiale || !semaine || !annee) {
      return res.status(400).json({ error: 'filiale, semaine, annee requis' });
    }

    const employes = await prisma.employe.findMany({
      where: { filiale, statut: 'ACTIF' },
      select: { id: true, nom: true, prenom: true, poste: true }
    });

    if (employes.length === 0) {
      return res.status(400).json({ error: `Aucun employé actif pour la filiale ${filiale}` });
    }

    const JOURS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];

    // Supprimer les rotations existantes pour cette semaine
    await prisma.rotationRepos.deleteMany({ where: { semaine: Number(semaine), annee: Number(annee), employe: { filiale } } });

    // Récupérer l'historique récent pour assurer la rotation équitable
    const historique = await prisma.rotationRepos.findMany({
      where: { employe: { filiale }, annee: Number(annee) },
      orderBy: { semaine: 'desc' },
      take: employes.length * 4,
    });

    // Compter les repos par jour pour chaque employé (histogramme)
    const compteurJours = {};
    employes.forEach(e => { compteurJours[e.id] = {}; JOURS.forEach(j => { compteurJours[e.id][j] = 0; }); });
    historique.forEach(r => { if (compteurJours[r.employeId]) compteurJours[r.employeId][r.jourRepos] = (compteurJours[r.employeId][r.jourRepos] || 0) + 1; });

    // Algorithme : assigner le jour le moins utilisé à chaque employé
    // Contrainte : max n/7 employés par jour (répartition équitable)
    const jourCount = {};
    JOURS.forEach(j => { jourCount[j] = 0; });
    const rotations = [];

    for (const employe of employes) {
      // Trier les jours par fréquence ascendante pour cet employé
      const joursDispos = [...JOURS].sort((a, b) => {
        const diffFreq = (compteurJours[employe.id][a] || 0) - (compteurJours[employe.id][b] || 0);
        if (diffFreq !== 0) return diffFreq;
        return jourCount[a] - jourCount[b]; // équilibrer aussi entre employés
      });

      const jourChoisi = joursDispos[0];
      jourCount[jourChoisi]++;
      rotations.push({ employeId: employe.id, semaine: Number(semaine), annee: Number(annee), jourRepos: jourChoisi });
    }

    await prisma.rotationRepos.createMany({ data: rotations, skipDuplicates: true });

    res.json({
      message: `${rotations.length} rotation(s) générée(s) pour semaine ${semaine}/${annee}`,
      rotations: rotations.map(r => {
        const emp = employes.find(e => e.id === r.employeId);
        return { ...r, employe: emp };
      })
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /:id/suspension — Suspendre un employé (disciplinaire)
router.post('/:id/suspension', auth, requireRole('DG', 'DIRECTEUR', 'RH'), async (req, res) => {
  try {
    const { motif, dateDebut, dateFin } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif de suspension obligatoire' });
    const employe = await prisma.employe.findUnique({ where: { id: req.params.id } });
    if (!employe) return res.status(404).json({ error: 'Employé introuvable' });
    if (employe.statut === 'QUITTE') return res.status(400).json({ error: 'Employé déjà quitté' });

    await prisma.$transaction(async (tx) => {
      await tx.employe.update({ where: { id: req.params.id }, data: { statut: 'SUSPENDU' } });
      await tx.sanction.create({ data: { employeId: req.params.id, type: 'MISE_A_PIED', motif, dateEffet: dateDebut ? new Date(dateDebut) : new Date(), decision: dateFin ? `Jusqu'au ${new Date(dateFin).toLocaleDateString('fr')}` : 'Durée indéterminée' } });
      // Désactiver le compte utilisateur si existant
      if (employe.utilisateurId) await tx.utilisateur.update({ where: { id: employe.utilisateurId }, data: { actif: false } });
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: employe.filiale, action: 'UPDATE', entite: 'Employe', entiteId: employe.id, entiteLabel: `Suspension: ${motif}`, avant: { statut: employe.statut }, apres: { statut: 'SUSPENDU', motif } } });
    });
    res.json({ message: 'Employé suspendu' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/demission — Enregistrer une démission
router.post('/:id/demission', auth, requireRole('DG', 'DIRECTEUR', 'RH'), async (req, res) => {
  try {
    const { dateEffective, motif } = req.body;
    if (!dateEffective) return res.status(400).json({ error: 'Date effective de démission obligatoire' });
    const employe = await prisma.employe.findUnique({ where: { id: req.params.id } });
    if (!employe) return res.status(404).json({ error: 'Employé introuvable' });

    await prisma.$transaction(async (tx) => {
      await tx.employe.update({ where: { id: req.params.id }, data: { statut: 'DEMISSIONNAIRE' } });
      await tx.sanction.create({ data: { employeId: req.params.id, type: 'LICENCIEMENT', motif: motif || 'Démission volontaire', dateEffet: new Date(dateEffective), decision: 'Démission' } });
      if (employe.utilisateurId) {
        const dateEff = new Date(dateEffective);
        if (dateEff <= new Date()) await tx.utilisateur.update({ where: { id: employe.utilisateurId }, data: { actif: false } });
      }
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: employe.filiale, action: 'UPDATE', entite: 'Employe', entiteId: employe.id, entiteLabel: `Démission effective le ${new Date(dateEffective).toLocaleDateString('fr')}`, avant: { statut: employe.statut }, apres: { statut: 'DEMISSIONNAIRE', dateEffective } } });
    });
    res.json({ message: 'Démission enregistrée' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/reinstate — Réintégrer un employé suspendu
router.post('/:id/reinstate', auth, requireRole('DG', 'DIRECTEUR', 'RH'), async (req, res) => {
  try {
    const { motif } = req.body;
    const employe = await prisma.employe.findUnique({ where: { id: req.params.id } });
    if (!employe) return res.status(404).json({ error: 'Employé introuvable' });
    if (employe.statut !== 'SUSPENDU') return res.status(400).json({ error: `Réintégration impossible — statut: ${employe.statut}` });
    await prisma.$transaction(async (tx) => {
      await tx.employe.update({ where: { id: req.params.id }, data: { statut: 'ACTIF' } });
      if (employe.utilisateurId) await tx.utilisateur.update({ where: { id: employe.utilisateurId }, data: { actif: true } });
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: employe.filiale, action: 'UPDATE', entite: 'Employe', entiteId: employe.id, entiteLabel: `Réintégration${motif ? ': ' + motif : ''}`, avant: { statut: 'SUSPENDU' }, apres: { statut: 'ACTIF' } } });
    });
    res.json({ message: 'Employé réintégré' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/changement-poste — Changement de poste / filiale
router.post('/:id/changement-poste', auth, requireRole('DG', 'DIRECTEUR', 'RH'), async (req, res) => {
  try {
    const { nouveauPoste, nouvelleFiliale, nouveauSalaire, motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif obligatoire' });
    const employe = await prisma.employe.findUnique({ where: { id: req.params.id } });
    if (!employe) return res.status(404).json({ error: 'Employé introuvable' });
    const updateData = {};
    if (nouveauPoste) updateData.poste = nouveauPoste;
    if (nouvelleFiliale) updateData.filiale = nouvelleFiliale;
    if (nouveauSalaire) updateData.salaireBase = Number(nouveauSalaire);

    await prisma.$transaction(async (tx) => {
      await tx.employe.update({ where: { id: req.params.id }, data: updateData });
      if (nouvelleFiliale && employe.utilisateurId) await tx.utilisateur.update({ where: { id: employe.utilisateurId }, data: { filiale: nouvelleFiliale } });
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: employe.filiale, action: 'UPDATE', entite: 'Employe', entiteId: employe.id, entiteLabel: `Changement poste: ${motif}`, avant: { poste: employe.poste, filiale: employe.filiale, salaireBase: employe.salaireBase }, apres: { ...updateData, motif } } });
    });
    res.json({ message: 'Changement de poste enregistré' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
