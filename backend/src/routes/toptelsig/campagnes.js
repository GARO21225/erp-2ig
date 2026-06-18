/**
 * Campagnes — envoi groupé multi-canal (promotions, annonces).
 *
 * Architecture pensée pour rester scalable sans réécriture : chaque canal
 * a sa propre fonction d'envoi dans CANAUX_ENVOI. Aujourd'hui, aucun canal
 * n'a de compte API configuré (WhatsApp Business API, email SMTP/SendGrid,
 * Telegram Bot...) — ils fonctionnent donc tous en mode "manuel" : le
 * backend prépare le message personnalisé par destinataire, le frontend
 * affiche un lien/bouton à cliquer ou un texte à copier, et l'utilisateur
 * envoie lui-même. Quand un canal a un vrai compte API, on remplace
 * uniquement sa fonction d'envoi ici — pas besoin de toucher au reste.
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

const FILIALES_VALIDES = ['GROUPE', 'YAKRO_GRILL', 'TOPTELSIG', 'LIYA'];
const TYPES_VALIDES = ['PROMOTION', 'ANNONCE', 'RELANCE_GROUPEE', 'AUTRE'];

// ── Registre des canaux et leur mode d'envoi actuel ─────────────────────────
// 'manuel' = pas de compte API, le destinataire reçoit un brouillon à envoyer
//   lui-même (lien WhatsApp pré-rempli, texte SMS/email à copier-coller).
// 'api' = un compte est configuré, le backend envoie réellement.
// Pour activer un canal en 'api' : configurer les identifiants en variable
// d'environnement, puis implémenter sa fonction d'envoi réelle ci-dessous.
const CANAUX_ENVOI = {
  whatsapp: { label: 'WhatsApp', mode: 'manuel' },
  sms:      { label: 'SMS', mode: 'manuel' },
  email:    { label: 'Email', mode: process.env.SMTP_HOST ? 'api' : 'manuel' },
  telegram: { label: 'Telegram', mode: process.env.TELEGRAM_BOT_TOKEN ? 'api' : 'manuel' },
  autre:    { label: 'Autre', mode: 'manuel' },
};

router.get('/canaux', auth, (req, res) => {
  res.json(CANAUX_ENVOI);
});

// ── GET / — Liste des campagnes ─────────────────────────────────────────────
router.get('/', auth, toptelsig, async (req, res) => {
  try {
    const { filiale, statut } = req.query;
    const where = {};
    if (filiale) where.filiale = filiale;
    if (statut) where.statut = statut;
    const campagnes = await prisma.campagne.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { envois: true } } },
    });
    // Compter les envois déjà faits par campagne (utile pour la barre de progression)
    const enrichies = await Promise.all(campagnes.map(async c => {
      const envoyes = await prisma.envoiCampagne.count({ where: { campagneId: c.id, statut: 'ENVOYE' } });
      return { ...c, totalDestinataires: c._count.envois, totalEnvoyes: envoyes };
    }));
    res.json(enrichies);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /:id — Détail d'une campagne avec tous ses envois ──────────────────
router.get('/:id', auth, toptelsig, async (req, res) => {
  try {
    const campagne = await prisma.campagne.findUnique({
      where: { id: req.params.id },
      include: { envois: { orderBy: { createdAt: 'asc' } } },
    });
    if (!campagne) return res.status(404).json({ error: 'Campagne introuvable' });
    res.json(campagne);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST / — Créer une campagne avec ses destinataires ──────────────────────
// destinataires : [{ souscripteurId?, nom, telephone?, email? }]
router.post('/', auth, toptelsig, async (req, res) => {
  try {
    const { nom, filiale, type, canal, message, destinataires } = req.body;

    if (!nom || !canal || !message) {
      return res.status(400).json({ error: 'Nom, canal et message requis' });
    }
    if (!FILIALES_VALIDES.includes(filiale)) {
      return res.status(400).json({ error: `Filiale invalide (${FILIALES_VALIDES.join(', ')})` });
    }
    if (!Array.isArray(destinataires) || destinataires.length === 0) {
      return res.status(400).json({ error: 'Au moins un destinataire requis' });
    }
    if (!CANAUX_ENVOI[canal]) {
      return res.status(400).json({ error: `Canal inconnu (${Object.keys(CANAUX_ENVOI).join(', ')})` });
    }

    // Personnalisation simple : remplace {prenom} dans le message par
    // le prénom réel de chaque destinataire (déduit du premier mot de `nom`).
    const personnaliser = (msg, destNom) => {
      const prenom = (destNom || '').split(' ')[0] || '';
      return msg.replace(/\{prenom\}/gi, prenom);
    };

    const campagne = await prisma.campagne.create({
      data: {
        nom,
        filiale,
        type: TYPES_VALIDES.includes(type) ? type : 'PROMOTION',
        canal,
        message,
        statut: 'EN_COURS',
        creePar: req.user.id,
        creeParNom: `${req.user.prenom} ${req.user.nom}`,
        envois: {
          create: destinataires.map(d => ({
            souscripteurId: d.souscripteurId || null,
            nom: d.nom,
            telephone: d.telephone || null,
            email: d.email || null,
            messagePersonnalise: personnaliser(message, d.nom),
            statut: 'EN_ATTENTE',
          })),
        },
      },
      include: { envois: true },
    });

    res.status(201).json(campagne);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /:id/envois/:envoiId — Marquer un envoi individuel comme fait ──────
// Utilisé après que l'utilisateur a cliqué le lien WhatsApp / copié le texte
// / envoyé manuellement le SMS pour CE destinataire précis.
router.put('/:id/envois/:envoiId', auth, toptelsig, async (req, res) => {
  try {
    const { statut, erreur } = req.body;
    if (!['ENVOYE', 'ECHEC', 'EN_ATTENTE'].includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    const envoi = await prisma.envoiCampagne.update({
      where: { id: req.params.envoiId },
      data: {
        statut,
        methodeEnvoi: statut === 'ENVOYE' ? 'manuel' : null,
        dateEnvoi: statut === 'ENVOYE' ? new Date() : null,
        erreur: statut === 'ECHEC' ? (erreur || null) : null,
      },
    });

    // Si tous les envois de la campagne sont traités (envoyé ou échec), la
    // marquer comme terminée automatiquement.
    const restants = await prisma.envoiCampagne.count({
      where: { campagneId: req.params.id, statut: 'EN_ATTENTE' },
    });
    if (restants === 0) {
      await prisma.campagne.update({ where: { id: req.params.id }, data: { statut: 'TERMINEE' } });
    }

    res.json(envoi);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /:id/annuler — Annuler une campagne en cours ────────────────────────
router.put('/:id/annuler', auth, toptelsig, async (req, res) => {
  try {
    const campagne = await prisma.campagne.update({
      where: { id: req.params.id },
      data: { statut: 'ANNULEE' },
    });
    res.json(campagne);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
