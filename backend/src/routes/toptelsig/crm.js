/**
 * TOPTELSIG — CRM Foncier
 * Règle : Contact + Projet = Opportunité
 * Un contact peut être CLIENT sur KOKO et PROSPECT sur BISSAP
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

const TAGS_VALIDES = ['chaud','tiede','froid','investisseur','vip','apporteur','partenaire','relance_urgente'];
const STATUTS_PIPELINE = ['PROSPECT','CONTACTE','VISITE','NEGOCIE','PROPOSITION','RESERVE','CLIENT','PERDU'];

// ── GET /prospects ─────────────────────────────────────────────────────────────
// Retourne les contacts avec leur statut par projet
// projetId optionnel : filtrer sur un projet
router.get('/prospects', auth, toptelsig, async (req, res) => {
  try {
    const { statut, projetId, search, tags } = req.query;

    // Construire la requête ContactProjet si projetId fourni
    if (projetId) {
      const where = { projetId };
      if (statut) where.statut = statut;
      else where.statut = { not: 'CLIENT' }; // CRM ne montre pas les clients

      const contactProjets = await prisma.contactProjet.findMany({
        where,
        include: {
          souscripteur: {
            include: {
              relances: { orderBy: { dateRelance: 'desc' }, take: 5 },
              ventes: { where: { lot: { projetId } }, include: { lot: { select: { numero:true } } } },
              reservations: { select: { id:true, statut:true }, where: { lot: { projetId } } },
            }
          },
          projet: { select: { nom:true, code:true, ville:true } },
        },
        orderBy: { dateCreation: 'desc' },
      });

      return res.json(contactProjets.map(cp => enrichirContact(cp.souscripteur, cp)));
    }

    // Vue globale CRM : tous les contacts non-CLIENT
    // Utilise contactProjets si disponible, sinon fallback sur statut global
    // CRM : afficher tous les contacts sauf ceux explicitement filtrés
    const where = {};
    if (statut) {
      where.statut = statut;
    }
    // IMPORTANT : ne pas filtrer par défaut — un contact CLIENT sur KOKO
    // peut être PROSPECT sur BISSAP. On laisse le filtre à l'utilisateur.
    if (search) where.OR = [
      { nom: { contains: search, mode: 'insensitive' } },
      { prenom: { contains: search, mode: 'insensitive' } },
      { telephone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];

    const contacts = await prisma.souscripteur.findMany({
      where,
      include: {
        relances: { orderBy: { dateRelance: 'desc' }, take: 5 },
        ventes: {
          include: {
            lot: { select: { numero:true, projet: { select: { nom:true, code:true } } } },
          },
        },
        reservations: { select: { id:true, statut:true } },
        contactProjets: {
          include: { projet: { select: { nom:true, code:true } } },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(contacts.map(c => enrichirContact(c, null)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function enrichirContact(p, contactProjet) {
  const relances = p.relances || [];
  const derniere = relances[0];
  const planifiee = relances.find(r => r.statut === 'planifiee' && r.prochain && new Date(r.prochain) > new Date());
  const enRetard = relances.find(r => r.statut === 'planifiee' && r.prochain && new Date(r.prochain) < new Date());

  let tagsArr = [];
  try { tagsArr = JSON.parse(p.tags || '[]'); } catch {}

  return {
    ...p,
    // Statut global du contact
    statutGlobal: p.statut,
    // Statut sur le projet spécifique (si filtré par projet)
    statutProjet: contactProjet?.statut || p.statut,
    projetContext: contactProjet?.projet || null,
    tagsArr,
    _crm: {
      nbRelances: relances.length,
      derniereRelance: derniere ? { date: derniere.dateRelance, canal: derniere.canal, commercialNom: derniere.commercialNom, resultat: derniere.resultat } : null,
      prochaineRelance: planifiee?.prochain || null,
      enRetardRelance: !!enRetard,
      nbVentes: p.ventes?.length || 0,
      nbReservations: p.reservations?.filter(r => r.statut === 'ACTIVE').length || 0,
      projets: p.contactProjets?.map(cp => ({ projetNom: cp.projet?.nom, projetCode: cp.projet?.code, statut: cp.statut })) || [],
    }
  };
}

// ── POST /prospects — Créer un contact (sans projet obligatoire) ────────────
router.post('/prospects', auth, toptelsig, async (req, res) => {
  try {
    const { prenom, nom, telephone, email, adresse, profession, sourceAcquisition, commercialId, commercialNom, tags, projetId, code } = req.body;
    if (!prenom || !nom || !telephone) return res.status(400).json({ error: 'prenom, nom, telephone requis' });

    const contact = await prisma.$transaction(async tx => {
      const c = await tx.souscripteur.create({
        data: {
          code: code || `CRM-${Date.now().toString(36).toUpperCase().slice(-6)}`,
          prenom, nom, telephone, email, adresse, profession,
          sourceAcquisition, commercialId, commercialNom,
          statut: 'PROSPECT',
          tags: tags ? JSON.stringify(tags) : null,
        }
      });
      // Si un projet est précisé : créer la relation ContactProjet
      if (projetId) {
        await tx.contactProjet.create({
          data: { souscripteurId: c.id, projetId, statut: 'PROSPECT', commercialId, commercialNom }
        });
      }
      return c;
    });

    res.status(201).json(contact);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /prospects/:id/statut-projet — Changer statut sur un projet ──────────
router.put('/prospects/:id/statut-projet', auth, toptelsig, async (req, res) => {
  try {
    const { projetId, statut } = req.body;
    if (!projetId || !statut) return res.status(400).json({ error: 'projetId et statut requis' });

    const cp = await prisma.contactProjet.upsert({
      where: { souscripteurId_projetId: { souscripteurId: req.params.id, projetId } },
      update: { statut, updatedAt: new Date() },
      create: { souscripteurId: req.params.id, projetId, statut, commercialId: req.user.id, commercialNom: `${req.user.prenom} ${req.user.nom}` },
    });
    res.json(cp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /prospects/:id/tags — Mettre à jour les tags ──────────────────────────
router.put('/prospects/:id/tags', auth, toptelsig, async (req, res) => {
  try {
    const { tags } = req.body; // Array de strings
    const updated = await prisma.souscripteur.update({
      where: { id: req.params.id },
      data: { tags: JSON.stringify(tags) }
    });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /:id/relances — Ajouter une relance ──────────────────────────────────
router.post('/:id/relances', auth, toptelsig, async (req, res) => {
  try {
    const { canal, notes, resultat, prochain, dureeMin, raisonPerte, projetId } = req.body;
    if (!canal) return res.status(400).json({ error: 'canal requis' });

    const relance = await prisma.relanceCRM.create({
      data: {
        souscripteurId: req.params.id,
        commercial: req.user.id,
        commercialNom: `${req.user.prenom} ${req.user.nom}`,
        canal, notes, resultat,
        dureeMin: dureeMin ? Number(dureeMin) : null,
        prochain: prochain ? new Date(prochain) : null,
        statut: prochain ? 'planifiee' : 'effectuee',
        dateRelance: new Date(),
      }
    });

    let souscripteurConverti = null;

    if (resultat === 'converti') {
      souscripteurConverti = await prisma.souscripteur.update({
        where: { id: req.params.id },
        data: { statut: 'CLIENT', canalConversion: canal, commercialId: req.user.id, commercialNom: `${req.user.prenom} ${req.user.nom}` }
      });
      // Mettre à jour ContactProjet si projetId fourni
      if (projetId) {
        await prisma.contactProjet.upsert({
          where: { souscripteurId_projetId: { souscripteurId: req.params.id, projetId } },
          update: { statut: 'CLIENT' },
          create: { souscripteurId: req.params.id, projetId, statut: 'CLIENT', commercialId: req.user.id, commercialNom: `${req.user.prenom} ${req.user.nom}` },
        }).catch(() => {});
      }
    }

    if (resultat === 'perdu') {
      await prisma.souscripteur.update({
        where: { id: req.params.id },
        data: { statut: 'PERDU', raisonPerte: raisonPerte || null }
      });
      if (projetId) {
        await prisma.contactProjet.upsert({
          where: { souscripteurId_projetId: { souscripteurId: req.params.id, projetId } },
          update: { statut: 'PERDU' },
          create: { souscripteurId: req.params.id, projetId, statut: 'PERDU', commercialId: req.user.id, commercialNom: `${req.user.prenom} ${req.user.nom}` },
        }).catch(() => {});
      }
    }

    await prisma.auditLog.create({ data: {
      utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`,
      filiale: 'TOPTELSIG', action: 'CREATE', entite: 'RelanceCRM',
      entiteId: relance.id, entiteLabel: `${canal} — ${resultat || 'en attente'}`,
    }});

    res.status(201).json({ ...relance, souscripteurConverti: souscripteurConverti ? { id: souscripteurConverti.id } : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /:id/relances — Timeline ──────────────────────────────────────────────
router.get('/:id/relances', auth, toptelsig, async (req, res) => {
  try {
    const relances = await prisma.relanceCRM.findMany({
      where: { souscripteurId: req.params.id },
      orderBy: { dateRelance: 'desc' }
    });
    res.json(relances);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /:id — Modifier contact ────────────────────────────────────────────────
router.put('/:id', auth, toptelsig, async (req, res) => {
  try {
    const { statut, commercialId, commercialNom, sourceAcquisition, raisonPerte, tags } = req.body;
    const data = {};
    if (statut) data.statut = statut;
    if (commercialId !== undefined) data.commercialId = commercialId;
    if (commercialNom !== undefined) data.commercialNom = commercialNom;
    if (sourceAcquisition !== undefined) data.sourceAcquisition = sourceAcquisition;
    if (raisonPerte !== undefined) data.raisonPerte = raisonPerte;
    if (tags !== undefined) data.tags = JSON.stringify(tags);
    const updated = await prisma.souscripteur.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /dashboard ─────────────────────────────────────────────────────────────
router.get('/dashboard', auth, toptelsig, async (req, res) => {
  try {
    const { projetId } = req.query;
    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

    // Stats par projet si fourni
    let pipeline = [];
    if (projetId) {
      const stats = await prisma.contactProjet.groupBy({
        by: ['statut'], _count: { id: true }, where: { projetId },
      });
      pipeline = STATUTS_PIPELINE.map(s => ({
        statut: s, count: stats.find(x=>x.statut===s)?._count.id || 0
      }));
    } else {
      const [nbTotal, nbProspects, nbClients, nbPerdus] = await Promise.all([
        prisma.souscripteur.count({ where: { NOT: { statut: 'CLIENT' } } }),
        prisma.souscripteur.count({ where: { statut: 'PROSPECT' } }),
        prisma.souscripteur.count({ where: { statut: 'CLIENT' } }),
        prisma.souscripteur.count({ where: { statut: 'PERDU' } }),
      ]);
      pipeline = [
        { statut:'PROSPECT', count:nbProspects },
        { statut:'CLIENT', count:nbClients },
        { statut:'PERDU', count:nbPerdus },
      ];
    }

    const [nbRelancesMois, relancesParCanal, alertesRelance, conversions] = await Promise.all([
      prisma.relanceCRM.count({ where: { dateRelance: { gte: debutMois } } }),
      prisma.relanceCRM.groupBy({ by:['canal'], _count:{id:true}, where:{dateRelance:{gte:debutMois}} }),
      prisma.relanceCRM.findMany({ where: { statut:'planifiee', prochain:{ lte:now } }, include: { souscripteur: { select:{ prenom:true, nom:true, telephone:true } } }, take:10, orderBy:{prochain:'asc'} }),
      prisma.souscripteur.findMany({ where: { statut:'CLIENT', updatedAt:{gte:debutMois} }, select:{ prenom:true, nom:true, commercialNom:true, canalConversion:true, updatedAt:true }, take:5, orderBy:{updatedAt:'desc'} }),
    ]);

    const nbTotal = pipeline.reduce((s,p)=>s+p.count,0);
    const nbClients = pipeline.find(p=>p.statut==='CLIENT')?.count||0;

    res.json({
      kpi: { nbTotal, nbClients, nbRelancesMois, tauxConversion: nbTotal>0?Math.round(nbClients/nbTotal*100):0 },
      pipeline,
      relancesParCanal: relancesParCanal.map(r=>({ canal:r.canal, count:r._count.id })),
      alertesRelance,
      conversions,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /proposer-lot — Réserver un lot pour un prospect ─────────────────────
router.post('/proposer-lot', auth, toptelsig, async (req, res) => {
  try {
    const { souscripteurId, lotId, notes } = req.body;
    if (!souscripteurId || !lotId) return res.status(400).json({ error: 'souscripteurId et lotId requis' });

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: { projet: true, reservations: { where: { statut: 'ACTIVE' } } }
    });
    if (!lot) return res.status(404).json({ error: 'Lot introuvable' });
    if (lot.statut === 'VENDU') return res.status(400).json({ error: 'Lot déjà vendu' });
    if (lot.reservations.length > 0) return res.status(400).json({ error: 'Lot déjà réservé' });

    const reservation = await prisma.$transaction(async tx => {
      const r = await tx.reservationFoncier.create({
        data: { lotId, souscripteurId, notes: notes||null, statut: 'ACTIVE' }
      });
      await tx.lot.update({ where: { id: lotId }, data: { statut: 'RESERVE' } });
      // Mettre à jour ContactProjet → RESERVE
      await tx.contactProjet.upsert({
        where: { souscripteurId_projetId: { souscripteurId, projetId: lot.projetId } },
        update: { statut: 'RESERVE' },
        create: { souscripteurId, projetId: lot.projetId, statut: 'RESERVE', commercialId: req.user.id, commercialNom: `${req.user.prenom} ${req.user.nom}` },
      });
      await tx.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: 'TOPTELSIG', action: 'CREATE', entite: 'ReservationFoncier', entiteId: r.id, entiteLabel: `Lot ${lot.numero} — ${lot.projet?.nom}` } });
      return r;
    });

    res.status(201).json({ reservation, lot: { id:lot.id, numero:lot.numero, projet:lot.projet?.nom } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /propositions — Envoyer une proposition multi-projets ────────────────
router.post('/propositions', auth, toptelsig, async (req, res) => {
  try {
    const { souscripteurId, projetsEnvoyes, message } = req.body;
    if (!souscripteurId || !projetsEnvoyes) return res.status(400).json({ error: 'souscripteurId et projetsEnvoyes requis' });

    const prop = await prisma.propositionFoncier.create({
      data: {
        souscripteurId,
        commercialId: req.user.id,
        commercialNom: `${req.user.prenom} ${req.user.nom}`,
        projetsEnvoyes: JSON.stringify(projetsEnvoyes),
        message,
        statut: 'ENVOYEE',
        dateEnvoi: new Date(),
      }
    });
    res.status(201).json(prop);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /template-import ───────────────────────────────────────────────────────
router.get('/template-import', auth, (req, res) => {
  const headers = ['prenom','nom','telephone','email','profession','source','commercial_nom'];
  const examples = [
    ['Jean','KOUAME','0708937608','jean@example.ci','Commerçant','Facebook','Marie DUPONT'],
    ['Awa','TRAORE','0507123456','awa@example.ci','Fonctionnaire','WhatsApp','Paul DIALLO'],
  ];
  res.setHeader('Content-Disposition', 'attachment; filename="template_prospects_crm.csv"');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + [headers, ...examples].map(r => r.join(';')).join('\r\n'));
});

module.exports = router;
