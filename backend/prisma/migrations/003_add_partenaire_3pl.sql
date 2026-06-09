-- Migration 003 : Ajout partenaire dans stock_clients_3pl
DO $$
BEGIN
  -- Créer table partenaires si elle n'existe pas
  CREATE TABLE IF NOT EXISTS "partenaires" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "code" TEXT UNIQUE NOT NULL,
    "nom" TEXT NOT NULL,
    "raisonSociale" TEXT,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "adresse" TEXT,
    "typeActivite" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
  );
  
  -- Ajouter colonne partenaireId dans stocks_clients_3pl si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stocks_clients_3pl' AND column_name = 'partenaireId'
  ) THEN
    ALTER TABLE "stocks_clients_3pl" ADD COLUMN "partenaireId" TEXT;
    ALTER TABLE "stocks_clients_3pl" 
      ADD CONSTRAINT "stocks_clients_3pl_partenaireId_fkey"
      FOREIGN KEY ("partenaireId") REFERENCES "partenaires"("id") ON DELETE SET NULL;
    RAISE NOTICE 'Migration 003 : partenaireId ajouté';
  ELSE
    RAISE NOTICE 'Migration 003 : partenaireId existe déjà';
  END IF;
END $$;
