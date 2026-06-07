const router = require('express').Router();
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');

// GET /api/recherche?q=xxx — Recherche globale multi-entités
router.get('/', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 3) {
      return res.status(400).json({ error: 'La recherche nécessite au moins 3 caractères' });
    }

    const terme = q.trim();
    const user = req.user;
    const isGroupe = user.filiale === 'GROUPE';
    const isDG = ['DG', 'DIRECTEUR'].includes(user.role);

    const resultats = {};

    // Recherche employés (toutes filiales si DG/RH, sinon sa filiale)
    const peutVoirEmployes = ['DG', 'DIRECTEUR', 'RH', 'MANAGER'].includes(user.role);
    if (peutVoirEmployes) {
      const whereEmp = {
        OR: [
          { nom: { contains: terme, mode: 'insensitive' } },
          { prenom: { contains: terme, mode: 'insensitive' } },
          { matricule: { contains: terme, mode: 'insensitive' } },
          { telephone: { contains: terme } },
        ]
      };
      if (!isGroupe && !isDG) whereEmp.filiale = user.filiale;

      resultats.employes = await prisma.employe.findMany({
        where: whereEmp, take: 5,
        select: { id: true, nom: true, prenom: true, matricule: true, poste: true, filiale: true, statut: true }
      });
    }

    // Recherche souscripteurs (TOPTELSIG)
    if (isGroupe || user.filiale === 'TOPTELSIG') {
      resultats.souscripteurs = await prisma.souscripteur.findMany({
        where: {
          OR: [
            { nom: { contains: terme, mode: 'insensitive' } },
            { prenom: { contains: terme, mode: 'insensitive' } },
            { telephone: { contains: terme } },
            { code: { contains: terme, mode: 'insensitive' } },
          ]
        },
        take: 5,
        select: { id: true, nom: true, prenom: true, telephone: true, code: true, statut: true }
      });

      resultats.prescripteurs = await prisma.prescripteur.findMany({
        where: {
          OR: [
            { nom: { contains: terme, mode: 'insensitive' } },
            { prenom: { contains: terme, mode: 'insensitive' } },
            { telephone: { contains: terme } },
            { code: { contains: terme, mode: 'insensitive' } },
          ]
        },
        take: 5,
        select: { id: true, nom: true, prenom: true, telephone: true, code: true, actif: true }
      });

      resultats.lots = await prisma.lot.findMany({
        where: {
          OR: [
            { numero: { contains: terme, mode: 'insensitive' } },
            { ilot: { contains: terme, mode: 'insensitive' } },
            { statut: { contains: terme, mode: 'insensitive' } },
          ]
        },
        take: 5,
        include: { projet: { select: { nom: true, code: true } } }
      });

      resultats.projets = await prisma.projetFoncier.findMany({
        where: {
          OR: [
            { nom: { contains: terme, mode: 'insensitive' } },
            { code: { contains: terme, mode: 'insensitive' } },
            { ville: { contains: terme, mode: 'insensitive' } },
          ]
        },
        take: 5,
        select: { id: true, nom: true, code: true, ville: true, statut: true }
      });
    }

    // Recherche livraisons (LiYA)
    if (isGroupe || user.filiale === 'LIYA') {
      resultats.livraisons = await prisma.livraison.findMany({
        where: {
          OR: [
            { numero: { contains: terme, mode: 'insensitive' } },
            { clientNom: { contains: terme, mode: 'insensitive' } },
            { clientTel: { contains: terme } },
            { adresseLivraison: { contains: terme, mode: 'insensitive' } },
          ]
        },
        take: 5,
        select: { id: true, numero: true, clientNom: true, clientTel: true, statut: true, createdAt: true }
      });

      resultats.motos = await prisma.moto.findMany({
        where: {
          OR: [
            { immatriculation: { contains: terme, mode: 'insensitive' } },
            { marque: { contains: terme, mode: 'insensitive' } },
          ]
        },
        take: 5,
        select: { id: true, immatriculation: true, marque: true, modele: true, statut: true }
      });
    }

    // Recherche produits/stocks (toutes filiales)
    const whereProd = user.filiale !== 'GROUPE'
      ? { filiale: user.filiale, OR: [{ nom: { contains: terme, mode: 'insensitive' } }, { reference: { contains: terme, mode: 'insensitive' } }] }
      : { OR: [{ nom: { contains: terme, mode: 'insensitive' } }, { reference: { contains: terme, mode: 'insensitive' } }] };

    resultats.produits = await prisma.produit.findMany({
      where: whereProd, take: 5,
      select: { id: true, nom: true, reference: true, categorie: true, filiale: true }
    });

    // Compter le total de résultats
    const nbResultats = Object.values(resultats).reduce((s, arr) => s + (arr?.length || 0), 0);

    res.json({ terme, nbResultats, resultats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
