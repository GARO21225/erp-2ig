-- Migration : renommer produitId → menuId dans lignes_commande_yakro
-- Idempotent : ne fait rien si menuId existe déjà

DO $$
BEGIN
  -- Vérifier si la colonne produitId existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lignes_commande_yakro' 
    AND column_name = 'produitId'
  ) THEN
    -- Supprimer la contrainte FK si elle existe
    ALTER TABLE "lignes_commande_yakro" DROP CONSTRAINT IF EXISTS "lignes_commande_yakro_produitId_fkey";
    -- Renommer la colonne
    ALTER TABLE "lignes_commande_yakro" RENAME COLUMN "produitId" TO "menuId";
    -- Recréer la FK vers menu_yakro
    ALTER TABLE "lignes_commande_yakro" 
      ADD CONSTRAINT "lignes_commande_yakro_menuId_fkey" 
      FOREIGN KEY ("menuId") REFERENCES "menu_yakro"("id") ON DELETE RESTRICT;
    RAISE NOTICE 'Migration 001 : produitId renommé en menuId';
  ELSE
    RAISE NOTICE 'Migration 001 : menuId existe déjà, skip';
  END IF;
END $$;
