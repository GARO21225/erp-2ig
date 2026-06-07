const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale, requireRole } = require('../../middleware/auth');
const yakro = requireFiliale('YAKRO_GRILL');

router.get('/', auth, async (req, res) => {
  try {
    const { categorie, disponible } = req.query;
    const where = {};
    if (categorie) where.categorie = categorie;
    if (disponible !== undefined) where.disponible = disponible === 'true';

    const menu = await prisma.menuYakro.findMany({
      where,
      orderBy: [{ categorie: 'asc' }, { nom: 'asc' }]
    });

    // Grouper par catégorie
    const grouped = menu.reduce((acc, item) => {
      if (!acc[item.categorie]) acc[item.categorie] = [];
      acc[item.categorie].push(item);
      return acc;
    }, {});

    res.json({ items: menu, grouped });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, yakro, requireRole('DG', 'MANAGER', 'DIRECTEUR'), async (req, res) => {
  try {
    const item = await prisma.menuYakro.create({ data: req.body });
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', auth, yakro, requireRole('DG', 'MANAGER', 'DIRECTEUR'), async (req, res) => {
  try {
    const item = await prisma.menuYakro.update({ where: { id: req.params.id }, data: req.body });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', auth, yakro, requireRole('DG', 'MANAGER', 'DIRECTEUR'), async (req, res) => {
  try {
    await prisma.menuYakro.delete({ where: { id: req.params.id } });
    res.json({ message: 'Supprimé' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Seed menu depuis le PDF Yakro Grill
router.post('/seed', auth, requireRole('DG'), async (req, res) => {
  try {
    const menuData = getMenuSeed();
    await prisma.menuYakro.createMany({ data: menuData, skipDuplicates: true });
    res.json({ message: `${menuData.length} articles importés` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function getMenuSeed() {
  return [
    // Garnitures
    { nom: 'Attiéké nature', categorie: 'GARNITURE', prix: 1000 },
    { nom: 'Alloco', categorie: 'GARNITURE', prix: 1000 },
    { nom: 'Riz nature ou légumes', categorie: 'GARNITURE', prix: 1000 },
    { nom: 'Frite de pomme de terre', categorie: 'GARNITURE', prix: 1000 },
    { nom: 'Pomme de terre écrasée', categorie: 'GARNITURE', prix: 2000 },
    { nom: 'Pomme sauté', categorie: 'GARNITURE', prix: 1000 },
    { nom: "Frite d'igname", categorie: 'GARNITURE', prix: 1000 },
    { nom: 'Légume sauté', categorie: 'GARNITURE', prix: 1000 },
    // Plats européens
    { nom: 'Steak de boeuf haché', categorie: 'PLAT_EUROPEEN', prix: 8000 },
    { nom: 'Entrecôte de Porc', categorie: 'PLAT_EUROPEEN', prix: 9000 },
    { nom: 'Suprême de poulet (garniture au choix)', categorie: 'PLAT_EUROPEEN', prix: 10000 },
    { nom: 'Lapin chasseur', categorie: 'PLAT_EUROPEEN', prix: 15000 },
    { nom: 'Escalope de poulet poêlé, crème champignon', categorie: 'PLAT_EUROPEEN', prix: 9000 },
    { nom: 'Côte de porc poêlé + sauce moutarde', categorie: 'PLAT_EUROPEEN', prix: 9000 },
    { nom: 'Mignon de porc, sauce crème', categorie: 'PLAT_EUROPEEN', prix: 9000 },
    { nom: "Brochette d'Escargot (2 brochettes)", categorie: 'PLAT_EUROPEEN', prix: 10000 },
    // Volailles
    { nom: 'Poulet de chair demi (Grillé/Sauté/Choukouya)', categorie: 'VOLAILLE', prix: 5000, prixMini: 5000, prixMaxi: 9000 },
    { nom: 'Poulet de chair entier', categorie: 'VOLAILLE', prix: 9000 },
    { nom: 'Poulet Roti', categorie: 'VOLAILLE', prix: 15000 },
    { nom: 'Poulet DG', categorie: 'VOLAILLE', prix: 12000 },
    { nom: 'Poulet Mayo demi', categorie: 'VOLAILLE', prix: 6000 },
    { nom: 'Poulet hybride', categorie: 'VOLAILLE', prix: 12000 },
    { nom: 'Poulet pondeuse', categorie: 'VOLAILLE', prix: 12000 },
    // Viandes
    { nom: 'Cabri', categorie: 'VIANDE', prix: 5000 },
    { nom: 'Porc', categorie: 'VIANDE', prix: 5000 },
    { nom: 'Mouton', categorie: 'VIANDE', prix: 5000 },
    { nom: 'Lapin', categorie: 'VIANDE', prix: 15000 },
    { nom: 'Entrecôte de Boeuf poêlé à l\'échalotte', categorie: 'VIANDE', prix: 9000 },
    { nom: 'Filet de Bœuf, Sauce Crème Champignon', categorie: 'VIANDE', prix: 10000 },
    { nom: 'Brochette De Bœuf (2 brochettes)', categorie: 'VIANDE', prix: 9000 },
    { nom: 'Souris d\'agneau au miel', categorie: 'VIANDE', prix: 10000 },
    // Brochettes
    { nom: 'Brochette de Poulet', categorie: 'BROCHETTE', prix: 8000 },
    { nom: 'Brochette de filet de bœuf', categorie: 'BROCHETTE', prix: 9000 },
    { nom: 'Brochette de gésier', categorie: 'BROCHETTE', prix: 6000 },
    { nom: 'Brochette de Gambas', categorie: 'BROCHETTE', prix: 15000 },
    // Plateaux
    { nom: 'Plateau PREMIUM', categorie: 'PLATEAU', prix: 60000 },
    { nom: 'Plateau PLATINE', categorie: 'PLATEAU', prix: 40000 },
    { nom: 'Plateau SOLO', categorie: 'PLATEAU', prix: 25000 },
    // Pizzas
    { nom: 'Pizza Royale Grande', categorie: 'PIZZA', prix: 10000, prixMini: 6000, prixMaxi: 10000 },
    { nom: 'Pizza au Poulet Grande', categorie: 'PIZZA', prix: 10000, prixMini: 6000 },
    { nom: 'Pizza Toscane Grande', categorie: 'PIZZA', prix: 10000, prixMini: 6000 },
    { nom: 'Pizza Fruits de Mer Grande', categorie: 'PIZZA', prix: 10000, prixMini: 6000 },
    { nom: 'Pizza végétarienne Grande', categorie: 'PIZZA', prix: 10000, prixMini: 6000 },
    { nom: 'Pizza 4 saisons Grande', categorie: 'PIZZA', prix: 10000, prixMini: 6000 },
    // Chawarmas / Burgers
    { nom: 'Chawarma végétarien', categorie: 'CHAWARMA', prix: 3000 },
    { nom: 'Chawarma viande hachée', categorie: 'CHAWARMA', prix: 3000 },
    { nom: 'Chawarma Poulet', categorie: 'CHAWARMA', prix: 3000 },
    { nom: 'Tacos viande hachée', categorie: 'CHAWARMA', prix: 3000 },
    { nom: 'Tacos poulet', categorie: 'CHAWARMA', prix: 3000 },
    { nom: 'Burger + frites', categorie: 'CHAWARMA', prix: 5000 },
    // Desserts
    { nom: 'Salade de Fruits', categorie: 'DESSERT', prix: 2000 },
    { nom: 'Mousse au Chocolat', categorie: 'DESSERT', prix: 2500 },
    { nom: 'Crêpe Chocolat', categorie: 'DESSERT', prix: 2000 },
    { nom: 'Crêpe Nature', categorie: 'DESSERT', prix: 1500 },
    { nom: 'Glace (par boule)', categorie: 'DESSERT', prix: 1000 },
    // Bières
    { nom: 'Heineken', categorie: 'BIERE', prix: 1000 },
    { nom: 'Desperados', categorie: 'BIERE', prix: 1000 },
    { nom: 'Guinness', categorie: 'BIERE', prix: 1500 },
    { nom: 'Budweiser', categorie: 'BIERE', prix: 1500 },
    { nom: 'Malta Guinness', categorie: 'BIERE', prix: 1000 },
    // Cocktails sans alcool
    { nom: 'Mojito Virgin', categorie: 'COCKTAIL_SANS_ALCOOL', prix: 3000 },
    { nom: 'Bora Bora', categorie: 'COCKTAIL_SANS_ALCOOL', prix: 3000 },
    { nom: 'Mojito Kiwi', categorie: 'COCKTAIL_SANS_ALCOOL', prix: 5000 },
    { nom: 'Mojito Fraise', categorie: 'COCKTAIL_SANS_ALCOOL', prix: 5000 },
    { nom: 'Jardin Fumé', categorie: 'COCKTAIL_SANS_ALCOOL', prix: 10000 },
    // Cocktails alcoolisés
    { nom: 'Mojito Classique', categorie: 'COCKTAIL_ALCOOLISE', prix: 4000 },
    { nom: 'Margarita', categorie: 'COCKTAIL_ALCOOLISE', prix: 5000 },
    { nom: 'Pina Colada', categorie: 'COCKTAIL_ALCOOLISE', prix: 5000 },
    { nom: 'BMW', categorie: 'COCKTAIL_ALCOOLISE', prix: 7000 },
    { nom: 'Mojito Champagne', categorie: 'COCKTAIL_ALCOOLISE', prix: 25000 },
    { nom: 'Cocktail Alla', categorie: 'COCKTAIL_ALCOOLISE', prix: 20000 },
    // Vins & Champagnes
    { nom: 'Les Bordeaux', categorie: 'VIN', prix: 15000 },
    { nom: 'Moet', categorie: 'CHAMPAGNE', prix: 60000 },
    { nom: 'Veuve Cliquot', categorie: 'CHAMPAGNE', prix: 70000 },
    { nom: 'Veuve Hambal', categorie: 'CHAMPAGNE', prix: 45000 },
    // Sucreries
    { nom: 'Fanta', categorie: 'SUCRERIE', prix: 1000 },
    { nom: 'Coca-cola', categorie: 'SUCRERIE', prix: 1000 },
    { nom: 'Orangina', categorie: 'SUCRERIE', prix: 1000 },
    // Tisanes
    { nom: 'Tisane Gingembre', categorie: 'TISANE', prix: 1500 },
    { nom: 'Tisane Bissap', categorie: 'TISANE', prix: 1500 },
  ];
}

module.exports = router;
