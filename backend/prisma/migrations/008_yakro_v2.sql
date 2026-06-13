-- Migration 008 : Yakro Grill V2
DO $$
BEGIN
  -- Ajout serveurNom dans commandes_yakro
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commandes_yakro' AND column_name='serveurNom') THEN
    ALTER TABLE "commandes_yakro" ADD COLUMN "serveurNom" TEXT;
    RAISE NOTICE 'serveurNom ajouté dans commandes_yakro';
  END IF;

  -- Table annulations
  CREATE TABLE IF NOT EXISTS "annulations_yakro" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "commandeId" TEXT NOT NULL,
    "ligneId" TEXT,
    "menuNom" TEXT NOT NULL,
    "quantite" INTEGER DEFAULT 1,
    "montant" FLOAT NOT NULL,
    "motif" TEXT NOT NULL,
    "employeId" TEXT,
    "employeNom" TEXT NOT NULL,
    "responsableId" TEXT,
    "responsableNom" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW()
  );

  -- Table remises
  CREATE TABLE IF NOT EXISTS "remises_yakro" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "commandeId" TEXT NOT NULL,
    "montantAvant" FLOAT NOT NULL,
    "montantRemise" FLOAT NOT NULL,
    "montantFinal" FLOAT NOT NULL,
    "motif" TEXT NOT NULL,
    "employeId" TEXT,
    "employeNom" TEXT NOT NULL,
    "responsableId" TEXT,
    "responsableNom" TEXT,
    "valide" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT NOW()
  );

  RAISE NOTICE 'Migration 008 : Yakro Grill V2 OK';
END $$;

-- Enrichissement table_restaurant
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tables_restaurant' AND column_name='serveurId') THEN
    ALTER TABLE "tables_restaurant"
      ADD COLUMN "serveurId" TEXT,
      ADD COLUMN "serveurNom" TEXT,
      ADD COLUMN "heureOuverture" TIMESTAMP;
  END IF;

  CREATE TABLE IF NOT EXISTS "changements_serveur_yakro" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tableId" TEXT NOT NULL,
    "ancienServeurId" TEXT,
    "ancienServeurNom" TEXT,
    "nouveauServeurId" TEXT NOT NULL,
    "nouveauServeurNom" TEXT NOT NULL,
    "changesParId" TEXT NOT NULL,
    "changesParNom" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS "depenses_yakro" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "categorie" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "montant" FLOAT NOT NULL,
    "typePaiement" TEXT,
    "beneficiaire" TEXT,
    "date" TIMESTAMP DEFAULT NOW(),
    "statut" TEXT DEFAULT 'BROUILLON',
    "validePar" TEXT,
    "valideParNom" TEXT,
    "payePar" TEXT,
    "payeParNom" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "creePar" TEXT NOT NULL,
    "creeParNom" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS "sessions_caisse_yakro" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "ouvertPar" TEXT NOT NULL,
    "ouvertParNom" TEXT NOT NULL,
    "ouvertLe" TIMESTAMP DEFAULT NOW(),
    "montantOuverture" FLOAT DEFAULT 0,
    "closPar" TEXT,
    "closParNom" TEXT,
    "closLe" TIMESTAMP,
    "montantTheorique" FLOAT,
    "montantReel" FLOAT,
    "ecart" FLOAT,
    "statut" TEXT DEFAULT 'OUVERTE',
    "notes" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW()
  );
END $$;

-- Seuils stock
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produits' AND column_name='stockMinimum') THEN
    ALTER TABLE "produits"
      ADD COLUMN "stockMinimum" FLOAT DEFAULT 3,
      ADD COLUMN "stockMaximum" FLOAT;
    -- Copier stockAlert vers stockMinimum pour les articles existants
    UPDATE "produits" SET "stockMinimum" = "stockAlert" * 0.5 WHERE "stockMinimum" IS NULL;
    RAISE NOTICE 'Seuils stock ajoutés';
  END IF;
END $$;

-- ContactProjet : statut d'un contact PAR projet
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS "contact_projets" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "souscripteurId" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "statut" TEXT DEFAULT 'PROSPECT',
    "commercialId" TEXT,
    "commercialNom" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    "dateCreation" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("souscripteurId", "projetId")
  );

  CREATE TABLE IF NOT EXISTS "propositions_foncier" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "souscripteurId" TEXT NOT NULL,
    "commercialId" TEXT,
    "commercialNom" TEXT,
    "projetsEnvoyes" TEXT NOT NULL,
    "message" TEXT,
    "statut" TEXT DEFAULT 'BROUILLON',
    "dateEnvoi" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
  );

  -- Tags sur souscripteur
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='souscripteurs' AND column_name='tags') THEN
    ALTER TABLE "souscripteurs" ADD COLUMN "tags" TEXT;
  END IF;

  RAISE NOTICE 'ContactProjet + PropositionFoncier OK';
END $$;

-- Factures Yakro
DO $$
BEGIN
  -- Corriger ContactProjet (table manquante)
  CREATE TABLE IF NOT EXISTS "contact_projets" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "souscripteurId" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "statut" TEXT DEFAULT 'PROSPECT',
    "commercialId" TEXT,
    "commercialNom" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    "dateCreation" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("souscripteurId", "projetId")
  );

  CREATE TABLE IF NOT EXISTS "factures_yakro" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "numero" TEXT UNIQUE NOT NULL,
    "commandeId" TEXT UNIQUE NOT NULL,
    "tableNumero" INTEGER,
    "serveurNom" TEXT,
    "nbCouverts" INTEGER DEFAULT 1,
    "sousTotal" FLOAT DEFAULT 0,
    "remise" FLOAT DEFAULT 0,
    "total" FLOAT DEFAULT 0,
    "paiements" TEXT NOT NULL,
    "especesRecues" FLOAT,
    "monnaieRendue" FLOAT,
    "contenuHtml" TEXT,
    "statut" TEXT DEFAULT 'EMISE',
    "creePar" TEXT NOT NULL,
    "creeParNom" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS "retours_articles_yakro" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "commandeId" TEXT NOT NULL,
    "ligneId" TEXT,
    "menuNom" TEXT NOT NULL,
    "menuId" TEXT,
    "quantite" INTEGER DEFAULT 1,
    "prixUnitaire" FLOAT NOT NULL,
    "montantDeduit" FLOAT NOT NULL,
    "motif" TEXT NOT NULL,
    "retourStock" BOOLEAN DEFAULT false,
    "employeId" TEXT,
    "employeNom" TEXT NOT NULL,
    "responsableId" TEXT,
    "responsableNom" TEXT,
    "valide" BOOLEAN DEFAULT false,
    "valideLe" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW()
  );

  RAISE NOTICE 'Factures et retours Yakro OK';
END $$;

-- Tables Finance (créées normalement par prisma db push mais migration explicite par sécurité)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'caisses') THEN
    CREATE TABLE "caisses" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "nom" TEXT NOT NULL,
      "filiale" TEXT NOT NULL,
      "solde" FLOAT DEFAULT 0,
      "actif" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO "caisses" ("nom","filiale","solde") VALUES
      ('Caisse Principale','YAKRO_GRILL',0),
      ('Caisse TOPTELSIG','TOPTELSIG',0),
      ('Caisse LiYA','LIYA',0);
    RAISE NOTICE 'Table caisses créée';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'encaissements') THEN
    CREATE TABLE "encaissements" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "reference" TEXT UNIQUE,
      "filiale" TEXT NOT NULL,
      "caisseId" TEXT,
      "montant" FLOAT NOT NULL,
      "typePaiement" TEXT DEFAULT 'ESPECES',
      "motif" TEXT,
      "categorie" TEXT DEFAULT 'AUTRE',
      "tiers" TEXT,
      "statut" TEXT DEFAULT 'VALIDE',
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    );
    RAISE NOTICE 'Table encaissements créée';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'decaissements') THEN
    CREATE TABLE "decaissements" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "reference" TEXT UNIQUE,
      "filiale" TEXT NOT NULL,
      "caisseId" TEXT,
      "montant" FLOAT NOT NULL,
      "categorie" TEXT DEFAULT 'AUTRE',
      "motif" TEXT NOT NULL,
      "beneficiaire" TEXT,
      "statut" TEXT DEFAULT 'VALIDE',
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    );
    RAISE NOTICE 'Table decaissements créée';
  END IF;
END $$;

-- Table partenaires LiYA
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partenaires') THEN
    CREATE TABLE "partenaires" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "nom" TEXT NOT NULL,
      "raisonSociale" TEXT,
      "telephone" TEXT NOT NULL,
      "email" TEXT,
      "adresse" TEXT,
      "typeActivite" TEXT,
      "notes" TEXT,
      "actif" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    );
    RAISE NOTICE 'Table partenaires créée';
  END IF;
  
  -- Table stocks_clients_3pl
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stocks_clients_3pl') THEN
    CREATE TABLE "stocks_clients_3pl" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "partenaireId" TEXT,
      "clientNom" TEXT NOT NULL DEFAULT '',
      "clientTel" TEXT,
      "article" TEXT NOT NULL,
      "quantite" FLOAT NOT NULL DEFAULT 1,
      "unite" TEXT DEFAULT 'unité',
      "dateEntree" TIMESTAMP DEFAULT NOW(),
      "dateSortie" TIMESTAMP,
      "statut" TEXT DEFAULT 'EN_STOCK',
      "notes" TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    RAISE NOTICE 'Table stocks_clients_3pl créée';
  END IF;
END $$;
