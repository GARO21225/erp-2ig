/**
 * Middleware de validation générique — ERP 2IG
 * Valide les champs requis, types, plages, et renvoie des erreurs structurées
 */

const validate = (rules) => (req, res, next) => {
  const errors = [];

  for (const [field, opts] of Object.entries(rules)) {
    const val = req.body[field];
    const label = opts.label || field;

    // Requis
    if (opts.required && (val === undefined || val === null || val === '')) {
      errors.push({ field, message: `${label} est obligatoire` });
      continue;
    }
    if (val === undefined || val === null || val === '') continue;

    // Type
    if (opts.type === 'number') {
      const n = Number(val);
      if (isNaN(n)) { errors.push({ field, message: `${label} doit être un nombre` }); continue; }
      if (opts.min !== undefined && n < opts.min) errors.push({ field, message: `${label} doit être ≥ ${opts.min}` });
      if (opts.max !== undefined && n > opts.max) errors.push({ field, message: `${label} doit être ≤ ${opts.max}` });
    }
    if (opts.type === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) errors.push({ field, message: `${label} : email invalide` });
    }
    if (opts.type === 'date') {
      if (isNaN(Date.parse(val))) errors.push({ field, message: `${label} : date invalide` });
    }

    // Enum
    if (opts.enum && !opts.enum.includes(val)) {
      errors.push({ field, message: `${label} doit être : ${opts.enum.join(', ')}` });
    }

    // Longueur
    if (opts.minLen && String(val).length < opts.minLen) {
      errors.push({ field, message: `${label} doit avoir au moins ${opts.minLen} caractères` });
    }
    if (opts.maxLen && String(val).length > opts.maxLen) {
      errors.push({ field, message: `${label} ne peut pas dépasser ${opts.maxLen} caractères` });
    }

    // Custom
    if (opts.custom) {
      const err = opts.custom(val, req.body);
      if (err) errors.push({ field, message: err });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Données invalides', details: errors });
  }
  next();
};

// Validateurs prédéfinis par entité
const VALIDATORS = {
  employe: validate({
    matricule: { required: true, label: 'Matricule', minLen: 2, maxLen: 20 },
    nom: { required: true, label: 'Nom', minLen: 2 },
    prenom: { required: true, label: 'Prénom', minLen: 2 },
    telephone: { required: true, label: 'Téléphone', minLen: 8 },
    poste: { required: true, label: 'Poste' },
    filiale: { required: true, label: 'Filiale', enum: ['YAKRO_GRILL', 'TOPTELSIG', 'LIYA', 'GROUPE'] },
    dateEmbauche: { required: true, label: 'Date d\'embauche', type: 'date' },
    salaireBase: { required: true, label: 'Salaire de base', type: 'number', min: 0 },
  }),

  commande: validate({
    lignes: {
      required: true, label: 'Lignes commande',
      custom: (val) => (!Array.isArray(val) || val.length === 0) ? 'La commande doit avoir au moins un article' : null
    }
  }),

  paiementMixte: validate({
    paiements: {
      required: true, label: 'Paiements',
      custom: (val) => {
        if (!Array.isArray(val) || val.length === 0) return 'Au moins un paiement requis';
        for (const p of val) {
          if (!p.typePaiement) return 'Type de paiement manquant';
          if (!p.montant || Number(p.montant) <= 0) return 'Montant invalide';
          if (p.typePaiement !== 'ESPECES' && !p.reference) return `Référence obligatoire pour ${p.typePaiement}`;
        }
        return null;
      }
    }
  }),

  lot: validate({
    numero: { required: true, label: 'Numéro de lot' },
    superficie: { required: true, label: 'Superficie', type: 'number', min: 1 },
    prix: { required: true, label: 'Prix', type: 'number', min: 1 },
    projetId: { required: true, label: 'Projet' },
  }),

  souscripteur: validate({
    nom: { required: true, label: 'Nom' },
    prenom: { required: true, label: 'Prénom' },
    telephone: { required: true, label: 'Téléphone', minLen: 8 },
  }),

  vente: validate({
    lotId: { required: true, label: 'Lot' },
    souscripteurId: { required: true, label: 'Souscripteur' },
    prixVente: { required: true, label: 'Prix de vente', type: 'number', min: 1 },
    nombreEcheances: { required: true, label: 'Nombre d\'échéances', type: 'number', min: 1, max: 120 },
  }),

  livraison: validate({
    clientNom: { required: true, label: 'Nom client' },
    clientTel: { required: true, label: 'Téléphone client', minLen: 8 },
    adressePrise: { required: true, label: 'Adresse de prise en charge' },
    adresseLivraison: { required: true, label: 'Adresse de livraison' },
    montant: { required: true, label: 'Montant', type: 'number', min: 0 },
  }),

  depense: validate({
    projetId: { required: true, label: 'Projet' },
    categorie: { required: true, label: 'Catégorie' },
    montant: { required: true, label: 'Montant', type: 'number', min: 1 },
    description: { required: true, label: 'Description', minLen: 5 },
  }),
};

module.exports = { validate, VALIDATORS };
