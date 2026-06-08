/**
 * Catalogue RH 2IG — Filiale → Département → Poste
 * Sélection en cascade : choisir filiale filtre les départements,
 * choisir département filtre les postes
 */
export const CATALOGUE_RH = {
  GROUPE: {
    label: 'Groupe 2iG',
    departements: {
      DIRECTION: {
        label: 'Direction Générale',
        postes: ['Directeur Général', 'Directeur Adjoint', 'Conseiller DG', 'Assistant(e) de direction']
      },
      RH: {
        label: 'Ressources Humaines',
        postes: ['Responsable RH', 'Assistant(e) RH', 'Chargé(e) de paie', 'Gestionnaire RH']
      },
      FINANCE: {
        label: 'Finance & Comptabilité',
        postes: ['Directeur Financier', 'Comptable Principal', 'Comptable', 'Contrôleur de gestion', 'Caissier Principal']
      },
      INFORMATIQUE: {
        label: 'Informatique & Systèmes',
        postes: ['Responsable IT', 'Développeur', 'Technicien informatique', 'Administrateur système']
      },
      JURIDIQUE: {
        label: 'Juridique & Conformité',
        postes: ['Juriste', 'Secrétaire juridique']
      },
    }
  },

  YAKRO_GRILL: {
    label: 'Yakro Grill',
    departements: {
      CUISINE: {
        label: 'Cuisine',
        postes: ['Chef Cuisinier', 'Cuisinier', 'Commis de cuisine', 'Plongeur', 'Chef Pâtissier', 'Aide-cuisinier']
      },
      SALLE: {
        label: 'Salle & Service',
        postes: ['Maître d\'hôtel', 'Chef de rang', 'Serveur', 'Hôtesse d\'accueil', 'Runner']
      },
      BAR: {
        label: 'Bar',
        postes: ['Chef Barman', 'Barman', 'Barmaid', 'Serveur Bar']
      },
      CAISSE: {
        label: 'Caisse & Encaissement',
        postes: ['Caissier Principal', 'Caissier', 'Responsable Caisse']
      },
      MANAGEMENT: {
        label: 'Management Restaurant',
        postes: ['Directeur de Restaurant', 'Manager', 'Responsable Salle', 'Responsable Production']
      },
      LOGISTIQUE: {
        label: 'Logistique & Approvisionnement',
        postes: ['Responsable Stocks', 'Magasinier', 'Livreur Interne', 'Agent d\'entretien']
      },
    }
  },

  TOPTELSIG: {
    label: 'TOPTELSIG — Foncier',
    departements: {
      COMMERCIAL: {
        label: 'Commercial & Ventes',
        postes: ['Directeur Commercial', 'Responsable Ventes', 'Commercial Foncier', 'Agent Commercial', 'Prescripteur Interne']
      },
      FONCIER: {
        label: 'Technique Foncier',
        postes: ['Responsable Foncier', 'Géomètre-Expert', 'Technicien Foncier', 'Chargé de Lotissement', 'Agent de Terrain']
      },
      JURIDIQUE: {
        label: 'Juridique & Titres',
        postes: ['Juriste Foncier', 'Notaire Partenaire', 'Chargé des Titres', 'Secrétaire Juridique']
      },
      COMPTABILITE: {
        label: 'Finance & Recouvrement',
        postes: ['Comptable', 'Chargé de Recouvrement', 'Caissier', 'Gestionnaire Financier']
      },
      PROJET: {
        label: 'Gestion de Projets',
        postes: ['Chef de Projet', 'Coordinateur de Chantier', 'Conducteur de Travaux', 'Technicien Topographe']
      },
    }
  },

  LIYA: {
    label: 'LiYA — Livraison',
    departements: {
      OPERATIONS: {
        label: 'Opérations Livraison',
        postes: ['Responsable Livraisons', 'Dispatcher', 'Superviseur de Zone', 'Coordinateur Opérations']
      },
      TERRAIN: {
        label: 'Équipe Terrain',
        postes: ['Livreur Moto', 'Livreur Véhicule', 'Coursier', 'Chauffeur Livreur']
      },
      FLOTTE: {
        label: 'Gestion Flotte',
        postes: ['Responsable Flotte', 'Mécanicien', 'Technicien Moto', 'Agent Entretien']
      },
      LOGISTIQUE: {
        label: 'Entrepôt & 3PL',
        postes: ['Responsable Entrepôt', 'Magasinier', 'Préparateur de Commandes', 'Agent de Quai']
      },
      COMMERCIAL: {
        label: 'Commercial & Client',
        postes: ['Responsable Commercial', 'Chargé de Compte', 'Agent de Relation Client']
      },
    }
  },
};

// Helpers
export function getDepartements(filiale) {
  if (!filiale || !CATALOGUE_RH[filiale]) return [];
  return Object.entries(CATALOGUE_RH[filiale].departements).map(([key, val]) => ({
    key, label: val.label
  }));
}

export function getPostes(filiale, departement) {
  if (!filiale || !departement) return [];
  return CATALOGUE_RH[filiale]?.departements?.[departement]?.postes || [];
}

export const ROLES_LABELS = {
  DG: 'Directeur Général',
  DIRECTEUR: 'Directeur',
  RH: 'Responsable RH',
  COMPTABLE: 'Comptable',
  RESP_FONCIER: 'Responsable Foncier',
  RESP_LIVRAISON: 'Responsable Livraison',
  MANAGER: 'Manager',
  COMMERCIAL: 'Commercial',
  MAGASINIER: 'Magasinier',
  CAISSIER: 'Caissier',
  SERVEUR: 'Serveur',
  BARMAN: 'Barman',
  LIVREUR: 'Livreur',
  EMPLOYE: 'Employé',
};

export const VILLES_CI = [
  'Abidjan','Yamoussoukro','Bouaké','Daloa','San-Pédro','Korhogo','Man','Gagnoa',
  'Abengourou','Agboville','Divo','Soubré','Odienné','Bondoukou','Ferkessédougou',
  'Toumodi','Tiassalé','Grand-Bassam','Assinie','Jacqueville','Bingerville','Sassandra'
];

export const LOCALISATIONS_CI = {
  Abidjan: ['Cocody','Plateau','Adjamé','Yopougon','Abobo','Marcory','Koumassi','Port-Bouët','Treichville','Attécoubé','Bingerville','Anyama','Songon'],
  Yamoussoukro: ['Centre-ville','Dioulakro','Habitat','N\'Gokro','Morofé','Kôkô','Dimbokro'],
  Bouaké: ['Air France','Commerce','Koko','Nimbo','Djébonoua','Brobo'],
  Daloa: ['Centre','Lobia','Bagohouo','Zaïbo'],
  Korhogo: ['Centre','Kasséré','Petit Paris'],
  'San-Pédro': ['Cité des Cadres','Zone Portuaire','Bameya'],
};

export const FILIALES_LABELS = {
  GROUPE: 'Groupe 2iG',
  YAKRO_GRILL: 'Yakro Grill',
  TOPTELSIG: 'TOPTELSIG',
  LIYA: 'LiYA',
};
