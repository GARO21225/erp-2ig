// ── LIVRAISONS LIYA ──────────────────────────────
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const liya = requireFiliale('LIYA');

router.get('/', auth, liya, async (req, res) => {
  try {
    const { statut, date, motoId, chauffeurId, dateDebut, dateFin, page = 1, limit = 30 } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (motoId) where.motoId = motoId;
    if (chauffeurId) where.chauffeurId = chauffeurId;
    if (date) {
      const d = new Date(date);
      where.createdAt = {
        gte: new Date(d.setHours(0, 0, 0, 0)),
        lte: new Date(d.setHours(23, 59, 59, 999))
      };
    } else if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin) where.createdAt.lte = new Date(dateFin);
    }

    const [total, livraisons] = await Promise.all([
      prisma.livraison.count({ where }),
      prisma.livraison.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          moto: { select: { immatriculation: true, marque: true } },
          chauffeur: { select: { nom: true, prenom: true, telephone: true } },
          lignesStock3PL: { include: { partenaire: { select: { nom: true } } } },
          expediteurPartenaire: { select: { nom: true, typeActivite: true } },
          expediteurClient: { select: { nom: true, typeClient: true } },
          destinatairePartenaire: { select: { nom: true, typeActivite: true } },
          destinataireClient: { select: { nom: true, typeClient: true } },
        }
      })
    ]);

    res.json({ data: livraisons, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stats du jour
router.get('/stats', auth, liya, async (req, res) => {
  try {
    const today = new Date();
    const debut = new Date(today.setHours(0, 0, 0, 0));

    const [total, livrees, enCours, echecs, caJour] = await Promise.all([
      prisma.livraison.count({ where: { createdAt: { gte: debut } } }),
      prisma.livraison.count({ where: { statut: 'LIVRE', createdAt: { gte: debut } } }),
      prisma.livraison.count({ where: { statut: { in: ['EN_ATTENTE', 'PRISE_EN_CHARGE', 'EN_ROUTE'] } } }),
      prisma.livraison.count({ where: { statut: 'ECHEC', createdAt: { gte: debut } } }),
      prisma.livraison.aggregate({
        _sum: { montant: true },
        where: { paye: true, createdAt: { gte: debut } }
      }),
    ]);

    const tauxReussite = total > 0 ? Math.round((livrees / total) * 100) : 0;

    res.json({ total, livrees, enCours, echecs, caJour: caJour._sum.montant || 0, tauxReussite });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, liya, async (req, res) => {
  try {
    const { motoId, chauffeurId } = req.body;

    // Fix 5 — Vérifier que la moto est disponible
    if (motoId) {
      const moto = await prisma.moto.findUnique({ where: { id: motoId } });
      if (!moto) return res.status(404).json({ error: 'Moto introuvable' });
      if (moto.statut !== 'DISPONIBLE') {
        return res.status(400).json({
          error: `Moto ${moto.immatriculation} non disponible (statut : ${moto.statut})`
        });
      }
    }

    // Le blocage "un livreur ne peut avoir qu'une livraison à la fois" a été
    // retiré (demande explicite : un livreur déjà en route peut recevoir une
    // nouvelle course à faire ensuite). À la place, la nouvelle course est
    // placée en fin de file de ce livreur via ordreFile — voir plus bas.
    let ordreFile = null;
    if (chauffeurId) {
      const derniereEnFile = await prisma.livraison.findFirst({
        where: { chauffeurId, statut: { in: ['EN_ATTENTE', 'PRISE_EN_CHARGE', 'EN_ROUTE'] } },
        orderBy: { ordreFile: 'desc' },
      });
      ordreFile = (derniereEnFile?.ordreFile || 0) + 1;
    }

    const numero = `LY-${Date.now()}`;
    const codeCertification = Math.floor(1000 + Math.random() * 9000).toString(); // 4 chiffres

    // Extraire uniquement les champs du modèle Livraison
    const { adressePrise, adresseLivraison, montant, typePaiement, notes, lignesStock3PL,
      latPrise, lonPrise, latDest, lonDest,
      expediteurPartenaireId, expediteurClientId, expediteurNom, expediteurTel,
      destinatairePartenaireId, destinataireClientId, destinataireNom, destinataireTel } = req.body;

    // Résolution du nom/téléphone affiché : si une relation (Partenaire ou
    // ClientLiYA) est fournie, on va chercher son nom réel plutôt que de
    // faire confiance à un texte éventuellement envoyé en double par erreur —
    // l'expéditeur/destinataire texte libre n'est utilisé QUE si aucune des
    // deux relations n'est fournie (cas du particulier ponctuel).
    let expNom = expediteurNom, expTel = expediteurTel;
    if (expediteurPartenaireId) {
      const p = await prisma.partenaire.findUnique({ where: { id: expediteurPartenaireId } });
      if (!p) return res.status(400).json({ error: 'Partenaire expéditeur introuvable' });
      expNom = p.nom; expTel = p.telephone;
    } else if (expediteurClientId) {
      const c = await prisma.clientLiYA.findUnique({ where: { id: expediteurClientId } });
      if (!c) return res.status(400).json({ error: 'Client expéditeur introuvable' });
      expNom = c.nom; expTel = c.telephone;
    }
    let destNom = destinataireNom, destTel = destinataireTel;
    if (destinatairePartenaireId) {
      const p = await prisma.partenaire.findUnique({ where: { id: destinatairePartenaireId } });
      if (!p) return res.status(400).json({ error: 'Partenaire destinataire introuvable' });
      destNom = p.nom; destTel = p.telephone;
    } else if (destinataireClientId) {
      const c = await prisma.clientLiYA.findUnique({ where: { id: destinataireClientId } });
      if (!c) return res.status(400).json({ error: 'Client destinataire introuvable' });
      destNom = c.nom; destTel = c.telephone;
    }
    if (!expNom || !expTel) return res.status(400).json({ error: 'Expéditeur requis (partenaire, client, ou nom/téléphone)' });
    if (!destNom || !destTel) return res.status(400).json({ error: 'Destinataire requis (partenaire, client, ou nom/téléphone)' });

    // lignesStock3PL : tableau optionnel [{ partenaireId, stockClientId?, article, quantite, unite }]
    // Une livraison peut prendre des articles chez plusieurs partenaires différents.
    let lignesValidees = [];
    if (Array.isArray(lignesStock3PL) && lignesStock3PL.length > 0) {
      for (const l of lignesStock3PL) {
        if (!l.partenaireId || !l.article || !l.quantite || Number(l.quantite) <= 0) {
          return res.status(400).json({ error: 'Chaque ligne doit avoir un partenaire, un article et une quantité positive' });
        }
        lignesValidees.push({
          partenaireId: l.partenaireId,
          stockClientId: l.stockClientId || null,
          article: l.article,
          quantite: Number(l.quantite),
          unite: l.unite || 'unité',
        });
      }
    }

    const livraison = await prisma.livraison.create({
      data: {
        numero,
        motoId: motoId || null,
        chauffeurId: chauffeurId || null,
        ordreFile,
        // clientNom/clientTel dépréciés mais non-nullables dans le schéma —
        // remplis avec l'expéditeur pour rester cohérents, sans nouvelle
        // signification métier (ne plus les lire ailleurs dans le code neuf).
        clientNom: expNom,
        clientTel: expTel,
        expediteurPartenaireId: expediteurPartenaireId || null,
        expediteurClientId: expediteurClientId || null,
        expediteurNom: expNom,
        expediteurTel: expTel,
        destinatairePartenaireId: destinatairePartenaireId || null,
        destinataireClientId: destinataireClientId || null,
        destinataireNom: destNom,
        destinataireTel: destTel,
        codeCertification,
        adressePrise: adressePrise || '',
        adresseLivraison: adresseLivraison || '',
        latPrise: latPrise !== undefined && latPrise !== '' ? Number(latPrise) : null,
        lonPrise: lonPrise !== undefined && lonPrise !== '' ? Number(lonPrise) : null,
        latDest: latDest !== undefined && latDest !== '' ? Number(latDest) : null,
        lonDest: lonDest !== undefined && lonDest !== '' ? Number(lonDest) : null,
        montant: Number(montant || 0),
        typePaiement: typePaiement || null,
        notes: notes || null,
        lignesStock3PL: lignesValidees.length > 0 ? { create: lignesValidees } : undefined,
      },
      include: { moto: true, chauffeur: true, lignesStock3PL: { include: { partenaire: { select: { nom: true } } } } }
    });

    // Mettre moto en livraison
    if (motoId) {
      await prisma.moto.update({ where: { id: motoId }, data: { statut: 'EN_LIVRAISON' } });
    }

    res.status(201).json(livraison);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/statut', auth, liya, async (req, res) => {
  try {
    const { statut, codeSaisi, photoUrl } = req.body;
    const data = { statut };
    if (statut === 'PRISE_EN_CHARGE') {
      data.dateDebut = new Date();
      // Photo de prise en charge — preuve que le colis a bien été récupéré
      // chez l'expéditeur, comme demandé ("comme Glovo lorsque le colis est pris").
      if (photoUrl) data.photoPriseEnCharge = photoUrl;
    }

    // La saisie correcte du code de certification EST l'action qui termine
    // la course — pas une confirmation séparée du changement de statut.
    // Le destinataire communique le code reçu par SMS, le livreur le saisit ;
    // un code manquant ou faux bloque le passage à LIVRE.
    if (statut === 'LIVRE') {
      const courante = await prisma.livraison.findUnique({ where: { id: req.params.id } });
      if (!courante) return res.status(404).json({ error: 'Livraison introuvable' });
      if (!codeSaisi) {
        return res.status(400).json({ error: 'Code de certification requis — demandez-le au destinataire pour confirmer la livraison.' });
      }
      if (codeSaisi !== courante.codeCertification) {
        return res.status(400).json({ error: 'Code de certification incorrect. Vérifiez auprès du destinataire.' });
      }
      data.dateFin = new Date();
      data.codeVerifieLe = new Date();
      if (photoUrl) data.photoLivraison = photoUrl;
      data.ordreFile = null; // sort de la file du livreur, course terminée
    }

    const avertissementsStock = [];

    // Déduction du stock partenaire — uniquement au passage à LIVRE, jamais avant
    // (tant que ce n'est pas livré, la livraison peut encore échouer ou être annulée).
    if (statut === 'LIVRE') {
      const livraisonAvant = await prisma.livraison.findUnique({
        where: { id: req.params.id },
        include: { lignesStock3PL: true },
      });

      if (livraisonAvant && livraisonAvant.statut !== 'LIVRE' && livraisonAvant.lignesStock3PL?.length > 0) {
        for (const ligne of livraisonAvant.lignesStock3PL) {
          if (!ligne.stockClientId) continue; // ligne sans stock précis lié, rien à déduire
          const stock = await prisma.stockClient3PL.findUnique({ where: { id: ligne.stockClientId } });
          if (!stock) continue;

          const nouvelleQuantite = stock.quantite - ligne.quantite;
          if (nouvelleQuantite < 0) {
            avertissementsStock.push(
              `⚠ Stock "${ligne.article}" chez le partenaire devient négatif (${nouvelleQuantite} ${ligne.unite}) — quantité demandée supérieure au stock disponible.`
            );
          }
          await prisma.stockClient3PL.update({
            where: { id: ligne.stockClientId },
            data: {
              quantite: nouvelleQuantite,
              statut: nouvelleQuantite <= 0 ? 'SORTI_TOTAL' : 'SORTI_PARTIEL',
              dateSortie: new Date(),
            },
          });
        }
      }
    }

    const livraison = await prisma.livraison.update({
      where: { id: req.params.id },
      data,
      include: { moto: true, lignesStock3PL: { include: { partenaire: { select: { nom: true } } } } }
    });

    // Libérer la moto si terminé
    if (['LIVRE', 'ECHEC', 'ANNULE'].includes(statut) && livraison.motoId) {
      await prisma.moto.update({ where: { id: livraison.motoId }, data: { statut: 'DISPONIBLE' } });
    }

    // Informer (sans l'activer automatiquement — ça reste une action humaine)
    // qu'une prochaine course attend ce livreur dans sa file.
    let prochaineCourse = null;
    if (['LIVRE', 'ECHEC', 'ANNULE'].includes(statut) && livraison.chauffeurId) {
      prochaineCourse = await prisma.livraison.findFirst({
        where: { chauffeurId: livraison.chauffeurId, statut: 'EN_ATTENTE', ordreFile: { not: null } },
        orderBy: { ordreFile: 'asc' },
        select: { id: true, numero: true, adressePrise: true, destinataireNom: true },
      });
    }

    res.json({ ...livraison, avertissementsStock, prochaineCourse });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Position GPS
router.post('/:id/position', auth, async (req, res) => {
  try {
    const { latitude, longitude, vitesse } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude et longitude requises' });
    }
    const pos = await prisma.positionGPS.create({
      data: { livraisonId: req.params.id, latitude: Number(latitude), longitude: Number(longitude), vitesse: vitesse !== undefined ? Number(vitesse) : null }
    });
    res.status(201).json(pos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/positions', auth, async (req, res) => {
  try {
    const positions = await prisma.positionGPS.findMany({
      where: { livraisonId: req.params.id },
      orderBy: { timestamp: 'asc' }
    });
    res.json(positions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// PUT /:id/echec — Déclarer un échec avec motif obligatoire
// POST /:id/verifier-code — Vérifie le code SANS changer le statut.
// Utilisé par le frontend pour confirmer le code avant de demander la
// photo de livraison ; le passage réel à LIVRE se fait ensuite via
// PUT /:id/statut (qui revérifie le code par sécurité, ne fait jamais
// confiance à une vérification déjà faite côté client).
router.post('/:id/verifier-code', auth, liya, async (req, res) => {
  try {
    const { code } = req.body;
    const livraison = await prisma.livraison.findUnique({ where: { id: req.params.id } });
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable' });
    if (!code || code !== livraison.codeCertification) {
      return res.status(400).json({ error: 'Code de certification incorrect. Vérifiez auprès du destinataire.' });
    }
    res.json({ valide: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/echec', auth, liya, async (req, res) => {
  try {
    const { motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif d\'échec obligatoire (client absent, adresse incorrecte, refus, etc.)' });

    const livraison = await prisma.livraison.findUnique({ where: { id: req.params.id } });
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable' });
    if (!['PRISE_EN_CHARGE', 'EN_ROUTE'].includes(livraison.statut)) return res.status(400).json({ error: `Échec impossible — statut actuel: ${livraison.statut}` });

    await prisma.$transaction(async (tx) => {
      await tx.livraison.update({ where: { id: req.params.id }, data: { statut: 'ECHEC', dateFin: new Date(), notes: `${livraison.notes || ''} | ECHEC: ${motif}` } });
      if (livraison.motoId) await tx.moto.update({ where: { id: livraison.motoId }, data: { statut: 'DISPONIBLE' } });
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'LIYA', action: 'UPDATE', entite: 'Livraison', entiteId: livraison.id, entiteLabel: `Échec ${livraison.numero}: ${motif}`, avant: { statut: livraison.statut }, apres: { statut: 'ECHEC', motif } } });
    });
    res.json({ message: 'Livraison marquée comme échec', motif });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id/reassigner — Réassigner moto/livreur après échec ou incident
router.put('/:id/reassigner', auth, liya, async (req, res) => {
  try {
    const { motoId, chauffeurId, motif } = req.body;
    if (!motif) return res.status(400).json({ error: 'Motif de réassignation obligatoire' });

    const livraison = await prisma.livraison.findUnique({ where: { id: req.params.id } });
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable' });
    if (livraison.statut === 'LIVRE') return res.status(400).json({ error: 'Livraison déjà livrée' });

    if (motoId) {
      const moto = await prisma.moto.findUnique({ where: { id: motoId } });
      if (!moto || moto.statut !== 'DISPONIBLE') return res.status(400).json({ error: `Moto non disponible (statut: ${moto?.statut})` });
    }

    await prisma.$transaction(async (tx) => {
      // Libérer l'ancienne moto
      if (livraison.motoId && livraison.motoId !== motoId) await tx.moto.update({ where: { id: livraison.motoId }, data: { statut: 'DISPONIBLE' } });
      // Assigner nouvelle moto
      if (motoId) await tx.moto.update({ where: { id: motoId }, data: { statut: 'EN_LIVRAISON' } });
      await tx.livraison.update({ where: { id: req.params.id }, data: { motoId: motoId || livraison.motoId, chauffeurId: chauffeurId || livraison.chauffeurId, statut: 'ASSIGNEE', notes: `${livraison.notes || ''} | RÉASSIGNATION: ${motif}` } });
    });
    res.json({ message: 'Livraison réassignée' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/incident — Déclarer incident (accident, panne) avec maintenance auto
router.post('/:id/incident', auth, liya, async (req, res) => {
  try {
    const { type, description, motoId: motoIdParam } = req.body;
    if (!type || !description) return res.status(400).json({ error: 'Type et description d\'incident obligatoires' });

    const livraison = await prisma.livraison.findUnique({ where: { id: req.params.id } });
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable' });

    const motoId = motoIdParam || livraison.motoId;

    await prisma.$transaction(async (tx) => {
      // Livraison → ECHEC
      await tx.livraison.update({ where: { id: req.params.id }, data: { statut: 'ECHEC', dateFin: new Date(), notes: `${livraison.notes || ''} | INCIDENT ${type}: ${description}` } });
      // Moto → HORS_SERVICE ou MAINTENANCE
      if (motoId) {
        const statutMoto = type === 'ACCIDENT' ? 'HORS_SERVICE' : 'MAINTENANCE';
        await tx.moto.update({ where: { id: motoId }, data: { statut: statutMoto } });
        await tx.maintenanceMoto.create({ data: { motoId, type: type === 'ACCIDENT' ? 'AUTRE' : 'AUTRE', description: `INCIDENT: ${description}`, cout: 0, statut: 'EN_COURS' } });
      }
    });
    res.json({ message: 'Incident déclaré, moto mise hors service, livraison marquée en échec' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /file/:chauffeurId — File de courses d'un livreur (en cours + en attente, ordonnées)
router.get('/file/:chauffeurId', auth, liya, async (req, res) => {
  try {
    const courses = await prisma.livraison.findMany({
      where: { chauffeurId: req.params.chauffeurId, statut: { in: ['EN_ATTENTE', 'PRISE_EN_CHARGE', 'EN_ROUTE'] } },
      orderBy: { ordreFile: 'asc' },
      include: { moto: { select: { immatriculation: true } } },
    });
    res.json(courses);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /export — Export Excel livraisons
router.get('/export', auth, liya, async (req, res) => {
  try {
    const { dateDebut, dateFin, statut } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (dateDebut || dateFin) { where.createdAt = {}; if (dateDebut) where.createdAt.gte = new Date(dateDebut); if (dateFin) where.createdAt.lte = new Date(dateFin); }
    const livraisons = await prisma.livraison.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10000,
      include: { chauffeur: { select: { nom: true, prenom: true } } } });
    const xlsx = require('xlsx');
    const data = livraisons.map(l => ({
      Numéro: l.numero, Client: l.clientNom, Téléphone: l.clientTel,
      'Adresse prise': l.adressePrise, 'Adresse livraison': l.adresseLivraison,
      Statut: l.statut, Montant: l.montant, Payé: l.paye ? 'Oui' : 'Non',
      Livreur: l.chauffeur ? `${l.chauffeur.prenom} ${l.chauffeur.nom}` : '—',
      Date: new Date(l.createdAt).toLocaleString('fr'),
    }));
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Livraisons');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="livraisons_${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /assigner-masse — Assigne plusieurs livraisons sélectionnées à un
// même livreur/moto en une fois, en réutilisant la même logique de file
// que la création (chacune est ajoutée à la suite de la file du livreur).
router.put('/assigner-masse', auth, liya, async (req, res) => {
  try {
    const { livraisonIds, chauffeurId, motoId } = req.body;
    if (!Array.isArray(livraisonIds) || livraisonIds.length === 0) {
      return res.status(400).json({ error: 'Au moins une livraison à sélectionner' });
    }
    if (!chauffeurId) return res.status(400).json({ error: 'Livreur requis' });

    const aTraiter = await prisma.livraison.findMany({
      where: { id: { in: livraisonIds }, statut: { notIn: ['LIVRE', 'ANNULE'] } },
    });
    if (aTraiter.length === 0) {
      return res.status(400).json({ error: 'Aucune des livraisons sélectionnées ne peut être assignée (déjà livrées ou annulées)' });
    }

    const derniereEnFile = await prisma.livraison.findFirst({
      where: { chauffeurId, statut: { in: ['EN_ATTENTE', 'PRISE_EN_CHARGE', 'EN_ROUTE'] } },
      orderBy: { ordreFile: 'desc' },
    });
    let ordre = (derniereEnFile?.ordreFile || 0);

    const resultats = [];
    for (const l of aTraiter) {
      ordre += 1;
      const maj = await prisma.livraison.update({
        where: { id: l.id },
        data: { chauffeurId, motoId: motoId || l.motoId, ordreFile: ordre },
      });
      resultats.push(maj);
    }
    res.json({ message: `${resultats.length} livraison(s) assignée(s)`, livraisons: resultats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /modifier-masse — Applique un changement commun à plusieurs
// livraisons sélectionnées (ex: changer le type de paiement, ajouter une
// note groupée). Volontairement limité à des champs sans risque (pas de
// modification en masse du statut, qui a sa propre logique métier stricte
// par livraison — code de certification, photos, déduction stock).
router.put('/modifier-masse', auth, liya, async (req, res) => {
  try {
    const { livraisonIds, typePaiement, notes } = req.body;
    if (!Array.isArray(livraisonIds) || livraisonIds.length === 0) {
      return res.status(400).json({ error: 'Au moins une livraison à sélectionner' });
    }
    const data = {};
    if (typePaiement !== undefined) data.typePaiement = typePaiement;
    if (notes !== undefined) data.notes = notes;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Aucune modification fournie' });
    }
    const result = await prisma.livraison.updateMany({
      where: { id: { in: livraisonIds }, statut: { notIn: ['LIVRE', 'ANNULE'] } },
      data,
    });
    res.json({ message: `${result.count} livraison(s) modifiée(s)` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id — Modifier les informations d'une livraison (hors statut, qui a
// sa propre route avec la logique métier code/photo/stock). Permet de
// corriger une adresse, un montant, réassigner moto/livreur, etc.
router.put('/:id', auth, liya, async (req, res) => {
  try {
    const courante = await prisma.livraison.findUnique({ where: { id: req.params.id } });
    if (!courante) return res.status(404).json({ error: 'Livraison introuvable' });
    if (['LIVRE', 'ANNULE'].includes(courante.statut)) {
      return res.status(400).json({ error: `Modification impossible — livraison déjà ${courante.statut === 'LIVRE' ? 'livrée' : 'annulée'}` });
    }

    const { adressePrise, adresseLivraison, latPrise, lonPrise, latDest, lonDest,
      montant, typePaiement, notes, motoId, chauffeurId,
      expediteurNom, expediteurTel, destinataireNom, destinataireTel } = req.body;

    const data = {};
    if (adressePrise !== undefined) data.adressePrise = adressePrise;
    if (adresseLivraison !== undefined) data.adresseLivraison = adresseLivraison;
    if (latPrise !== undefined) data.latPrise = latPrise !== '' ? Number(latPrise) : null;
    if (lonPrise !== undefined) data.lonPrise = lonPrise !== '' ? Number(lonPrise) : null;
    if (latDest !== undefined) data.latDest = latDest !== '' ? Number(latDest) : null;
    if (lonDest !== undefined) data.lonDest = lonDest !== '' ? Number(lonDest) : null;
    if (montant !== undefined) data.montant = Number(montant || 0);
    if (typePaiement !== undefined) data.typePaiement = typePaiement || null;
    if (notes !== undefined) data.notes = notes || null;
    if (expediteurNom !== undefined) { data.expediteurNom = expediteurNom; data.clientNom = expediteurNom; }
    if (expediteurTel !== undefined) { data.expediteurTel = expediteurTel; data.clientTel = expediteurTel; }
    if (destinataireNom !== undefined) data.destinataireNom = destinataireNom;
    if (destinataireTel !== undefined) data.destinataireTel = destinataireTel;

    // Changement de moto/livreur via cette route = simple réaffectation
    // administrative (pas de vérification de disponibilité comme à la
    // création — un dispatcheur corrige ici une erreur de saisie).
    if (motoId !== undefined) data.motoId = motoId || null;
    if (chauffeurId !== undefined) data.chauffeurId = chauffeurId || null;

    const livraison = await prisma.livraison.update({ where: { id: req.params.id }, data });
    res.json(livraison);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id — Annule la livraison (jamais de suppression physique : une
// course gère de l'argent et doit rester traçable). Si une moto était
// assignée, elle est libérée.
router.delete('/:id', auth, liya, async (req, res) => {
  try {
    const livraison = await prisma.livraison.findUnique({ where: { id: req.params.id } });
    if (!livraison) return res.status(404).json({ error: 'Livraison introuvable' });
    if (livraison.statut === 'LIVRE') return res.status(400).json({ error: 'Impossible d\'annuler une livraison déjà livrée' });

    await prisma.$transaction(async (tx) => {
      await tx.livraison.update({ where: { id: req.params.id }, data: { statut: 'ANNULE', ordreFile: null } });
      if (livraison.motoId) await tx.moto.update({ where: { id: livraison.motoId }, data: { statut: 'DISPONIBLE' } });
    });
    res.json({ message: 'Livraison annulée' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});



module.exports = router;
