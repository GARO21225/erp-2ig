-- Migration 011 : LiYA professionnalisation —
-- ClientLiYA (clients récurrents sans stock, séparé de Partenaire),
-- modèle expéditeur/destinataire sur Livraison, traçabilité photo +
-- code de certification, file de courses par livreur.
-- Idempotente, additive uniquement (aucune colonne supprimée).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'clients_liya'
  ) THEN
    CREATE TABLE "clients_liya" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "code" TEXT NOT NULL UNIQUE,
      "nom" TEXT NOT NULL,
      "typeClient" TEXT NOT NULL DEFAULT 'ENTREPRISE',
      "telephone" TEXT NOT NULL,
      "email" TEXT,
      "adresse" TEXT,
      "actif" BOOLEAN NOT NULL DEFAULT true,
      "notes" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    );
    RAISE NOTICE 'Migration 011 : table clients_liya créée';
  ELSE
    RAISE NOTICE 'Migration 011 : clients_liya existe déjà';
  END IF;

  -- Colonnes additionnelles sur livraisons — chacune ajoutée seulement
  -- si elle n'existe pas déjà, pour pouvoir rejouer cette migration sans risque.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='ordreFile') THEN
    ALTER TABLE "livraisons" ADD COLUMN "ordreFile" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='expediteurPartenaireId') THEN
    ALTER TABLE "livraisons" ADD COLUMN "expediteurPartenaireId" TEXT REFERENCES "partenaires"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='expediteurClientId') THEN
    ALTER TABLE "livraisons" ADD COLUMN "expediteurClientId" TEXT REFERENCES "clients_liya"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='expediteurNom') THEN
    ALTER TABLE "livraisons" ADD COLUMN "expediteurNom" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='expediteurTel') THEN
    ALTER TABLE "livraisons" ADD COLUMN "expediteurTel" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='destinatairePartenaireId') THEN
    ALTER TABLE "livraisons" ADD COLUMN "destinatairePartenaireId" TEXT REFERENCES "partenaires"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='destinataireClientId') THEN
    ALTER TABLE "livraisons" ADD COLUMN "destinataireClientId" TEXT REFERENCES "clients_liya"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='destinataireNom') THEN
    ALTER TABLE "livraisons" ADD COLUMN "destinataireNom" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='destinataireTel') THEN
    ALTER TABLE "livraisons" ADD COLUMN "destinataireTel" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='photoPriseEnCharge') THEN
    ALTER TABLE "livraisons" ADD COLUMN "photoPriseEnCharge" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='photoLivraison') THEN
    ALTER TABLE "livraisons" ADD COLUMN "photoLivraison" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='codeCertification') THEN
    ALTER TABLE "livraisons" ADD COLUMN "codeCertification" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='livraisons' AND column_name='codeVerifieLe') THEN
    ALTER TABLE "livraisons" ADD COLUMN "codeVerifieLe" TIMESTAMP;
  END IF;

  CREATE INDEX IF NOT EXISTS "livraisons_ordreFile_idx" ON "livraisons"("chauffeurId", "ordreFile");

  RAISE NOTICE 'Migration 011 : colonnes livraisons enrichies (expéditeur/destinataire/photos/code/file)';
END $$;
