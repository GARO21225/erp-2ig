-- Migration 002 : Ajouter les champs de sécurité sur les utilisateurs
DO $$
BEGIN
  -- loginAttempts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='utilisateurs' AND column_name='loginAttempts') THEN
    ALTER TABLE utilisateurs ADD COLUMN "loginAttempts" INTEGER NOT NULL DEFAULT 0;
  END IF;
  -- lockedUntil
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='utilisateurs' AND column_name='lockedUntil') THEN
    ALTER TABLE utilisateurs ADD COLUMN "lockedUntil" TIMESTAMP;
  END IF;
  -- derniereConnexion
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='utilisateurs' AND column_name='derniereConnexion') THEN
    ALTER TABLE utilisateurs ADD COLUMN "derniereConnexion" TIMESTAMP;
  END IF;
  -- initiateurId sur depenses_foncier
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='depenses_foncier' AND column_name='initiateurId') THEN
    ALTER TABLE depenses_foncier ADD COLUMN "initiateurId" TEXT REFERENCES employes(id);
  END IF;
  -- beneficiaireId sur depenses_foncier
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='depenses_foncier' AND column_name='beneficiaireId') THEN
    ALTER TABLE depenses_foncier ADD COLUMN "beneficiaireId" TEXT;
  END IF;
  -- Renommer produitId → menuId dans lignes_commande_yakro (déjà en 001 mais idempotent)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lignes_commande_yakro' AND column_name='produitId') THEN
    ALTER TABLE lignes_commande_yakro DROP CONSTRAINT IF EXISTS "lignes_commande_yakro_produitId_fkey";
    ALTER TABLE lignes_commande_yakro RENAME COLUMN "produitId" TO "menuId";
    ALTER TABLE lignes_commande_yakro ADD CONSTRAINT "lignes_commande_yakro_menuId_fkey"
      FOREIGN KEY ("menuId") REFERENCES menu_yakro(id) ON DELETE RESTRICT;
  END IF;
END $$;
