-- Migration 009 : Lignes de livraison multi-partenaires (Stock 3PL)
-- Permet à une livraison de contenir des articles provenant de plusieurs
-- partenaires différents, chacun avec sa propre quantité.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'lignes_livraison_3pl'
  ) THEN
    CREATE TABLE "lignes_livraison_3pl" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "livraisonId" TEXT NOT NULL,
      "partenaireId" TEXT NOT NULL,
      "stockClientId" TEXT,
      "article" TEXT NOT NULL,
      "quantite" DOUBLE PRECISION NOT NULL,
      "unite" TEXT NOT NULL DEFAULT 'unité',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE "lignes_livraison_3pl"
      ADD CONSTRAINT "lignes_livraison_3pl_livraisonId_fkey"
      FOREIGN KEY ("livraisonId") REFERENCES "livraisons"("id") ON DELETE CASCADE;

    ALTER TABLE "lignes_livraison_3pl"
      ADD CONSTRAINT "lignes_livraison_3pl_partenaireId_fkey"
      FOREIGN KEY ("partenaireId") REFERENCES "partenaires"("id");

    CREATE INDEX "lignes_livraison_3pl_livraisonId_idx" ON "lignes_livraison_3pl"("livraisonId");
    CREATE INDEX "lignes_livraison_3pl_partenaireId_idx" ON "lignes_livraison_3pl"("partenaireId");

    RAISE NOTICE 'Migration 009 : table lignes_livraison_3pl créée';
  ELSE
    RAISE NOTICE 'Migration 009 : lignes_livraison_3pl existe déjà';
  END IF;
END $$;
