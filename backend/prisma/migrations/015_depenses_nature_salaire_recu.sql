ALTER TABLE depenses_yakro ADD COLUMN IF NOT EXISTS "nature" TEXT NOT NULL DEFAULT 'VARIABLE';
ALTER TABLE depenses_yakro ADD COLUMN IF NOT EXISTS "employeId" TEXT;
ALTER TABLE depenses_yakro ADD COLUMN IF NOT EXISTS "employeNom" TEXT;
ALTER TABLE depenses_yakro ADD COLUMN IF NOT EXISTS "periode" TEXT;
ALTER TABLE depenses_yakro ADD COLUMN IF NOT EXISTS "recu" TEXT;
UPDATE depenses_yakro SET "nature" = 'FIXE' WHERE "nature" = 'VARIABLE' AND "categorie" IN ('Salaires','Loyer','Électricité','Eau','Internet / Téléphone','Assurance');
