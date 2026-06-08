-- Migration 002 : ajouter initiateurId sur depenses_foncier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'depenses_foncier' AND column_name = 'initiateurId'
  ) THEN
    ALTER TABLE "depenses_foncier" ADD COLUMN "initiateurId" TEXT;
    ALTER TABLE "depenses_foncier"
      ADD CONSTRAINT "depenses_foncier_initiateurId_fkey"
      FOREIGN KEY ("initiateurId") REFERENCES "employes"("id") ON DELETE SET NULL;
    RAISE NOTICE 'Migration 002 : initiateurId ajouté';
  ELSE
    RAISE NOTICE 'Migration 002 : initiateurId existe déjà, skip';
  END IF;
END $$;
