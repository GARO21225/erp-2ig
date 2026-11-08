ALTER TABLE depenses_yakro ADD COLUMN IF NOT EXISTS "numero" TEXT;
UPDATE depenses_yakro d SET "numero" = 'DEP-' || to_char(s."createdAt", 'YYYY') || '-' || lpad(s.rn::text, 4, '0')
FROM (SELECT id, "createdAt", row_number() OVER (PARTITION BY to_char("createdAt", 'YYYY') ORDER BY "createdAt", id) AS rn FROM depenses_yakro) s
WHERE d.id = s.id AND d."numero" IS NULL;
