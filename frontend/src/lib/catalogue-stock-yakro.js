/**
 * Stock Yakro Grill — Articles nécessaires basés sur le menu réel
 * Catégories d'approvisionnement pour le restaurant
 */
export const STOCK_YAKRO = [
  // VIANDES & PROTÉINES
  { categorie: 'VIANDES_PROTEINES', nom: 'Poulet de chair (kg)', unite: 'kg', stockAlert: 10, prixAchat: 2500 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Poulet hybride (kg)', unite: 'kg', stockAlert: 5, prixAchat: 3000 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Poulet pondeuse (kg)', unite: 'kg', stockAlert: 5, prixAchat: 2800 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Viande de bœuf (kg)', unite: 'kg', stockAlert: 5, prixAchat: 5500 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Entrecôte de bœuf (kg)', unite: 'kg', stockAlert: 3, prixAchat: 6000 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Filet de bœuf (kg)', unite: 'kg', stockAlert: 2, prixAchat: 7000 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Viande de porc (kg)', unite: 'kg', stockAlert: 5, prixAchat: 3500 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Côte de porc (kg)', unite: 'kg', stockAlert: 3, prixAchat: 4000 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Cabri (kg)', unite: 'kg', stockAlert: 5, prixAchat: 4500 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Mouton (kg)', unite: 'kg', stockAlert: 5, prixAchat: 5000 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Lapin (pièce)', unite: 'pièce', stockAlert: 3, prixAchat: 6000 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Gambas (kg)', unite: 'kg', stockAlert: 2, prixAchat: 8000 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Gésiers de poulet (kg)', unite: 'kg', stockAlert: 3, prixAchat: 2000 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Escargots (kg)', unite: 'kg', stockAlert: 2, prixAchat: 4000 },
  { categorie: 'VIANDES_PROTEINES', nom: 'Souris d\'agneau (kg)', unite: 'kg', stockAlert: 2, prixAchat: 6500 },

  // FÉCULENTS & GARNITURES
  { categorie: 'FECULENTS', nom: 'Riz (sac 25kg)', unite: 'sac', stockAlert: 3, prixAchat: 25000 },
  { categorie: 'FECULENTS', nom: 'Attiéké (kg)', unite: 'kg', stockAlert: 10, prixAchat: 800 },
  { categorie: 'FECULENTS', nom: 'Pommes de terre (kg)', unite: 'kg', stockAlert: 10, prixAchat: 1200 },
  { categorie: 'FECULENTS', nom: 'Igname (kg)', unite: 'kg', stockAlert: 10, prixAchat: 900 },
  { categorie: 'FECULENTS', nom: 'Plantain (régime)', unite: 'régime', stockAlert: 5, prixAchat: 3000 },
  { categorie: 'FECULENTS', nom: 'Farine de blé (kg)', unite: 'kg', stockAlert: 10, prixAchat: 700 },

  // LÉGUMES & CONDIMENTS
  { categorie: 'LEGUMES_CONDIMENTS', nom: 'Oignons (kg)', unite: 'kg', stockAlert: 5, prixAchat: 500 },
  { categorie: 'LEGUMES_CONDIMENTS', nom: 'Tomates fraîches (kg)', unite: 'kg', stockAlert: 5, prixAchat: 600 },
  { categorie: 'LEGUMES_CONDIMENTS', nom: 'Poivrons (kg)', unite: 'kg', stockAlert: 2, prixAchat: 1200 },
  { categorie: 'LEGUMES_CONDIMENTS', nom: 'Ail (kg)', unite: 'kg', stockAlert: 2, prixAchat: 3000 },
  { categorie: 'LEGUMES_CONDIMENTS', nom: 'Gingembre (kg)', unite: 'kg', stockAlert: 1, prixAchat: 2000 },
  { categorie: 'LEGUMES_CONDIMENTS', nom: 'Citrons (kg)', unite: 'kg', stockAlert: 2, prixAchat: 1500 },
  { categorie: 'LEGUMES_CONDIMENTS', nom: 'Légumes mélangés (kg)', unite: 'kg', stockAlert: 5, prixAchat: 800 },

  // PRODUITS LAITIERS & SAUCES
  { categorie: 'LAITIERS_SAUCES', nom: 'Crème fraîche (L)', unite: 'litre', stockAlert: 3, prixAchat: 2500 },
  { categorie: 'LAITIERS_SAUCES', nom: 'Beurre (kg)', unite: 'kg', stockAlert: 2, prixAchat: 4000 },
  { categorie: 'LAITIERS_SAUCES', nom: 'Fromage (kg)', unite: 'kg', stockAlert: 1, prixAchat: 6000 },
  { categorie: 'LAITIERS_SAUCES', nom: 'Sauce tomate (L)', unite: 'litre', stockAlert: 5, prixAchat: 1500 },
  { categorie: 'LAITIERS_SAUCES', nom: 'Moutarde (kg)', unite: 'kg', stockAlert: 1, prixAchat: 2000 },
  { categorie: 'LAITIERS_SAUCES', nom: 'Champignons (boîte)', unite: 'boîte', stockAlert: 5, prixAchat: 2500 },
  { categorie: 'LAITIERS_SAUCES', nom: 'Mayonnaise (kg)', unite: 'kg', stockAlert: 2, prixAchat: 3000 },

  // PIZZA & CHAWARMA
  { categorie: 'PIZZA_CHAWARMA', nom: 'Pâte à pizza (kg)', unite: 'kg', stockAlert: 5, prixAchat: 1500 },
  { categorie: 'PIZZA_CHAWARMA', nom: 'Pain pita (unité)', unite: 'unité', stockAlert: 30, prixAchat: 300 },
  { categorie: 'PIZZA_CHAWARMA', nom: 'Pain burger (unité)', unite: 'unité', stockAlert: 20, prixAchat: 400 },
  { categorie: 'PIZZA_CHAWARMA', nom: 'Fruits de mer (kg)', unite: 'kg', stockAlert: 2, prixAchat: 7000 },

  // BOISSONS
  { categorie: 'BOISSONS', nom: 'Heineken (casier 24)', unite: 'casier', stockAlert: 5, prixAchat: 18000 },
  { categorie: 'BOISSONS', nom: 'Desperados (casier 24)', unite: 'casier', stockAlert: 3, prixAchat: 22000 },
  { categorie: 'BOISSONS', nom: 'Guinness (casier 24)', unite: 'casier', stockAlert: 3, prixAchat: 24000 },
  { categorie: 'BOISSONS', nom: 'Budweiser (casier 24)', unite: 'casier', stockAlert: 3, prixAchat: 22000 },
  { categorie: 'BOISSONS', nom: 'Malta Guinness (casier)', unite: 'casier', stockAlert: 2, prixAchat: 18000 },
  { categorie: 'BOISSONS', nom: 'Fanta (casier 24)', unite: 'casier', stockAlert: 3, prixAchat: 12000 },
  { categorie: 'BOISSONS', nom: 'Coca-cola (casier 24)', unite: 'casier', stockAlert: 3, prixAchat: 12000 },
  { categorie: 'BOISSONS', nom: 'Eau minérale (casier)', unite: 'casier', stockAlert: 5, prixAchat: 6000 },

  // ALCOOLS POUR COCKTAILS
  { categorie: 'ALCOOLS_BAR', nom: 'Rhum blanc (bouteille)', unite: 'bouteille', stockAlert: 3, prixAchat: 8000 },
  { categorie: 'ALCOOLS_BAR', nom: 'Tequila (bouteille)', unite: 'bouteille', stockAlert: 2, prixAchat: 12000 },
  { categorie: 'ALCOOLS_BAR', nom: 'Gin (bouteille)', unite: 'bouteille', stockAlert: 2, prixAchat: 10000 },
  { categorie: 'ALCOOLS_BAR', nom: 'Vodka (bouteille)', unite: 'bouteille', stockAlert: 2, prixAchat: 10000 },
  { categorie: 'ALCOOLS_BAR', nom: 'Champagne Moët (bouteille)', unite: 'bouteille', stockAlert: 2, prixAchat: 45000 },
  { categorie: 'ALCOOLS_BAR', nom: 'Champagne Veuve Cliquot (bouteille)', unite: 'bouteille', stockAlert: 2, prixAchat: 55000 },
  { categorie: 'ALCOOLS_BAR', nom: 'Vin rouge Bordeaux (bouteille)', unite: 'bouteille', stockAlert: 5, prixAchat: 8000 },
  { categorie: 'ALCOOLS_BAR', nom: 'Sirop menthe (bouteille)', unite: 'bouteille', stockAlert: 3, prixAchat: 3000 },
  { categorie: 'ALCOOLS_BAR', nom: 'Jus de citron vert (L)', unite: 'litre', stockAlert: 3, prixAchat: 2000 },
  { categorie: 'ALCOOLS_BAR', nom: 'Bissap (kg sec)', unite: 'kg', stockAlert: 2, prixAchat: 3000 },

  // ÉPICERIE & CONSOMMABLES
  { categorie: 'EPICERIE', nom: 'Huile végétale (bidon 20L)', unite: 'bidon', stockAlert: 3, prixAchat: 25000 },
  { categorie: 'EPICERIE', nom: 'Sel (kg)', unite: 'kg', stockAlert: 5, prixAchat: 300 },
  { categorie: 'EPICERIE', nom: 'Poivre (kg)', unite: 'kg', stockAlert: 1, prixAchat: 8000 },
  { categorie: 'EPICERIE', nom: 'Sucre (kg)', unite: 'kg', stockAlert: 5, prixAchat: 700 },
  { categorie: 'EPICERIE', nom: 'Cube Maggi (boîte)', unite: 'boîte', stockAlert: 5, prixAchat: 2500 },
  { categorie: 'EPICERIE', nom: 'Chocolat (kg)', unite: 'kg', stockAlert: 1, prixAchat: 5000 },
  { categorie: 'EPICERIE', nom: 'Glace (sac 10kg)', unite: 'sac', stockAlert: 5, prixAchat: 3000 },

  // GAZ & ÉNERGIE CUISINE
  { categorie: 'GAZ_ENERGIE', nom: 'Bouteille gaz 12kg', unite: 'bouteille', stockAlert: 2, prixAchat: 9000 },
  { categorie: 'GAZ_ENERGIE', nom: 'Charbon de bois (sac)', unite: 'sac', stockAlert: 3, prixAchat: 5000 },
];

export const CATEGORIES_STOCK_YAKRO = {
  VIANDES_PROTEINES: 'Viandes & Protéines',
  FECULENTS: 'Féculents & Garnitures',
  LEGUMES_CONDIMENTS: 'Légumes & Condiments',
  LAITIERS_SAUCES: 'Laitiers & Sauces',
  PIZZA_CHAWARMA: 'Pizza & Chawarma',
  BOISSONS: 'Boissons',
  ALCOOLS_BAR: 'Alcools & Bar',
  EPICERIE: 'Épicerie',
  GAZ_ENERGIE: 'Gaz & Énergie',
};
