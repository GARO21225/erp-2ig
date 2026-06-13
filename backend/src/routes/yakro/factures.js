/**
 * YAKRO GRILL — Factures & Retours Articles
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale, requireRole } = require('../../middleware/auth');
const yakro = requireFiliale('YAKRO_GRILL');

const fmtF = n => n ? Math.round(n).toLocaleString('fr') + ' FCFA' : '0 FCFA';

// Charger les paramètres Yakro Grill
async function getParams() {
  return await prisma.parametresEntreprise.findUnique({ where: { filiale: 'YAKRO_GRILL' } }).catch(() => null) || {
    nomLegal: 'Yakro Grill',
    adresse: 'Yamoussoukro, Côte d\'Ivoire',
    telephone: '+225 00 00 00 00',
    couleurPrimaire: '#8B1A1A',
  };
}

// Numérotation auto
async function genNumeroFacture() {
  const count = await prisma.factureYakro.count().catch(() => 0);
  const annee = new Date().getFullYear();
  return `FAC-YG-${annee}-${String(count + 1).padStart(6, '0')}`;
}

// Générer le HTML de la facture
function genFactureHtml(params, commande, paiements, numero, retours = []) {
  const coul = params.couleurPrimaire || '#8B1A1A';
  const now = new Date();
  // Lire espèces depuis CaisseTransaction (source de vérité)
  const caisseTx = commande.caisseTransaction;
  const especesRecues = caisseTx?.especesRecues || 0;
  const monnaie = caisseTx?.monnaieRendue || 0;

  const modeLabel = { ESPECES:'Espèces', ORANGE_MONEY:'Orange Money', MTN_MONEY:'MTN Money', MOOV_MONEY:'Moov Money', WAVE:'Wave', BANQUE:'Banque/TPE' };

  return `
<div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:16px;color:#1a1a1a;font-size:12px;">
  <!-- En-tête -->
  <div style="text-align:center;border-bottom:2px solid ${coul};padding-bottom:12px;margin-bottom:12px;">
    ${params.logoUrl ? `<img src="${params.logoUrl}" style="max-height:60px;max-width:160px;" alt="Logo"/>` : ''}
    <div style="font-size:20px;font-weight:900;color:${coul};margin-top:4px;">${params.nomLegal || 'YAKRO GRILL'}</div>
    <div style="font-size:11px;color:#555;">${params.adresse || ''}</div>
    <div style="font-size:11px;color:#555;">${params.telephone || ''}</div>
    ${params.email ? `<div style="font-size:11px;color:#555;">${params.email}</div>` : ''}
    ${params.ifu ? `<div style="font-size:10px;color:#888;">IFU: ${params.ifu}</div>` : ''}
  </div>

  <!-- Infos facture -->
  <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:11px;">
    <div>
      <div style="font-weight:700;font-size:14px;color:${coul};">FACTURE</div>
      <div style="color:#888;">N° ${numero}</div>
    </div>
    <div style="text-align:right;">
      <div>${now.toLocaleDateString('fr', { day:'2-digit', month:'2-digit', year:'numeric' })}</div>
      <div>${now.toLocaleTimeString('fr', { hour:'2-digit', minute:'2-digit' })}</div>
    </div>
  </div>

  <!-- Table / Serveur -->
  <div style="background:#F7F7F5;border-radius:6px;padding:8px 10px;margin-bottom:10px;font-size:11px;">
    <div style="display:flex;justify-content:space-between;">
      ${commande.table ? `<span>Table : <strong>${commande.table.numero}</strong></span>` : '<span>À emporter</span>'}
      <span>Couverts : <strong>${commande.nbCouverts || 1}</strong></span>
    </div>
    ${commande.serveurNom ? `<div>Serveur : <strong>${commande.serveurNom}</strong></div>` : ''}
  </div>

  <!-- Détail articles -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px;">
    <thead>
      <tr style="background:${coul};color:white;">
        <th style="padding:5px 8px;text-align:left;">Article</th>
        <th style="padding:5px 8px;text-align:center;">Qté</th>
        <th style="padding:5px 8px;text-align:right;">P.U</th>
        <th style="padding:5px 8px;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${(commande.lignes || []).map((l, i) => {
        // Déduire les retours sur cette ligne
        const retourQte = retours
          .filter(r => r.ligneId === l.id || r.menuId === (l.menuId || l.menu?.id))
          .reduce((s, r) => s + (r.quantite || 0), 0);
        const qteNette = Math.max(0, l.quantite - retourQte);
        if (qteNette === 0) return ''; // Ligne entièrement retournée → ne pas afficher
        return `
      <tr style="${i % 2 === 0 ? 'background:#FAFAF8' : ''}">
        <td style="padding:5px 8px;">${l.menu?.nom || l.menuNom || '—'}${retourQte > 0 ? ` <span style="font-size:9px;color:#BA7517;">(−${retourQte} retour)</span>` : ''}</td>
        <td style="padding:5px 8px;text-align:center;">${qteNette}</td>
        <td style="padding:5px 8px;text-align:right;">${Math.round(l.prixUnitaire).toLocaleString('fr')}</td>
        <td style="padding:5px 8px;text-align:right;font-weight:600;">${Math.round(l.prixUnitaire * qteNette).toLocaleString('fr')}</td>
      </tr>`;
      }).join('')}
      ${retours.length > 0 ? `
      <tr style="background:#FFF8F0;">
        <td colspan="3" style="padding:5px 8px;font-style:italic;color:#BA7517;">Retours articles</td>
        <td style="padding:5px 8px;text-align:right;color:#BA7517;font-weight:600;">-${fmtF(retours.reduce((s,r)=>s+(r.montantDeduit||0),0))}</td>
      </tr>` : ''}
    </tbody>
  </table>

  <!-- Totaux -->
  <div style="border-top:1px solid #e8e7e1;padding-top:8px;margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
      <span>Sous-total</span><span>${fmtF(commande.sousTotal)}</span>
    </div>
    ${commande.remise > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px;color:#A32D2D;"><span>Remise</span><span>-${fmtF(commande.remise)}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;color:${coul};border-top:2px solid ${coul};padding-top:5px;margin-top:5px;">
      <span>TOTAL</span><span>${fmtF(commande.total)}</span>
    </div>
  </div>

  <!-- Paiement -->
  <div style="background:#F0F9EA;border-radius:6px;padding:8px 10px;margin-bottom:12px;font-size:11px;">
    <div style="font-weight:600;margin-bottom:4px;">Paiement</div>
    ${paiements.map(p => `<div style="display:flex;justify-content:space-between;"><span>${modeLabel[p.typePaiement] || p.typePaiement}</span><span style="font-weight:600;">${fmtF(p.montant)}</span></div>`).join('')}
    ${especesRecues > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:4px;"><span>Espèces reçues</span><span>${fmtF(especesRecues)}</span></div>` : ''}
    ${monnaie > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:2px;color:#27500A;font-weight:700;"><span>Monnaie rendue</span><span>${fmtF(monnaie)}</span></div>` : ''}
  </div>

  <!-- Pied de page -->
  <div style="text-align:center;font-size:11px;color:#888;border-top:1px solid #e8e7e1;padding-top:10px;">
    <div style="font-size:13px;font-weight:600;color:${coul};margin-bottom:4px;">Merci pour votre visite !</div>
    <div>${params.siteWeb || ''}</div>
  </div>
</div>`;
}

// ── POST /generer — Générer une facture après encaissement ────────────────────
router.post('/generer', auth, yakro, async (req, res) => {
  try {
    const { commandeId } = req.body;
    if (!commandeId) return res.status(400).json({ error: 'commandeId requis' });

    // Vérifier si facture déjà générée
    const existing = await prisma.factureYakro.findUnique({ where: { commandeId } }).catch(() => null);
    if (existing) return res.json(existing);

    const commande = await prisma.commandeYakro.findUnique({
      where: { id: commandeId },
      include: {
        table: { select: { numero: true } },
        lignes: { include: { menu: { select: { nom: true, categorie: true } } } },
        paiements: true,
        caisseTransaction: true,
      }
    });
    // Charger les retours validés pour cette commande
    let retours = [];
    try {
      retours = await prisma.retourArticleYakro.findMany({
        where: { commandeId }
      });
    } catch {}
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });

    const params = await getParams();
    const numero = await genNumeroFacture();
    const paiementsData = commande.paiements.map(p => ({ typePaiement: p.type, montant: p.montant, reference: p.reference }));
    const html = genFactureHtml(params, commande, paiementsData, numero, retours);

    const facture = await prisma.factureYakro.create({
      data: {
        numero,
        commandeId,
        tableNumero: commande.table?.numero || null,
        serveurNom: commande.serveurNom || null,
        nbCouverts: commande.nbCouverts || 1,
        sousTotal: commande.sousTotal || commande.total || 0,
        remise: commande.remise || 0,
        total: commande.total || 0,
        paiements: JSON.stringify(paiementsData),
        contenuHtml: html,
        creePar: req.user.id,
        creeParNom: `${req.user.prenom} ${req.user.nom}`,
      }
    });

    res.status(201).json(facture);
  } catch (e) {
    console.error('[Factures Yakro]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /:id — Récupérer une facture ─────────────────────────────────────────
router.get('/:id', auth, yakro, async (req, res) => {
  try {
    const f = await prisma.factureYakro.findUnique({ where: { id: req.params.id } });
    if (!f) return res.status(404).json({ error: 'Facture introuvable' });
    res.json(f);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET / — Liste des factures ────────────────────────────────────────────────
router.get('/', auth, yakro, async (req, res) => {
  try {
    const { dateDebut, limit = 100 } = req.query;
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const where = { createdAt: { gte: dateDebut ? new Date(dateDebut) : auj } };
    const factures = await prisma.factureYakro.findMany({
      where, orderBy: { createdAt: 'desc' }, take: Number(limit),
    });
    res.json(factures);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /retours — Retourner un article ──────────────────────────────────────
router.post('/retours', auth, yakro, async (req, res) => {
  try {
    const { commandeId, ligneId, menuNom, menuId, quantite, prixUnitaire, motif, retourStock = false } = req.body;
    if (!commandeId || !menuNom || !quantite || !prixUnitaire || !motif) {
      return res.status(400).json({ error: 'commandeId, menuNom, quantite, prixUnitaire, motif requis' });
    }

    const montantDeduit = Number(quantite) * Number(prixUnitaire);

    const retour = await prisma.$transaction(async tx => {
      // Créer le retour
      const r = await tx.retourArticleYakro.create({
        data: {
          commandeId, ligneId: ligneId || null,
          menuNom, menuId: menuId || null,
          quantite: Number(quantite), prixUnitaire: Number(prixUnitaire),
          montantDeduit, motif, retourStock,
          employeId: req.user.id, employeNom: `${req.user.prenom} ${req.user.nom}`,
          valide: false, // requiert validation responsable
        }
      });

      // Déduire du total de la commande
      await tx.commandeYakro.update({
        where: { id: commandeId },
        data: { total: { decrement: montantDeduit }, sousTotal: { decrement: montantDeduit } }
      });

      // Retour stock si demandé
      if (retourStock && menuId) {
        const menu = await tx.menuYakro.findUnique({ where: { id: menuId } }).catch(() => null);
        if (menu?.produitStockId) {
          await tx.stock.updateMany({
            where: { produitId: menu.produitStockId, filiale: 'YAKRO_GRILL' },
            data: { quantite: { increment: Number(quantite) } }
          }).catch(() => {});
        }
      }

      return r;
    });

    res.status(201).json(retour);
  } catch (e) {
    console.error('[Retours Yakro]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /retours/:id/valider — Valider un retour (responsable) ─────────────────
router.put('/retours/:id/valider', auth, requireRole('DG', 'DIRECTEUR', 'MANAGER'), async (req, res) => {
  try {
    const r = await prisma.retourArticleYakro.update({
      where: { id: req.params.id },
      data: { valide: true, valideLe: new Date(), responsableId: req.user.id, responsableNom: `${req.user.prenom} ${req.user.nom}` }
    });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /retours/liste — Liste des retours ─────────────────────────────────────
router.get('/retours/liste', auth, yakro, async (req, res) => {
  try {
    const { dateDebut } = req.query;
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const retours = await prisma.retourArticleYakro.findMany({
      where: { createdAt: { gte: dateDebut ? new Date(dateDebut) : auj } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(retours);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
