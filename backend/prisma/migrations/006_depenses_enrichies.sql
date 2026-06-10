-- Migration 006 : Dépenses Foncières enrichies
DO $$
BEGIN
  -- Nouveaux champs montants
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='depenses_foncier' AND column_name='montantPrevu') THEN
    ALTER TABLE "depenses_foncier"
      ADD COLUMN "montantPrevu" FLOAT,
      ADD COLUMN "montantDemande" FLOAT,
      ADD COLUMN "montantPaye" FLOAT,
      ADD COLUMN "observations" TEXT,
      ADD COLUMN "typeBeneficiaire" TEXT,
      ADD COLUMN "dateDemande" TIMESTAMP,
      ADD COLUMN "dateValidation" TIMESTAMP,
      ADD COLUMN "datePaiement" TIMESTAMP;
    RAISE NOTICE 'Migration 006 : champs montants et bénéficiaire ajoutés';
  END IF;

  -- Mettre à jour le statut par défaut si des lignes ont "EN_ATTENTE" → mapper vers DEMANDEE
  -- (compatibilité ascendante — ne rien changer pour les données existantes)
  RAISE NOTICE 'Migration 006 : compatibilité statuts OK';
END $$;
