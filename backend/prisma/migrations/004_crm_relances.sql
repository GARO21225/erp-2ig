-- Migration 004 : CRM commercial TOPTELSIG
DO $$
BEGIN
  -- Créer table relances_crm
  CREATE TABLE IF NOT EXISTS "relances_crm" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "souscripteurId" TEXT NOT NULL REFERENCES "souscripteurs"("id") ON DELETE CASCADE,
    "commercial" TEXT NOT NULL,
    "commercialNom" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'appel',
    "statut" TEXT NOT NULL DEFAULT 'effectuee',
    "notes" TEXT,
    "prochain" TIMESTAMP,
    "dateRelance" TIMESTAMP NOT NULL DEFAULT NOW(),
    "dureeMin" INTEGER,
    "resultat" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
  );

  -- Colonnes CRM dans souscripteurs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='souscripteurs' AND column_name='sourceAcquisition') THEN
    ALTER TABLE "souscripteurs" ADD COLUMN "sourceAcquisition" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='souscripteurs' AND column_name='commercialId') THEN
    ALTER TABLE "souscripteurs" ADD COLUMN "commercialId" TEXT;
    ALTER TABLE "souscripteurs" ADD COLUMN "commercialNom" TEXT;
    ALTER TABLE "souscripteurs" ADD COLUMN "raisonPerte" TEXT;
    ALTER TABLE "souscripteurs" ADD COLUMN "raisonConversion" TEXT;
    ALTER TABLE "souscripteurs" ADD COLUMN "canalConversion" TEXT;
  END IF;

  RAISE NOTICE 'Migration 004 : CRM relances OK';
END $$;
