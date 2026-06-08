/**
 * ERP 2IG — Authentification sécurisée
 * - bcrypt saltRounds=12
 * - Politique mot de passe fort (12 car, maj, min, chiffre, spécial)
 * - Blocage compte après 5 tentatives échouées (15 min)
 * - Validation token en BDD (révocation réelle)
 * - Audit login/logout avec IP
 * - Déconnexion forcée (invalider tous les tokens d'un utilisateur)
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');
const logger = require('../lib/logger');

const SALT_ROUNDS = 12; // Production-grade (OWASP : min 10, recommandé 12+)
const TOKEN_EXPIRY = '8h'; // Réduit de 7j à 8h (avec refresh token optionnel)
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// ── Politique mot de passe fort (OWASP) ────────────────────────────────────
function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 12) errors.push('Minimum 12 caractères');
  if (!/[A-Z]/.test(password)) errors.push('Au moins une majuscule');
  if (!/[a-z]/.test(password)) errors.push('Au moins une minuscule');
  if (!/[0-9]/.test(password)) errors.push('Au moins un chiffre');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) errors.push('Au moins un caractère spécial (!@#$%...)');
  if (/^(.)\1+$/.test(password)) errors.push('Mot de passe trop simple (répétition)');
  return errors;
}

// ── Extraire IP réelle (derrière proxy/Render) ──────────────────────────────
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || 'unknown';
}

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const ip = getClientIP(req);
  const ua = req.headers['user-agent'] || 'unknown';
  const { email, motDePasse } = req.body;

  if (!email || !motDePasse) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    const user = await prisma.utilisateur.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true, email: true, nom: true, prenom: true, role: true,
        filiale: true, actif: true, motDePasse: true,
        loginAttempts: true, lockedUntil: true,
      }
    });

    // Compte inexistant — même message volontaire (évite l'énumération)
    if (!user) {
      logger.warn('[AUTH] Tentative login — email inconnu', { email, ip });
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Compte désactivé
    if (!user.actif) {
      await logAudit(prisma, null, 'LOGIN_FAILED', ip, `Compte désactivé: ${email}`);
      return res.status(403).json({ error: 'Compte désactivé — contacter l\'administrateur' });
    }

    // Compte verrouillé
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      logger.warn('[AUTH] Compte verrouillé', { email, ip, minutesLeft });
      await logAudit(prisma, user.id, 'LOGIN_BLOCKED', ip, `Compte verrouillé — ${minutesLeft} min restantes`);
      return res.status(423).json({
        error: `Compte verrouillé après ${MAX_LOGIN_ATTEMPTS} tentatives. Réessayer dans ${minutesLeft} minute(s).`
      });
    }

    // Vérification mot de passe
    const isValid = await bcrypt.compare(motDePasse, user.motDePasse);

    if (!isValid) {
      const attempts = (user.loginAttempts || 0) + 1;
      const shouldLock = attempts >= MAX_LOGIN_ATTEMPTS;
      const updateData = {
        loginAttempts: attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
      };
      await prisma.utilisateur.update({ where: { id: user.id }, data: updateData });

      logger.warn('[AUTH] Échec login', { email, ip, attempts, locked: shouldLock });
      await logAudit(prisma, user.id, 'LOGIN_FAILED', ip,
        `Tentative ${attempts}/${MAX_LOGIN_ATTEMPTS}${shouldLock ? ' → COMPTE VERROUILLÉ' : ''}`);

      if (shouldLock) {
        return res.status(423).json({
          error: `Compte verrouillé après ${MAX_LOGIN_ATTEMPTS} tentatives échouées. Réessayer dans ${LOCKOUT_MINUTES} minutes.`
        });
      }
      const remaining = MAX_LOGIN_ATTEMPTS - attempts;
      return res.status(401).json({
        error: `Identifiants invalides. ${remaining} tentative(s) restante(s) avant verrouillage.`
      });
    }

    // Succès — réinitialiser le compteur de tentatives
    await prisma.utilisateur.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null, derniereConnexion: new Date() }
    });

    // Générer le token JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role, filiale: user.filiale },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY, issuer: 'erp-2ig', audience: 'erp-2ig-frontend' }
    );

    // Persister le token en BDD (permet la révocation)
    await prisma.session.create({
      data: {
        token,
        utilisateurId: user.id,
        ip,
        userAgent: ua.slice(0, 255),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      }
    });

    // Nettoyer les vieilles sessions (garder max 5 sessions actives par user)
    const userSessions = await prisma.session.findMany({
      where: { utilisateurId: user.id },
      orderBy: { createdAt: 'desc' }
    });
    if (userSessions.length > 5) {
      const toDelete = userSessions.slice(5).map(s => s.id);
      await prisma.session.deleteMany({ where: { id: { in: toDelete } } });
    }

    // Audit trail
    await logAudit(prisma, user.id, 'LOGIN', ip, `Connexion réussie depuis ${ip}`, user.filiale, user.nom + ' ' + user.prenom);

    logger.info('[AUTH] Login réussi', { email: user.email, role: user.role, filiale: user.filiale, ip });

    const { motDePasse: _, loginAttempts: __, lockedUntil: ___, ...userSafe } = user;
    res.json({ token, expiresIn: TOKEN_EXPIRY, user: userSafe });

  } catch (e) {
    logger.error('[AUTH] Erreur login', { error: e.message, ip });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', auth, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const ip = getClientIP(req);

    // Révoquer le token en BDD (logout forcé immédiat)
    await prisma.session.deleteMany({ where: { token } });

    await logAudit(prisma, req.user.id, 'LOGOUT', ip, 'Déconnexion volontaire', req.user.filiale, req.user.prenom + ' ' + req.user.nom);
    logger.info('[AUTH] Logout', { userId: req.user.id, ip });
    res.json({ message: 'Déconnecté' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth/logout-all — Déconnexion forcée de TOUTES les sessions ──
router.post('/logout-all', auth, async (req, res) => {
  try {
    const ip = getClientIP(req);
    const count = await prisma.session.deleteMany({ where: { utilisateurId: req.user.id } });
    await logAudit(prisma, req.user.id, 'LOGOUT_ALL', ip, `Révocation de ${count.count} session(s)`, req.user.filiale, req.user.prenom + ' ' + req.user.nom);
    res.json({ message: `${count.count} session(s) révoquée(s)` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', auth, (req, res) => res.json(req.user));

// ── GET /api/auth/sessions — Sessions actives ───────────────────────────────
router.get('/sessions', auth, async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { utilisateurId: req.user.id, expiresAt: { gt: new Date() } },
    select: { id: true, ip: true, userAgent: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(sessions);
});

// ── DELETE /api/auth/sessions/:id — Révoquer une session spécifique ─────────
router.delete('/sessions/:id', auth, async (req, res) => {
  await prisma.session.deleteMany({ where: { id: req.params.id, utilisateurId: req.user.id } });
  res.json({ message: 'Session révoquée' });
});

// ── POST /api/auth/register — Création compte (DG seulement) ────────────────
router.post('/register', async (req, res) => {
  try {
    const count = await prisma.utilisateur.count();
    if (count > 0) {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Création de compte réservée au DG — token requis' });
      }
      let payload;
      try { payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET); }
      catch { return res.status(401).json({ error: 'Token invalide' }); }
      const caller = await prisma.utilisateur.findUnique({ where: { id: payload.userId } });
      if (!caller || !['DG', 'DIRECTEUR'].includes(caller.role)) {
        return res.status(403).json({ error: 'Seul le DG peut créer des comptes utilisateurs' });
      }
    }

    const { email, motDePasse, nom, prenom, telephone, role, filiale } = req.body;
    if (!email || !motDePasse || !nom || !prenom || !filiale) {
      return res.status(400).json({ error: 'email, motDePasse, nom, prenom, filiale sont obligatoires' });
    }

    // Validation politique mot de passe
    const pwErrors = validatePassword(motDePasse);
    if (pwErrors.length > 0) {
      return res.status(400).json({ error: 'Mot de passe trop faible', details: pwErrors });
    }

    const hash = await bcrypt.hash(motDePasse, SALT_ROUNDS);
    const user = await prisma.utilisateur.create({
      data: {
        email: email.toLowerCase().trim(),
        motDePasse: hash,
        nom, prenom, telephone,
        role: role || 'EMPLOYE',
        filiale,
        loginAttempts: 0,
      }
    });
    const { motDePasse: _, ...userSafe } = user;
    logger.info('[AUTH] Compte créé', { email: user.email, role: user.role, filiale: user.filiale });
    res.status(201).json(userSafe);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Email déjà utilisé' });
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/auth/password — Changement mot de passe avec politique ──────────
router.put('/password', auth, async (req, res) => {
  try {
    const { ancien, nouveau } = req.body;
    if (!ancien || !nouveau) return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' });

    // Politique mot de passe
    const pwErrors = validatePassword(nouveau);
    if (pwErrors.length > 0) return res.status(400).json({ error: 'Nouveau mot de passe trop faible', details: pwErrors });

    const user = await prisma.utilisateur.findUnique({ where: { id: req.user.id } });
    const ok = await bcrypt.compare(ancien, user.motDePasse);
    if (!ok) return res.status(400).json({ error: 'Ancien mot de passe incorrect' });

    // Vérifier que le nouveau n'est pas identique à l'ancien
    const samePw = await bcrypt.compare(nouveau, user.motDePasse);
    if (samePw) return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l\'ancien' });

    const hash = await bcrypt.hash(nouveau, SALT_ROUNDS);
    await prisma.utilisateur.update({ where: { id: req.user.id }, data: { motDePasse: hash } });

    // Révoquer toutes les autres sessions (sécurité — forcer re-login)
    const currentToken = req.headers.authorization?.split(' ')[1];
    await prisma.session.deleteMany({
      where: { utilisateurId: req.user.id, token: { not: currentToken } }
    });

    const ip = getClientIP(req);
    await logAudit(prisma, req.user.id, 'PASSWORD_CHANGE', ip, 'Mot de passe modifié', req.user.filiale, req.user.prenom + ' ' + req.user.nom);
    logger.info('[AUTH] Mot de passe changé', { userId: req.user.id });
    res.json({ message: 'Mot de passe modifié. Les autres sessions ont été révoquées.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DG : Forcer déconnexion d'un utilisateur ─────────────────────────────────
router.post('/force-logout/:userId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'DG') return res.status(403).json({ error: 'Réservé au DG' });
    const count = await prisma.session.deleteMany({ where: { utilisateurId: req.params.userId } });
    const ip = getClientIP(req);
    await logAudit(prisma, req.user.id, 'FORCE_LOGOUT', ip, `Déconnexion forcée de l'utilisateur ${req.params.userId}`, req.user.filiale, req.user.prenom + ' ' + req.user.nom);
    res.json({ message: `${count.count} session(s) révoquée(s)` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DG : Débloquer un compte verrouillé ──────────────────────────────────────
router.post('/unlock/:userId', auth, async (req, res) => {
  try {
    if (!['DG', 'DIRECTEUR'].includes(req.user.role)) return res.status(403).json({ error: 'Réservé au DG' });
    await prisma.utilisateur.update({
      where: { id: req.params.userId },
      data: { loginAttempts: 0, lockedUntil: null }
    });
    const ip = getClientIP(req);
    await logAudit(prisma, req.user.id, 'UNLOCK_ACCOUNT', ip, `Déblocage compte ${req.params.userId}`, req.user.filiale, req.user.prenom + ' ' + req.user.nom);
    res.json({ message: 'Compte débloqué' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/auth/security-log — Journal de sécurité (DG uniquement) ─────────
router.get('/security-log', auth, async (req, res) => {
  try {
    if (!['DG', 'DIRECTEUR'].includes(req.user.role)) return res.status(403).json({ error: 'Réservé au DG' });
    const { page = 1, limit = 50, action } = req.query;
    const where = {};
    if (action) where.action = action;
    const securityActions = ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'LOGIN_BLOCKED', 'LOGOUT_ALL', 'FORCE_LOGOUT', 'PASSWORD_CHANGE', 'UNLOCK_ACCOUNT'];
    where.action = action ? action : { in: securityActions };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where, skip: (Number(page)-1)*Number(limit), take: Number(limit),
        orderBy: { createdAt: 'desc' }
      })
    ]);
    res.json({ data: logs, total, page: Number(page), pages: Math.ceil(total/Number(limit)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Utilitaire audit ─────────────────────────────────────────────────────────
async function logAudit(prisma, userId, action, ip, label, filiale = 'GROUPE', nom = '') {
  try {
    await prisma.auditLog.create({
      data: {
        utilisateurId: userId || 'system',
        utilisateurNom: nom || 'Système',
        filiale: filiale || 'GROUPE',
        action,
        entite: 'Utilisateur',
        entiteId: userId,
        entiteLabel: label,
        ip,
      }
    });
  } catch (e) { /* Non bloquant */ }
}

module.exports = router;

// ── GET /api/auth/utilisateurs — Liste tous les utilisateurs (DG/RH)
router.get('/utilisateurs', auth, async (req, res) => {
  try {
    if (!['DG','DIRECTEUR','RH'].includes(req.user.role)) return res.status(403).json({ error: 'Réservé au DG/RH' });
    const { filiale, role, actif } = req.query;
    const where = {};
    if (filiale) where.filiale = filiale;
    if (role) where.role = role;
    if (actif !== undefined) where.actif = actif === 'true';
    const users = await prisma.utilisateur.findMany({
      where, orderBy: { createdAt: 'desc' },
      select: { id:true, email:true, nom:true, prenom:true, role:true, filiale:true, actif:true, loginAttempts:true, lockedUntil:true, derniereConnexion:true, createdAt:true }
    });
    res.json(users);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/auth/utilisateurs/:id/role — Changer rôle/filiale
router.put('/utilisateurs/:id/role', auth, async (req, res) => {
  try {
    if (req.user.role !== 'DG') return res.status(403).json({ error: 'Réservé au DG' });
    const { role, filiale, actif } = req.body;
    const data = {};
    if (role) data.role = role;
    if (filiale) data.filiale = filiale;
    if (actif !== undefined) data.actif = Boolean(actif);
    if (!actif) await prisma.session.deleteMany({ where: { utilisateurId: req.params.id } });
    const user = await prisma.utilisateur.update({
      where: { id: req.params.id }, data,
      select: { id:true, email:true, nom:true, prenom:true, role:true, filiale:true, actif:true }
    });
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    await prisma.auditLog.create({ data: { utilisateurId: req.user.id, utilisateurNom: `${req.user.prenom} ${req.user.nom}`, filiale: req.user.filiale, action: 'UPDATE', entite: 'Utilisateur', entiteId: req.params.id, entiteLabel: `Rôle → ${role || 'inchangé'} | Filiale → ${filiale || 'inchangée'}`, ip } });
    res.json(user);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/auth/utilisateurs/:id — Désactiver un compte
router.delete('/utilisateurs/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'DG') return res.status(403).json({ error: 'Réservé au DG' });
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer son propre compte' });
    await prisma.session.deleteMany({ where: { utilisateurId: req.params.id } });
    await prisma.utilisateur.update({ where: { id: req.params.id }, data: { actif: false } });
    res.json({ message: 'Compte désactivé' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
