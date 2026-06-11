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
