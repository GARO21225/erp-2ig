/**
 * Yakro Grill — Pointage du personnel par QR code.
 * Le restaurant affiche un QR code qui change toutes les minutes (écran du gérant / tablette) :
 * l'agent le scanne avec son téléphone à l'arrivée, puis une 2e fois au départ.
 * Un scan = bascule : pas de session ouverte → ENTRÉE ; session ouverte → SORTIE.
 * Aucune heure de service imposée : une journée peut aller de 8h à 23h, ou passer minuit.
 */
const router = require('express').Router();
const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const Y = require('../../lib/yakro-resto');
const yakro = requireFiliale('YAKRO_GRILL');

const PERIODE_MS = 60 * 1000;          // le QR change toutes les minutes
const TOLERANCE = 3;                   // jetons des 3 dernières minutes acceptés (le temps de se connecter)
const OUBLI_H = 20;                    // session ouverte depuis plus de 20 h = sortie oubliée
const ANTI_REBOND_S = 60;              // pas de bascule dans la minute qui suit un pointage

const secret = () => process.env.JWT_SECRET || 'dev-secret';
const jeton = (restaurantId, fenetre) => crypto.createHmac('sha256', secret()).update(`pointage:${restaurantId}:${fenetre}`).digest('hex').slice(0, 24);
const fenetreCourante = () => Math.floor(Date.now() / PERIODE_MS);
const jetonValide = (restaurantId, t) => {
  const f = fenetreCourante();
  for (let i = 0; i < TOLERANCE; i++) {
    const a = Buffer.from(jeton(restaurantId, f - i)); const b = Buffer.from(String(t || ''));
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
};
const estOubli = (p) => !p.sortieLe && (Date.now() - new Date(p.entreeLe).getTime()) > OUBLI_H * 3600 * 1000;
const dureeMin = (p) => Math.max(0, Math.round(((p.sortieLe ? new Date(p.sortieLe) : new Date()) - new Date(p.entreeLe)) / 60000));
const nomDe = (u) => `${u.prenom} ${u.nom}`.trim();

/** Ajoute durée, état et activité (commandes prises pendant la session) à des sessions. */
async function enrichir(sessions, restaurantId) {
  if (!sessions.length) return [];
  const debut = new Date(Math.min(...sessions.map(s => new Date(s.entreeLe).getTime())));
  const noms = [...new Set(sessions.map(s => s.nom))];
  const commandes = await prisma.commandeYakro.findMany({
    where: { ...(restaurantId ? { restaurantId } : {}), serveurNom: { in: noms }, createdAt: { gte: debut }, statut: { not: 'ANNULEE' } },
    select: { serveurNom: true, total: true, createdAt: true },
  });
  return sessions.map(s => {
    const fin = s.sortieLe ? new Date(s.sortieLe) : new Date();
    const mes = commandes.filter(c => c.serveurNom === s.nom && c.createdAt >= new Date(s.entreeLe) && c.createdAt <= fin);
    return { ...s, dureeMin: dureeMin(s), oubli: estOubli(s), enService: !s.sortieLe && !estOubli(s),
      activite: { commandes: mes.length, ca: mes.reduce((t, c) => t + (c.total || 0), 0) } };
  });
}

// ── Borne : jeton courant à afficher en QR code (gérant) ───────────────────
router.get('/borne', auth, yakro, Y.resto, Y.can('pointage.gerer'), (req, res) => {
  if (!req.restaurantId) return res.status(400).json({ error: 'Aucun restaurant configuré' });
  const f = fenetreCourante();
  res.json({ restaurantId: req.restaurantId, restaurant: req.restaurant?.nom, jeton: jeton(req.restaurantId, f),
    expireDans: Math.ceil(((f + 1) * PERIODE_MS - Date.now()) / 1000) });
});

// ── Scan par l'agent : bascule entrée / sortie ──────────────────────────────
router.post('/scan', auth, yakro, async (req, res) => {
  try {
    const { restaurantId, jeton: t } = req.body || {};
    if (!restaurantId || !t) return res.status(400).json({ error: 'QR code incomplet — scannez à nouveau' });
    const liste = await Y.accesDe(req.user);
    const acces = liste.find(a => a.restaurant.id === restaurantId);
    if (!acces) return res.status(403).json({ error: "Vous n'êtes pas affecté à ce restaurant" });
    if (!jetonValide(restaurantId, t)) return res.status(400).json({ error: 'QR code expiré — scannez le QR affiché au restaurant' });

    const nom = nomDe(req.user);
    const ouverte = await prisma.pointageYakro.findFirst({ where: { utilisateurId: req.user.id, sortieLe: null }, orderBy: { entreeLe: 'desc' } });
    const maintenant = new Date();
    if (ouverte && !estOubli(ouverte)) {
      if (ouverte.restaurantId !== restaurantId) return res.status(400).json({ error: "Vous êtes pointé dans un autre restaurant — pointez votre sortie là-bas d'abord" });
      if ((maintenant - new Date(ouverte.entreeLe)) / 1000 < ANTI_REBOND_S) return res.status(429).json({ error: 'Entrée déjà enregistrée à l’instant', action: 'ENTREE', at: ouverte.entreeLe, nom, restaurant: acces.restaurant.nom });
      const p = await prisma.pointageYakro.update({ where: { id: ouverte.id }, data: { sortieLe: maintenant, modeSortie: 'QR' } });
      const [e] = await enrichir([p], restaurantId);
      return res.json({ action: 'SORTIE', at: maintenant, nom, restaurant: acces.restaurant.nom, entreeLe: p.entreeLe, dureeMin: e.dureeMin, activite: e.activite });
    }
    // Un seul pointage (entrée + sortie) par agent et par jour
    const debutJour = new Date(maintenant); debutJour.setUTCHours(0, 0, 0, 0);
    const dejaAuj = await prisma.pointageYakro.findFirst({ where: { utilisateurId: req.user.id, entreeLe: { gte: debutJour }, id: ouverte ? { not: ouverte.id } : undefined }, orderBy: { entreeLe: 'desc' } });
    if (dejaAuj) {
      const h = (d) => new Date(d).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      return res.status(409).json({ error: `Vous avez déjà pointé aujourd'hui (entrée ${h(dejaAuj.entreeLe)}${dejaAuj.sortieLe ? `, sortie ${h(dejaAuj.sortieLe)}` : ''}). Un seul pointage par jour.` });
    }
    // Entrée (une session ancienne restée ouverte reste signalée « oubli » pour correction par le gérant)
    const p = await prisma.pointageYakro.create({ data: { utilisateurId: req.user.id, nom, restaurantId, entreeLe: maintenant, modeEntree: 'QR' } });
    res.json({ action: 'ENTREE', at: p.entreeLe, nom, restaurant: acces.restaurant.nom, oubliPrecedent: !!ouverte });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Mon pointage (agent) ────────────────────────────────────────────────────
router.get('/moi', auth, yakro, async (req, res) => {
  try {
    const sessions = await prisma.pointageYakro.findMany({ where: { utilisateurId: req.user.id }, orderBy: { entreeLe: 'desc' }, take: 15 });
    const liste = await enrichir(sessions, null);
    res.json({ enService: liste.find(s => s.enService) || null, historique: liste });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Qui est là maintenant + pointages du jour ──────────────────────────────
router.get('/presences', auth, yakro, Y.resto, Y.can('pointage.voir'), async (req, res) => {
  try {
    const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);
    const sessions = await prisma.pointageYakro.findMany({
      where: { ...Y.sc(req), OR: [{ sortieLe: null }, { entreeLe: { gte: debutJour } }, { sortieLe: { gte: debutJour } }] },
      orderBy: { entreeLe: 'asc' },
    });
    const liste = await enrichir(sessions, req.restaurantId);
    res.json({
      enService: liste.filter(s => s.enService),
      aujourdhui: liste.filter(s => !s.enService && !s.oubli),
      oublis: liste.filter(s => s.oubli),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Historique filtrable ────────────────────────────────────────────────────
router.get('/', auth, yakro, Y.resto, Y.can('pointage.voir'), async (req, res) => {
  try {
    const { du, au, utilisateurId } = req.query;
    const d1 = du ? new Date(`${du}T00:00:00`) : new Date(Date.now() - 7 * 86400000);
    const d2 = au ? new Date(`${au}T23:59:59`) : new Date();
    const sessions = await prisma.pointageYakro.findMany({
      where: { ...Y.sc(req), entreeLe: { gte: d1, lte: d2 }, ...(utilisateurId ? { utilisateurId } : {}) },
      orderBy: { entreeLe: 'desc' }, take: 500,
    });
    const liste = await enrichir(sessions, req.restaurantId);
    const parAgent = {};
    for (const s of liste) {
      const a = (parAgent[s.utilisateurId] ||= { utilisateurId: s.utilisateurId, nom: s.nom, jours: new Set(), minutes: 0, commandes: 0, ca: 0, oublis: 0 });
      a.jours.add(new Date(s.entreeLe).toISOString().slice(0, 10));
      if (!s.oubli) a.minutes += s.dureeMin;
      a.commandes += s.activite.commandes; a.ca += s.activite.ca; if (s.oubli) a.oublis++;
    }
    res.json({ sessions: liste, resume: Object.values(parAgent).map(a => ({ ...a, jours: a.jours.size })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Saisie / correction manuelle (gérant) : téléphone oublié, sortie oubliée ─
router.post('/manuel', auth, yakro, Y.resto, Y.can('pointage.gerer'), async (req, res) => {
  try {
    const { utilisateurId, entreeLe, sortieLe, note } = req.body || {};
    if (!utilisateurId || !entreeLe) return res.status(400).json({ error: 'Agent et heure d’entrée requis' });
    const e = new Date(entreeLe), s = sortieLe ? new Date(sortieLe) : null;
    if (isNaN(e) || (s && (isNaN(s) || s <= e))) return res.status(400).json({ error: 'Heures invalides (la sortie doit suivre l’entrée)' });
    const acces = await prisma.accesRestaurantYakro.findFirst({ where: { utilisateurId, restaurantId: req.restaurantId } });
    const u = await prisma.utilisateur.findUnique({ where: { id: utilisateurId }, select: { prenom: true, nom: true, role: true } });
    if (!u || (!acces && !Y.ROLES_ADMIN.includes(u.role))) return res.status(400).json({ error: 'Cet agent n’est pas affecté à ce restaurant' });
    const j0 = new Date(e); j0.setUTCHours(0, 0, 0, 0); const j1 = new Date(j0.getTime() + 86400000);
    if (await prisma.pointageYakro.findFirst({ where: { utilisateurId, entreeLe: { gte: j0, lt: j1 } } })) return res.status(409).json({ error: 'Cet agent a déjà un pointage ce jour-là : corrigez-le au lieu d’en créer un second' });
    const p = await prisma.pointageYakro.create({ data: { utilisateurId, nom: nomDe(u), restaurantId: req.restaurantId, entreeLe: e, sortieLe: s, modeEntree: 'MANUEL', modeSortie: s ? 'MANUEL' : null, note: note || null, corrigePar: nomDe(req.user) } });
    res.status(201).json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/sortie', auth, yakro, Y.resto, Y.can('pointage.gerer'), async (req, res) => {
  try {
    const p = await prisma.pointageYakro.findFirst({ where: { id: req.params.id, ...Y.sc(req) } });
    if (!p) return res.status(404).json({ error: 'Pointage introuvable' });
    const s = new Date(req.body?.sortieLe);
    if (isNaN(s) || s <= p.entreeLe) return res.status(400).json({ error: 'La sortie doit suivre l’entrée' });
    res.json(await prisma.pointageYakro.update({ where: { id: p.id }, data: { sortieLe: s, modeSortie: 'MANUEL', note: req.body.note || p.note, corrigePar: nomDe(req.user) } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
