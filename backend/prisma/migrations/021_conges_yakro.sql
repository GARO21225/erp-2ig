CREATE TABLE IF NOT EXISTS conges_yakro (
  "id" TEXT PRIMARY KEY,
  "numero" TEXT,
  "utilisateurId" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'ANNUEL',
  "dateDebut" TIMESTAMP(3) NOT NULL,
  "dateFin" TIMESTAMP(3) NOT NULL,
  "motif" TEXT,
  "statut" TEXT NOT NULL DEFAULT 'DEMANDE',
  "decidePar" TEXT,
  "decideParNom" TEXT,
  "decideLe" TIMESTAMP(3),
  "motifRefus" TEXT,
  "dateReprise" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS conges_yakro_resto_statut ON conges_yakro ("restaurantId", "statut");
CREATE INDEX IF NOT EXISTS conges_yakro_user ON conges_yakro ("utilisateurId", "createdAt");
