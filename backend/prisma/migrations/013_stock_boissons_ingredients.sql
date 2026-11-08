-- Stocks Yakro : segmentation Boissons / Ingrédients + image et lien de l'article
ALTER TABLE produits ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'INGREDIENT';
ALTER TABLE produits ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS "lien" TEXT;
UPDATE produits SET "type" = 'BOISSON' WHERE categorie IN ('BOISSONS','ALCOOLS_BAR','BIERES','VINS','SPIRITUEUX') AND "type" = 'INGREDIENT';
