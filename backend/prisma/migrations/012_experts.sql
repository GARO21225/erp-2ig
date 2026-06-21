-- Migration 012 : Module Experts — répertoire d'experts et missions
-- Intégré depuis une branche de travail parallèle (Claude Code) ;
-- renumérotée de 011 à 012 ici car 011 est déjà utilisée sur main par
-- le modèle expéditeur/destinataire LiYA. Contenu inchangé sinon.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'experts'
  ) THEN
    CREATE TABLE "experts" (
      "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "nom"         TEXT NOT NULL,
      "prenom"      TEXT NOT NULL,
      "specialite"  TEXT NOT NULL DEFAULT 'AUTRE',
      "cabinet"     TEXT,
      "telephone"   TEXT,
      "email"       TEXT,
      "numAgrement" TEXT,
      "tarifJour"   FLOAT,
      "statut"      TEXT NOT NULL DEFAULT 'ACTIF',
      "notes"       TEXT,
      "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMP NOT NULL DEFAULT NOW()
    );
    RAISE NOTICE 'Migration 012 : table experts créée';
  ELSE
    RAISE NOTICE 'Migration 012 : experts existe déjà';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'missions_expert'
  ) THEN
    CREATE TABLE "missions_expert" (
      "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "expertId"    TEXT NOT NULL REFERENCES "experts"("id") ON DELETE CASCADE,
      "titre"       TEXT NOT NULL,
      "projetNom"   TEXT,
      "description" TEXT,
      "dateDebut"   TIMESTAMP,
      "dateFin"     TIMESTAMP,
      "montant"     FLOAT,
      "statut"      TEXT NOT NULL DEFAULT 'EN_ATTENTE',
      "rapport"     TEXT,
      "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMP NOT NULL DEFAULT NOW()
    );
    RAISE NOTICE 'Migration 012 : table missions_expert créée';
  ELSE
    RAISE NOTICE 'Migration 012 : missions_expert existe déjà';
  END IF;
END $$;
