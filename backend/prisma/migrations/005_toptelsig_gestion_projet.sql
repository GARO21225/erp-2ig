-- Migration 005 : TOPTELSIG — Gestion de Projet étendue
DO $$
BEGIN

  -- Enrichir projets_fonciers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projets_fonciers' AND column_name='responsableId') THEN
    ALTER TABLE "projets_fonciers"
      ADD COLUMN "responsableId" TEXT,
      ADD COLUMN "responsableNom" TEXT,
      ADD COLUMN "priorite" TEXT DEFAULT 'NORMALE',
      ADD COLUMN "avancement" INTEGER DEFAULT 0,
      ADD COLUMN "datFinReelle" TIMESTAMP,
      ADD COLUMN "caPrevu" FLOAT,
      ADD COLUMN "budgetTotal" FLOAT;
    RAISE NOTICE 'projets_fonciers enrichi';
  END IF;

  -- Phases
  CREATE TABLE IF NOT EXISTS "phases_foncier" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "projetId" TEXT NOT NULL REFERENCES "projets_fonciers"("id") ON DELETE CASCADE,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "dateDebut" TIMESTAMP,
    "dateFin" TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'A_FAIRE',
    "avancement" INTEGER NOT NULL DEFAULT 0,
    "budgetPrevu" FLOAT,
    "responsableId" TEXT,
    "responsableNom" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
  );

  -- Activités
  CREATE TABLE IF NOT EXISTS "activites_foncier" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "phaseId" TEXT NOT NULL REFERENCES "phases_foncier"("id") ON DELETE CASCADE,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "dateDebut" TIMESTAMP,
    "dateFin" TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'A_FAIRE',
    "avancement" INTEGER NOT NULL DEFAULT 0,
    "responsableId" TEXT,
    "responsableNom" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
  );

  -- Tâches
  CREATE TABLE IF NOT EXISTS "taches_foncier" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "activiteId" TEXT NOT NULL REFERENCES "activites_foncier"("id") ON DELETE CASCADE,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "dateEcheance" TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'A_FAIRE',
    "priorite" TEXT NOT NULL DEFAULT 'NORMALE',
    "assigneA" TEXT,
    "assigneNom" TEXT,
    "termine" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
  );

  -- Livrables
  CREATE TABLE IF NOT EXISTS "livrables_foncier" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "phaseId" TEXT NOT NULL REFERENCES "phases_foncier"("id") ON DELETE CASCADE,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "typeLivrable" TEXT NOT NULL DEFAULT 'AUTRE',
    "responsableId" TEXT,
    "responsableNom" TEXT,
    "datePrevue" TIMESTAMP,
    "dateLivraison" TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'A_PRODUIRE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "documentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
  );

  -- Enrichir dépenses foncier
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='depenses_foncier' AND column_name='phaseId') THEN
    ALTER TABLE "depenses_foncier"
      ADD COLUMN "phaseId" TEXT REFERENCES "phases_foncier"("id") ON DELETE SET NULL,
      ADD COLUMN "activiteId" TEXT REFERENCES "activites_foncier"("id") ON DELETE SET NULL,
      ADD COLUMN "budgetPrevu" FLOAT,
      ADD COLUMN "budgetEngage" FLOAT;
    RAISE NOTICE 'depenses_foncier enrichi avec phaseId/activiteId/budget';
  END IF;

  RAISE NOTICE 'Migration 005 : TOPTELSIG Gestion Projet OK';
END $$;
