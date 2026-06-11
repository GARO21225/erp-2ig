-- Migration 007 : Facturation et paramètres entreprise
DO $$
BEGIN
  -- Paramètres entreprise par filiale
  CREATE TABLE IF NOT EXISTS "parametres_entreprise" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "filiale" TEXT UNIQUE NOT NULL,
    "nomLegal" TEXT NOT NULL,
    "sigle" TEXT,
    "slogan" TEXT,
    "adresse" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "siteWeb" TEXT,
    "rccm" TEXT,
    "ifu" TEXT,
    "logoUrl" TEXT,
    "logoSecondaireUrl" TEXT,
    "signatureDgUrl" TEXT,
    "cachetUrl" TEXT,
    "couleurPrimaire" TEXT DEFAULT '#1a3f6f',
    "couleurSecondaire" TEXT DEFAULT '#E87722',
    "couleurTexte" TEXT DEFAULT '#1a1a1a',
    "couleurTableau" TEXT DEFAULT '#EEF3FB',
    "police" TEXT DEFAULT 'DM Sans',
    "enteteHtml" TEXT,
    "piedPageHtml" TEXT,
    "mentions" TEXT,
    "compteurFacture" INTEGER DEFAULT 0,
    "compteurRecu" INTEGER DEFAULT 0,
    "compteurProforma" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
  );

  -- Documents générés (factures, reçus, situations...)
  CREATE TABLE IF NOT EXISTS "documents_generes" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "numero" TEXT UNIQUE NOT NULL,
    "type" TEXT NOT NULL,
    "filiale" TEXT NOT NULL,
    "projetId" TEXT,
    "lotId" TEXT,
    "venteId" TEXT,
    "souscripteurId" TEXT,
    "paiementId" TEXT,
    "titre" TEXT NOT NULL,
    "contenuHtml" TEXT,
    "documentId" TEXT,
    "statut" TEXT DEFAULT 'GENERE',
    "creePar" TEXT NOT NULL,
    "creeParNom" TEXT NOT NULL,
    "version" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
  );

  -- Modèles de documents
  CREATE TABLE IF NOT EXISTS "modeles_documents" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filiale" TEXT,
    "titre" TEXT,
    "contenuHtml" TEXT NOT NULL,
    "variables" TEXT,
    "statut" TEXT DEFAULT 'BROUILLON',
    "orientation" TEXT DEFAULT 'PORTRAIT',
    "avecLogo" BOOLEAN DEFAULT true,
    "avecSignature" BOOLEAN DEFAULT false,
    "avecCachet" BOOLEAN DEFAULT false,
    "avecQrCode" BOOLEAN DEFAULT false,
    "filigrane" TEXT,
    "description" TEXT,
    "creePar" TEXT NOT NULL,
    "creeParNom" TEXT NOT NULL,
    "version" INTEGER DEFAULT 1,
    "publiePar" TEXT,
    "publieLe" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
  );

  -- Insérer paramètres par défaut pour chaque filiale
  INSERT INTO "parametres_entreprise" ("id","filiale","nomLegal","sigle","adresse","telephone","email","couleurPrimaire")
  VALUES
    (gen_random_uuid()::text,'TOPTELSIG','TOPTELSIG Sarl','TOPTELSIG','Abidjan, Côte d''Ivoire','+225 00 00 00 00','contact@toptelsig.ci','#1a3f6f'),
    (gen_random_uuid()::text,'YAKRO_GRILL','Yakro Grill Sarl','YAKRO GRILL','Yamoussoukro, Côte d''Ivoire','+225 00 00 00 00','contact@yakrogrill.ci','#8B1A1A'),
    (gen_random_uuid()::text,'LIYA','LiYA Sarl','LiYA','Abidjan, Côte d''Ivoire','+225 00 00 00 00','contact@liya.ci','#E85D04'),
    (gen_random_uuid()::text,'GROUPE','Groupe 2IG Holding','2IG','Abidjan, Côte d''Ivoire','+225 00 00 00 00','contact@2ig.ci','#1a1a1a')
  ON CONFLICT ("filiale") DO NOTHING;

  RAISE NOTICE 'Migration 007 : Facturation OK';
END $$;
