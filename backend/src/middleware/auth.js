/**
 * ERP 2IG — Middleware d'authentification & autorisation
 * - Validation token JWT + vérification en BDD (révocation réelle)
 * - RBAC 14 rôles avec hiérarchie
 * - Isolation par filiale
 */
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');

// ── Hiérarchie des rôles ────────────────────────────────────────────────────
const ROLE_HIERARCHY = {
  DG: 100,
  DIRECTEUR: 90,
  COMPTABLE: 80,
  RH: 80,
  RESP_FONCIER: 70,
  RESP_LIVRAISON: 70,
  MANAGER: 70,
  COMMERCIAL: 60,
  MAGASINIER: 50,
  CAISSIER: 40,
  SERVEUR: 30,
  BARMAN: 30,
  LIVREUR: 20,
  EMPLOYE: 10,
};

// ── Middleware auth — vérifie JWT + session en BDD ──────────────────────────
const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token d\'authentification manquant' });
    }

    const token = header.split(' ')[1];

    // 1. Vérifier signature JWT
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'erp-2ig',
        audience: 'erp-2ig-frontend',
      });
    } catch (jwtErr) {
      // Fallback: accepter tokens sans issuer/audience (rétrocompat)
      try { payload = jwt.verify(token, process.env.JWT_SECRET); }
      catch { return res.status(401).json({ error: 'Token invalide ou expiré' }); }
    }

    // 2. Vérifier que le token existe en BDD (révocation réelle)
    const session = await prisma.session.findUnique({
      where: { token },
      select: { id: true, expiresAt: true, utilisateurId: true }
    });

    if (!session) {
      return res.status(401).json({ error: 'Session révoquée — veuillez vous reconnecter' });
    }

    if (session.expiresAt < new Date()) {
      // Nettoyer la session expirée
      await prisma.session.delete({ where: { token } }).catch(() => {});
      return res.status(401).json({ error: 'Session expirée — veuillez vous reconnecter' });
    }

    // 3. Charger l'utilisateur
    const user = await prisma.utilisateur.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, nom: true, prenom: true,
        role: true, filiale: true, actif: true, derniereConnexion: true,
      }
    });

    if (!user || !user.actif) {
      // Révoquer toutes les sessions si compte désactivé
      await prisma.session.deleteMany({ where: { utilisateurId: payload.userId } }).catch(() => {});
      return res.status(401).json({ error: 'Compte désactivé ou introuvable' });
    }

    req.user = user;
    req.sessionToken = token;
    next();
  } catch (e) {
    logger.error('[AUTH MIDDLEWARE]', { error: e.message });
    return res.status(401).json({ error: 'Erreur d\'authentification' });
  }
};

// ── requireRole — Vérification rôle exact ou DG passe toujours ─────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.role === 'DG') return next(); // DG a tous les droits
  if (roles.includes(req.user.role)) return next();
  logger.warn('[RBAC] Accès refusé', {
    userId: req.user.id, role: req.user.role, rolesRequis: roles, path: req.path
  });
  return res.status(403).json({
    error: `Accès refusé — rôle requis : ${roles.join(' ou ')}`,
    votre_role: req.user.role,
  });
};

// ── requireMinRole — Vérification hiérarchique ──────────────────────────────
const requireMinRole = (minRole) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
  const minLevel = ROLE_HIERARCHY[minRole] || 0;
  if (userLevel >= minLevel) return next();
  return res.status(403).json({ error: `Accès refusé — niveau minimum : ${minRole}` });
};

// ── requireFiliale — Isolation par filiale ───────────────────────────────────
const requireFiliale = (...filiales) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  const userFiliale = req.user.filiale;
  if (userFiliale === 'GROUPE') return next(); // GROUPE = accès transversal
  if (filiales.includes(userFiliale)) return next();
  logger.warn('[RBAC] Accès filiale refusé', {
    userId: req.user.id, filiale: userFiliale, filialesRequises: filiales
  });
  return res.status(403).json({
    error: `Accès réservé à la filiale ${filiales.join(' ou ')}`,
    votre_filiale: userFiliale,
  });
};

// ── Vérifier accès filiale (helper sans middleware) ──────────────────────────
const canAccessFiliale = (user, filiale) => {
  if (user.filiale === 'GROUPE') return true;
  return user.filiale === filiale;
};

// ── Vérifier permission spécifique (pour futures permissions granulaires) ────
const requirePermission = (resource, action) => (req, res, next) => {
  const PERMISSIONS = {
    // Salaires — lecture restreinte DG/RH/COMPTABLE uniquement
    'salaires:read':    ['DG', 'RH', 'COMPTABLE', 'DIRECTEUR'],
    'salaires:export':  ['DG', 'COMPTABLE'],
    // Finances
    'finances:read':    ['DG', 'DIRECTEUR', 'COMPTABLE'],
    'finances:export':  ['DG', 'COMPTABLE'],
    'finances:validate':['DG', 'COMPTABLE', 'DIRECTEUR'],
    // GED critique
    'ged:delete':       ['DG', 'DIRECTEUR'],
    'ged:read':         ['DG', 'DIRECTEUR', 'RH', 'RESP_FONCIER', 'COMPTABLE'],
    // Audit log
    'audit:read':       ['DG', 'DIRECTEUR'],
    // Export données
    'export:employes':  ['DG', 'RH', 'DIRECTEUR'],
    'export:finances':  ['DG', 'COMPTABLE'],
    'export:lots':      ['DG', 'DIRECTEUR', 'RESP_FONCIER', 'COMMERCIAL'],
  };

  const permKey = `${resource}:${action}`;
  const allowed = PERMISSIONS[permKey];
  if (!allowed) return next(); // Permission inconnue = autoriser (non critique)

  if (req.user.role === 'DG') return next();
  if (allowed.includes(req.user.role)) return next();

  return res.status(403).json({
    error: `Permission insuffisante pour ${permKey}`,
    votre_role: req.user.role,
  });
};

module.exports = {
  auth,
  requireRole,
  requireMinRole,
  requireFiliale,
  canAccessFiliale,
  requirePermission,
  ROLE_HIERARCHY,
};
