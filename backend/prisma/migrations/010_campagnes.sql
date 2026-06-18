-- Migration 010 : Campagnes multi-canal (promotions, annonces)
-- Conçu scalable : canal et filiale en TEXT libre, pas d'enum à migrer
-- pour ajouter un nouveau canal d'envoi plus tard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'campagnes'
  ) THEN
    CREATE TABLE "campagnes" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "nom" TEXT NOT NULL,
      "filiale" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'PROMOTION',
      "canal" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
      "creePar" TEXT,
      "creeParNom" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    );
    RAISE NOTICE 'Migration 010 : table campagnes créée';
  ELSE
    RAISE NOTICE 'Migration 010 : campagnes existe déjà';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'envois_campagne'
  ) THEN
    CREATE TABLE "envois_campagne" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "campagneId" TEXT NOT NULL,
      "souscripteurId" TEXT,
      "nom" TEXT NOT NULL,
      "telephone" TEXT,
      "email" TEXT,
      "messagePersonnalise" TEXT,
      "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
      "methodeEnvoi" TEXT,
      "dateEnvoi" TIMESTAMP,
      "erreur" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE "envois_campagne"
      ADD CONSTRAINT "envois_campagne_campagneId_fkey"
      FOREIGN KEY ("campagneId") REFERENCES "campagnes"("id") ON DELETE CASCADE;

    CREATE INDEX "envois_campagne_campagneId_idx" ON "envois_campagne"("campagneId");

    RAISE NOTICE 'Migration 010 : table envois_campagne créée';
  ELSE
    RAISE NOTICE 'Migration 010 : envois_campagne existe déjà';
  END IF;
END $$;
