-- ERP 2IG — Script d'initialisation PostgreSQL
-- Généré depuis schema.prisma — Juin 2026
-- Usage : psql $DATABASE_URL -f init.sql

-- Enums
CREATE TYPE IF NOT EXISTS "Filiale" AS ENUM ('GROUPE', 'YAKRO_GRILL', 'TOPTELSIG', 'LIYA');
CREATE TYPE IF NOT EXISTS "Role" AS ENUM ('DG','DIRECTEUR','MANAGER','EMPLOYE','COMPTABLE','RH','RESP_FONCIER','RESP_LIVRAISON','COMMERCIAL','MAGASINIER','CAISSIER','SERVEUR','BARMAN','LIVREUR');
CREATE TYPE IF NOT EXISTS "StatutEmploye" AS ENUM ('ACTIF','CONGE','SUSPENDU','DEMISSIONNAIRE','QUITTE');
CREATE TYPE IF NOT EXISTS "TypePaiement" AS ENUM ('ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE');
CREATE TYPE IF NOT EXISTS "StatutPaiement" AS ENUM ('EN_ATTENTE','VALIDE','REJETE','REMBOURSE');

-- Tables
CREATE TABLE IF NOT EXISTS utilisateurs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  "motDePasse" TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT,
  role "Role" NOT NULL DEFAULT 'EMPLOYE',
  filiale "Filiale" NOT NULL,
  avatar TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  "loginAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP,
  "derniereConnexion" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_email ON utilisateurs(email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token TEXT UNIQUE NOT NULL,
  "utilisateurId" TEXT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  ip TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_utilisateur ON sessions("utilisateurId");
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions("expiresAt");

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "utilisateurId" TEXT NOT NULL,
  "utilisateurNom" TEXT NOT NULL,
  filiale "Filiale" NOT NULL DEFAULT 'GROUPE',
  action TEXT NOT NULL,
  entite TEXT NOT NULL,
  "entiteId" TEXT,
  "entiteLabel" TEXT,
  avant JSONB,
  apres JSONB,
  ip TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_filiale ON audit_logs(filiale, "createdAt");
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs("utilisateurId");

CREATE TABLE IF NOT EXISTS scores_sante (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  filiale "Filiale" NOT NULL,
  score FLOAT NOT NULL,
  tresorerie FLOAT NOT NULL,
  ca FLOAT NOT NULL,
  productivite FLOAT NOT NULL,
  stocks FLOAT NOT NULL,
  retards INTEGER NOT NULL,
  impayes INTEGER NOT NULL,
  "calculeLe" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  matricule TEXT UNIQUE NOT NULL,
  "utilisateurId" TEXT UNIQUE REFERENCES utilisateurs(id),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT NOT NULL,
  email TEXT,
  filiale "Filiale" NOT NULL,
  poste TEXT NOT NULL,
  departement TEXT,
  "dateEmbauche" TIMESTAMP NOT NULL,
  "salaireBase" FLOAT NOT NULL,
  statut "StatutEmploye" NOT NULL DEFAULT 'ACTIF',
  photo TEXT,
  adresse TEXT,
  "numeroCni" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "employeId" TEXT NOT NULL REFERENCES employes(id),
  type TEXT NOT NULL,
  "dateDebut" TIMESTAMP NOT NULL,
  "dateFin" TIMESTAMP NOT NULL,
  motif TEXT,
  statut TEXT NOT NULL DEFAULT 'EN_ATTENTE',
  "approuvePar" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rotations_repos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "employeId" TEXT NOT NULL REFERENCES employes(id),
  semaine INTEGER NOT NULL,
  annee INTEGER NOT NULL,
  "jourRepos" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("employeId", semaine, annee)
);

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "employeId" TEXT NOT NULL REFERENCES employes(id),
  periode TEXT NOT NULL,
  note FLOAT NOT NULL,
  commentaire TEXT,
  "evaluateurId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sanctions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "employeId" TEXT NOT NULL REFERENCES employes(id),
  type TEXT NOT NULL,
  motif TEXT NOT NULL,
  "dateEffet" TIMESTAMP NOT NULL,
  decision TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS avances (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "employeId" TEXT NOT NULL REFERENCES employes(id),
  montant FLOAT NOT NULL,
  motif TEXT,
  statut TEXT NOT NULL DEFAULT 'EN_ATTENTE',
  rembourse FLOAT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bonus (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "employeId" TEXT NOT NULL REFERENCES employes(id),
  montant FLOAT NOT NULL,
  motif TEXT NOT NULL,
  mois INTEGER NOT NULL,
  annee INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiches_paie (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "employeId" TEXT NOT NULL REFERENCES employes(id),
  mois INTEGER NOT NULL,
  annee INTEGER NOT NULL,
  "salaireBase" FLOAT NOT NULL,
  primes FLOAT NOT NULL DEFAULT 0,
  "heuresSup" FLOAT NOT NULL DEFAULT 0,
  "avancesDeduit" FLOAT NOT NULL DEFAULT 0,
  "netAPayer" FLOAT NOT NULL,
  paye BOOLEAN NOT NULL DEFAULT false,
  "datePaiement" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caisses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nom TEXT NOT NULL,
  filiale "Filiale" NOT NULL,
  solde FLOAT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encaissements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "caisseId" TEXT NOT NULL REFERENCES caisses(id),
  filiale "Filiale" NOT NULL,
  montant FLOAT NOT NULL,
  "typePaiement" "TypePaiement" NOT NULL,
  reference TEXT,
  motif TEXT NOT NULL,
  "entiteRef" TEXT,
  "entiteType" TEXT,
  "operateurId" TEXT,
  categorie TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decaissements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "caisseId" TEXT NOT NULL REFERENCES caisses(id),
  filiale "Filiale" NOT NULL,
  montant FLOAT NOT NULL,
  "typePaiement" "TypePaiement" NOT NULL,
  reference TEXT,
  motif TEXT NOT NULL,
  categorie TEXT,
  beneficiaire TEXT,
  valide BOOLEAN NOT NULL DEFAULT false,
  "validePar" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  filiale "Filiale" NOT NULL,
  annee INTEGER NOT NULL,
  mois INTEGER,
  categorie TEXT NOT NULL,
  "montantPrevu" FLOAT NOT NULL,
  "montantReel" FLOAT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produits (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reference TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  categorie TEXT NOT NULL,
  unite TEXT NOT NULL DEFAULT 'unité',
  filiale "Filiale" NOT NULL,
  "prixAchat" FLOAT NOT NULL DEFAULT 0,
  "prixVente" FLOAT NOT NULL DEFAULT 0,
  "stockAlert" FLOAT NOT NULL DEFAULT 5,
  actif BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stocks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "produitId" TEXT NOT NULL REFERENCES produits(id),
  filiale "Filiale" NOT NULL,
  quantite FLOAT NOT NULL DEFAULT 0,
  depot TEXT NOT NULL DEFAULT 'Principal',
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("produitId", filiale, depot)
);

CREATE TABLE IF NOT EXISTS mouvements_stock (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "produitId" TEXT NOT NULL REFERENCES produits(id),
  filiale "Filiale" NOT NULL,
  type TEXT NOT NULL,
  quantite FLOAT NOT NULL,
  motif TEXT,
  "typeMotif" TEXT,
  "refDocument" TEXT,
  "operateurId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mvt_stock ON mouvements_stock(filiale, type, "createdAt");

CREATE TABLE IF NOT EXISTS fournisseurs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  filiale "Filiale" NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS achats (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fournisseurId" TEXT NOT NULL REFERENCES fournisseurs(id),
  filiale "Filiale" NOT NULL,
  reference TEXT UNIQUE NOT NULL,
  "dateCommande" TIMESTAMP NOT NULL DEFAULT NOW(),
  "dateReception" TIMESTAMP,
  statut TEXT NOT NULL DEFAULT 'EN_ATTENTE',
  "montantTotal" FLOAT NOT NULL DEFAULT 0,
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lignes_achat (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "achatId" TEXT NOT NULL REFERENCES achats(id),
  "produitId" TEXT NOT NULL REFERENCES produits(id),
  quantite FLOAT NOT NULL,
  "prixUnitaire" FLOAT NOT NULL,
  "quantiteRecue" FLOAT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nom TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  filiale "Filiale" NOT NULL,
  "entiteType" TEXT NOT NULL,
  "entiteId" TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  taille INTEGER,
  "mimeType" TEXT,
  "uploadePar" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- YAKRO GRILL
CREATE TABLE IF NOT EXISTS tables_restaurant (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  numero INTEGER UNIQUE NOT NULL,
  nom TEXT,
  capacite INTEGER NOT NULL DEFAULT 4,
  zone TEXT NOT NULL DEFAULT 'Salle',
  statut TEXT NOT NULL DEFAULT 'LIBRE',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commandes_yakro (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  numero TEXT UNIQUE NOT NULL,
  "tableId" TEXT REFERENCES tables_restaurant(id),
  "serveurId" TEXT,
  type TEXT NOT NULL DEFAULT 'SUR_PLACE',
  statut TEXT NOT NULL DEFAULT 'EN_COURS',
  "nbCouverts" INTEGER NOT NULL DEFAULT 1,
  "sousTotal" FLOAT NOT NULL DEFAULT 0,
  remise FLOAT NOT NULL DEFAULT 0,
  total FLOAT NOT NULL DEFAULT 0,
  notes TEXT,
  "typePaiement" "TypePaiement",
  "payeeLe" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes_yakro(statut, "createdAt");

CREATE TABLE IF NOT EXISTS lignes_commande_yakro (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "commandeId" TEXT NOT NULL REFERENCES commandes_yakro(id),
  "produitId" TEXT NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 1,
  "prixUnitaire" FLOAT NOT NULL,
  notes TEXT,
  statut TEXT NOT NULL DEFAULT 'EN_ATTENTE'
);

CREATE TABLE IF NOT EXISTS paiements_yakro (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "commandeId" TEXT NOT NULL REFERENCES commandes_yakro(id),
  montant FLOAT NOT NULL,
  type "TypePaiement" NOT NULL,
  reference TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caisse_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "commandeId" TEXT UNIQUE REFERENCES commandes_yakro(id),
  "totalCommande" FLOAT NOT NULL,
  "especesRecues" FLOAT NOT NULL DEFAULT 0,
  "monnaieRendue" FLOAT NOT NULL DEFAULT 0,
  "estMixte" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations_yakro (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tableId" TEXT NOT NULL REFERENCES tables_restaurant(id),
  "nomClient" TEXT NOT NULL,
  telephone TEXT NOT NULL,
  "dateHeure" TIMESTAMP NOT NULL,
  "nbPersonnes" INTEGER NOT NULL DEFAULT 2,
  statut TEXT NOT NULL DEFAULT 'CONFIRMEE',
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services_serveurs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "employeId" TEXT NOT NULL REFERENCES employes(id),
  date TIMESTAMP NOT NULL,
  service TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'PLANIFIE',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_yakro (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nom TEXT NOT NULL,
  description TEXT,
  categorie TEXT NOT NULL,
  "sousCategorie" TEXT,
  prix FLOAT NOT NULL,
  "prixMini" FLOAT,
  "prixMaxi" FLOAT,
  disponible BOOLEAN NOT NULL DEFAULT true,
  image TEXT,
  "coutRevient" FLOAT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- TOPTELSIG
CREATE TABLE IF NOT EXISTS projets_fonciers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  localisation TEXT NOT NULL,
  ville TEXT NOT NULL,
  superficie FLOAT NOT NULL,
  "nombreLots" INTEGER NOT NULL,
  "prixLotMin" FLOAT NOT NULL,
  "prixLotMax" FLOAT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'EN_COURS',
  "dateDebut" TIMESTAMP,
  "dateFin" TIMESTAMP,
  description TEXT,
  latitude FLOAT,
  longitude FLOAT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "projetId" TEXT NOT NULL REFERENCES projets_fonciers(id),
  numero TEXT NOT NULL,
  superficie FLOAT NOT NULL,
  prix FLOAT NOT NULL,
  ilot TEXT,
  statut TEXT NOT NULL DEFAULT 'DISPONIBLE',
  latitude FLOAT,
  longitude FLOAT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("projetId", numero)
);

CREATE TABLE IF NOT EXISTS souscripteurs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT NOT NULL,
  email TEXT,
  adresse TEXT,
  profession TEXT,
  "numeroCni" TEXT,
  statut TEXT NOT NULL DEFAULT 'PROSPECT',
  "prescripteurId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescripteurs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT NOT NULL,
  email TEXT,
  "typePersonne" TEXT NOT NULL DEFAULT 'PHYSIQUE',
  "raisonSociale" TEXT,
  "ribOuMobile" TEXT,
  "tauxCommission" FLOAT NOT NULL DEFAULT 3,
  actif BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE souscripteurs ADD CONSTRAINT fk_souscripteur_prescripteur
  FOREIGN KEY ("prescripteurId") REFERENCES prescripteurs(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS reservations_foncier (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "lotId" TEXT NOT NULL REFERENCES lots(id),
  "souscripteurId" TEXT NOT NULL REFERENCES souscripteurs(id),
  "dateReservation" TIMESTAMP NOT NULL DEFAULT NOW(),
  "montantAvance" FLOAT NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS ventes_foncier (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "lotId" TEXT UNIQUE NOT NULL REFERENCES lots(id),
  "souscripteurId" TEXT NOT NULL REFERENCES souscripteurs(id),
  "reservationId" TEXT UNIQUE REFERENCES reservations_foncier(id),
  "prixVente" FLOAT NOT NULL,
  "dateVente" TIMESTAMP NOT NULL DEFAULT NOW(),
  statut TEXT NOT NULL DEFAULT 'EN_COURS',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS echeanciers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venteId" TEXT NOT NULL REFERENCES ventes_foncier(id),
  numero INTEGER NOT NULL,
  montant FLOAT NOT NULL,
  "dateEcheance" TIMESTAMP NOT NULL,
  statut TEXT NOT NULL DEFAULT 'EN_ATTENTE',
  "montantPaye" FLOAT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_echeanciers ON echeanciers(statut, "dateEcheance");

CREATE TABLE IF NOT EXISTS paiements_foncier (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "venteId" TEXT NOT NULL REFERENCES ventes_foncier(id),
  "souscripteurId" TEXT NOT NULL REFERENCES souscripteurs(id),
  "echeancierId" TEXT REFERENCES echeanciers(id),
  montant FLOAT NOT NULL,
  "typePaiement" "TypePaiement" NOT NULL,
  reference TEXT,
  statut "StatutPaiement" NOT NULL DEFAULT 'VALIDE',
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_paiements_vente ON paiements_foncier("venteId");

CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "prescripteurId" TEXT NOT NULL REFERENCES prescripteurs(id),
  "venteId" TEXT NOT NULL REFERENCES ventes_foncier(id),
  montant FLOAT NOT NULL,
  taux FLOAT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'EN_ATTENTE',
  "payeeLe" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS depenses_foncier (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "projetId" TEXT NOT NULL REFERENCES projets_fonciers(id),
  categorie TEXT NOT NULL,
  "sousCategorie" TEXT,
  montant FLOAT NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT NOW(),
  beneficiaire TEXT,
  "typePaiement" "TypePaiement",
  justificatif TEXT,
  statut TEXT NOT NULL DEFAULT 'BROUILLON',
  "valideN1Par" TEXT,
  "valideN1Le" TIMESTAMP,
  "valideFinPar" TEXT,
  "valideFinLe" TIMESTAMP,
  "payePar" TEXT,
  "payeLe" TIMESTAMP,
  "rejetMotif" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents_foncier (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "souscripteurId" TEXT NOT NULL REFERENCES souscripteurs(id),
  type TEXT NOT NULL,
  nom TEXT NOT NULL,
  url TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- LIYA
CREATE TABLE IF NOT EXISTS motos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  immatriculation TEXT UNIQUE NOT NULL,
  marque TEXT NOT NULL,
  modele TEXT,
  annee INTEGER,
  statut TEXT NOT NULL DEFAULT 'DISPONIBLE',
  kilometrage FLOAT NOT NULL DEFAULT 0,
  "dernierePlein" TIMESTAMP,
  "dateExpirationAssurance" TIMESTAMP,
  "dateVisiteTechnique" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS livraisons (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  numero TEXT UNIQUE NOT NULL,
  "motoId" TEXT REFERENCES motos(id),
  "chauffeurId" TEXT REFERENCES employes(id),
  "clientNom" TEXT NOT NULL,
  "clientTel" TEXT NOT NULL,
  "adressePrise" TEXT NOT NULL,
  "adresseLivraison" TEXT NOT NULL,
  "latPrise" FLOAT,
  "lonPrise" FLOAT,
  "latDest" FLOAT,
  "lonDest" FLOAT,
  statut TEXT NOT NULL DEFAULT 'EN_ATTENTE',
  montant FLOAT NOT NULL DEFAULT 0,
  "typePaiement" "TypePaiement",
  paye BOOLEAN NOT NULL DEFAULT false,
  "dateDebut" TIMESTAMP,
  "dateFin" TIMESTAMP,
  distance FLOAT,
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_livraisons ON livraisons(statut, "createdAt");

CREATE TABLE IF NOT EXISTS positions_gps (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "livraisonId" TEXT NOT NULL REFERENCES livraisons(id),
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  vitesse FLOAT,
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenances_motos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "motoId" TEXT NOT NULL REFERENCES motos(id),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  cout FLOAT NOT NULL DEFAULT 0,
  date TIMESTAMP NOT NULL DEFAULT NOW(),
  prestataire TEXT,
  statut TEXT NOT NULL DEFAULT 'PLANIFIE'
);

CREATE TABLE IF NOT EXISTS pleins_carburant (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "motoId" TEXT NOT NULL REFERENCES motos(id),
  litres FLOAT NOT NULL,
  montant FLOAT NOT NULL,
  kilometrage FLOAT NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT NOW(),
  station TEXT
);

CREATE TABLE IF NOT EXISTS stocks_clients_3pl (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "clientNom" TEXT NOT NULL,
  "clientTel" TEXT NOT NULL,
  article TEXT NOT NULL,
  quantite FLOAT NOT NULL,
  unite TEXT NOT NULL DEFAULT 'unité',
  "dateEntree" TIMESTAMP NOT NULL DEFAULT NOW(),
  "dateSortie" TIMESTAMP,
  statut TEXT NOT NULL DEFAULT 'EN_STOCK',
  notes TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Données initiales : 3 caisses (une par filiale)
INSERT INTO caisses (id, nom, filiale, solde) VALUES
  (gen_random_uuid()::text, 'Caisse Yakro Grill', 'YAKRO_GRILL', 0),
  (gen_random_uuid()::text, 'Caisse TOPTELSIG', 'TOPTELSIG', 0),
  (gen_random_uuid()::text, 'Caisse LiYA', 'LIYA', 0),
  (gen_random_uuid()::text, 'Caisse Groupe', 'GROUPE', 0)
ON CONFLICT DO NOTHING;

-- Tables restaurant initiales (12 tables)
INSERT INTO tables_restaurant (numero, capacite, zone) VALUES
  (1,4,'Salle'),(2,4,'Salle'),(3,6,'Salle'),(4,4,'Salle'),
  (5,2,'Salle'),(6,4,'Salle'),(7,8,'Salle'),(8,4,'Terrasse'),
  (9,4,'Terrasse'),(10,6,'Terrasse'),(11,6,'VIP'),(12,8,'VIP')
ON CONFLICT (numero) DO NOTHING;

SELECT 'ERP 2IG — Schéma créé avec succès ✅' AS status,
  (SELECT COUNT(*) FROM caisses) AS caisses,
  (SELECT COUNT(*) FROM tables_restaurant) AS tables;
