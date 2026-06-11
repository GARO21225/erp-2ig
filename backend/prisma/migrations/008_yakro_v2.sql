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
