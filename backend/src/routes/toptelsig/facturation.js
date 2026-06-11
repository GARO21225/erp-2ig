/**
 * TOPTELSIG — Facturation Automatique
 * Génère factures, proformas, reçus, situations clients
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const toptelsig = requireFiliale('TOPTELSIG');

const fmtF = n => n ? n.toLocaleString('fr') + ' F' : '0 F';
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr', { day:'2-digit', month:'long', year:'numeric' }) : '—';

// Générer un numéro unique
async function genNumero(filiale, type) {
  const slug = { FACTURE:'FAC', PROFORMA:'PRF', RECU:'REC', SITUATION:'SIT', CONTRAT:'CTR', ATTESTATION:'ATT' }[type] || 'DOC';
  const fil = filiale.slice(0, 3).toUpperCase();
  const annee = new Date().getFullYear();
  // Compter les documents existants + 1 (simple, idempotent)
  const count = await prisma.documentGenere.count({ where: { filiale } }).catch(() => 0);
  const num = count + 1;
  return `${slug}-${fil}-${annee}-${String(num).padStart(6, '0')}`;
}

// Charger les paramètres entreprise
async function getParams(filiale) {
  return await prisma.parametresEntreprise.findUnique({ where: { filiale } }).catch(() => null) || {
    nomLegal: filiale === 'TOPTELSIG' ? 'TOPTELSIG Sarl' : filiale,
    adresse: 'Abidjan, Côte d\'Ivoire',
    telephone: '+225 00 00 00 00',
    email: `contact@${filiale.toLowerCase()}.ci`,
    couleurPrimaire: '#1a3f6f',
    couleurSecondaire: '#E87722',
  };
}

// Charger les données complètes d'un lot
async function getLotData(lotId) {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      projet: true,
      vente: {
        include: {
          souscripteur: true,
          echeanciers: { orderBy: { numero: 'asc' } },
          paiements: { orderBy: { createdAt: 'asc' } },
        }
      },
      reservations: { include: { souscripteur: true }, take: 1 }
    }
  });
  return lot;
}

// ── Générateur HTML documents ─────────────────────────────────────────────────
function genHeaderHtml(params, titre, numero, type) {
  const coul = params.couleurPrimaire || '#1a3f6f';
  return `
  <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#1a1a1a;">
    <!-- En-tête -->
    <table style="width:100%;border-bottom:3px solid ${coul};padding-bottom:16px;margin-bottom:20px;">
      <tr>
        <td style="vertical-align:top;width:50%;">
          ${params.logoUrl ? `<img src="${params.logoUrl}" style="max-height:70px;max-width:180px;" alt="Logo"/>` : `<div style="font-size:24px;font-weight:900;color:${coul};">${params.sigle||params.nomLegal}</div>`}
          <div style="font-size:11px;color:#555;margin-top:6px;">
            <div>${params.nomLegal}</div>
            <div>${params.adresse||''}</div>
            <div>${params.telephone||''} ${params.email?'· '+params.email:''}</div>
            ${params.rccm?`<div>RCCM: ${params.rccm}</div>`:''}
            ${params.ifu?`<div>IFU: ${params.ifu}</div>`:''}
          </div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="font-size:22px;font-weight:900;color:${coul};text-transform:uppercase;">${titre}</div>
          <div style="font-size:13px;font-weight:600;color:#555;margin-top:6px;">N° ${numero}</div>
          <div style="font-size:11px;color:#888;margin-top:4px;">Date: ${fmtDate(new Date())}</div>
          ${type === 'PROFORMA' ? `<div style="font-size:11px;background:#FAEEDA;color:#BA7517;padding:4px 10px;border-radius:4px;margin-top:6px;font-weight:600;">DOCUMENT NON COMPTABILISÉ</div>` : ''}
        </td>
      </tr>
    </table>`;
}

function genFooterHtml(params, numero) {
  const coul = params.couleurPrimaire || '#1a3f6f';
  return `
    <div style="margin-top:30px;border-top:1px solid #e8e7e1;padding-top:12px;font-size:10px;color:#888;text-align:center;">
      ${params.nomLegal} ${params.rccm?`· RCCM: ${params.rccm}`:''} ${params.ifu?`· IFU: ${params.ifu}`:''}
      ${params.mentions ? `<div style="margin-top:4px;">${params.mentions}</div>` : ''}
      <div style="margin-top:4px;color:${coul};">${params.siteWeb||''}</div>
    </div>
  </div>`;
}

// ── ROUTE : Générer une facture / proforma / reçu / situation ─────────────────
router.post('/generer', auth, toptelsig, async (req, res) => {
  try {
    const { lotId, type = 'FACTURE', paiementId } = req.body;
    if (!lotId) return res.status(400).json({ error: 'lotId requis' });

    const lot = await getLotData(lotId);
    if (!lot) return res.status(404).json({ error: 'Lot introuvable' });

    const params = await getParams('TOPTELSIG');
    const numero = await genNumero('TOPTELSIG', type);
    const coul = params.couleurPrimaire || '#1a3f6f';

    const vente = lot.vente;
    const client = vente?.souscripteur || lot.reservations?.[0]?.souscripteur;
    const totalPaye = vente?.paiements?.reduce((s, p) => s + p.montant, 0) || 0;
    const restant = vente ? vente.prixVente - totalPaye : 0;
    const pct = vente?.prixVente > 0 ? Math.round(totalPaye / vente.prixVente * 100) : 0;

    let html = '';
    let titre = '';

    if (type === 'FACTURE' || type === 'PROFORMA') {
      titre = type === 'PROFORMA' ? 'FACTURE PROFORMA' : 'FACTURE';
      html = genHeaderHtml(params, titre, numero, type);
      html += `
        <!-- Client + Lot côte à côte -->
        <table style="width:100%;margin-bottom:20px;">
          <tr>
            <td style="width:48%;vertical-align:top;background:#F7F7F5;padding:14px;border-radius:8px;">
              <div style="font-size:11px;font-weight:700;color:${coul};text-transform:uppercase;margin-bottom:8px;">Informations Client</div>
              <div style="font-size:13px;font-weight:700;">${client ? `${client.prenom} ${client.nom}` : 'Non défini'}</div>
              <div style="font-size:11px;color:#555;margin-top:4px;">${client?.telephone||''}</div>
              <div style="font-size:11px;color:#555;">${client?.email||''}</div>
              <div style="font-size:11px;color:#555;">${client?.adresse||''}</div>
            </td>
            <td style="width:4%;"></td>
            <td style="width:48%;vertical-align:top;background:#F7F7F5;padding:14px;border-radius:8px;">
              <div style="font-size:11px;font-weight:700;color:${coul};text-transform:uppercase;margin-bottom:8px;">Informations Lot</div>
              <div style="font-size:13px;font-weight:700;">Lot N° ${lot.numero}${lot.ilot ? ` — Îlot ${lot.ilot}` : ''}</div>
              <div style="font-size:11px;color:#555;margin-top:4px;">Projet: ${lot.projet.nom} (${lot.projet.code})</div>
              <div style="font-size:11px;color:#555;">Superficie: ${(lot.superficie||0).toLocaleString('fr')} m²</div>
              <div style="font-size:11px;color:#555;">Localisation: ${lot.projet.localisation||''}, ${lot.projet.ville||''}</div>
            </td>
          </tr>
        </table>

        <!-- Tableau montants -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <thead>
            <tr style="background:${coul};color:white;">
              <th style="padding:10px 14px;text-align:left;font-size:12px;">Désignation</th>
              <th style="padding:10px 14px;text-align:right;font-size:12px;">Montant (FCFA)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e8e7e1;">
              <td style="padding:10px 14px;font-size:12px;">Lot N° ${lot.numero} — ${lot.projet.nom}<br/><span style="font-size:10px;color:#888;">${(lot.superficie||0).toLocaleString('fr')} m² — ${lot.projet.ville||''}</span></td>
              <td style="padding:10px 14px;text-align:right;font-weight:700;font-size:13px;">${fmtF(vente?.prixVente || lot.prix)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background:#F7F7F5;">
              <td style="padding:10px 14px;font-weight:600;font-size:12px;">Prix total</td>
              <td style="padding:10px 14px;text-align:right;font-weight:700;font-size:14px;color:${coul};">${fmtF(vente?.prixVente || lot.prix)}</td>
            </tr>
            <tr>
              <td style="padding:8px 14px;font-size:12px;color:#27500A;">Montant déjà versé</td>
              <td style="padding:8px 14px;text-align:right;font-weight:600;color:#27500A;">${fmtF(totalPaye)}</td>
            </tr>
            <tr style="background:#FCEBEB;">
              <td style="padding:8px 14px;font-size:12px;font-weight:700;color:#A32D2D;">Reste à payer</td>
              <td style="padding:8px 14px;text-align:right;font-weight:800;color:#A32D2D;font-size:14px;">${fmtF(restant)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Progression -->
        <div style="background:#F7F7F5;padding:12px 16px;border-radius:8px;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:6px;">
            <span>Progression du paiement</span><span style="font-weight:700;color:${coul};">${pct}%</span>
          </div>
          <div style="height:8px;background:#e8e7e1;border-radius:4px;">
            <div style="height:100%;width:${pct}%;background:${coul};border-radius:4px;"></div>
          </div>
        </div>

        <!-- Modes de paiement acceptés -->
        <div style="font-size:11px;color:#888;margin-bottom:20px;">
          <strong>Modes de paiement acceptés:</strong> Espèces · Orange Money · MTN Money · Moov Money · Wave · Virement bancaire · Chèque
        </div>

        <!-- Signature -->
        <table style="width:100%;margin-top:30px;">
          <tr>
            <td style="width:50%;font-size:11px;color:#555;">
              <div style="font-weight:600;">Le Client</div>
              <div style="border-top:1px solid #888;margin-top:40px;padding-top:4px;">${client ? `${client.prenom} ${client.nom}` : 'Signature'}</div>
            </td>
            <td style="width:50%;text-align:right;font-size:11px;color:#555;">
              <div style="font-weight:600;">Pour ${params.nomLegal}</div>
              <div style="border-top:1px solid #888;margin-top:40px;padding-top:4px;">Le Directeur Général</div>
            </td>
          </tr>
        </table>`;
      html += genFooterHtml(params, numero);

    } else if (type === 'RECU') {
      // Reçu d'un paiement spécifique
      const pmt = paiementId ? vente?.paiements?.find(p => p.id === paiementId) : vente?.paiements?.[vente.paiements.length - 1];
      titre = 'REÇU DE PAIEMENT';
      html = genHeaderHtml(params, titre, numero, type);
      html += `
        <table style="width:100%;margin-bottom:16px;">
          <tr>
            <td style="background:#F7F7F5;padding:12px;border-radius:8px;width:48%;vertical-align:top;">
              <div style="font-size:11px;font-weight:700;color:${coul};margin-bottom:6px;">CLIENT</div>
              <div style="font-size:13px;font-weight:700;">${client ? `${client.prenom} ${client.nom}` : '—'}</div>
              <div style="font-size:11px;color:#555;">${client?.telephone||''}</div>
            </td>
            <td style="width:4%;"></td>
            <td style="background:#F7F7F5;padding:12px;border-radius:8px;width:48%;vertical-align:top;">
              <div style="font-size:11px;font-weight:700;color:${coul};margin-bottom:6px;">LOT</div>
              <div style="font-size:13px;font-weight:700;">Lot ${lot.numero} — ${lot.projet.nom}</div>
              <div style="font-size:11px;color:#555;">${lot.projet.ville||''}</div>
            </td>
          </tr>
        </table>
        <div style="background:${coul};color:white;padding:20px;border-radius:10px;text-align:center;margin-bottom:20px;">
          <div style="font-size:13px;margin-bottom:6px;">MONTANT ENCAISSÉ</div>
          <div style="font-size:32px;font-weight:900;">${fmtF(pmt?.montant || 0)}</div>
          <div style="font-size:12px;margin-top:8px;opacity:0.85;">
            Mode: ${pmt?.typePaiement?.replace(/_/g,' ')||'—'} · Date: ${fmtDate(pmt?.createdAt||new Date())}
          </div>
        </div>
        <div style="background:#F7F7F5;padding:12px;border-radius:8px;margin-bottom:16px;font-size:12px;">
          <table style="width:100%;">
            <tr><td>Prix total lot:</td><td style="text-align:right;font-weight:600;">${fmtF(vente?.prixVente)}</td></tr>
            <tr><td>Total versé à ce jour:</td><td style="text-align:right;font-weight:600;color:#27500A;">${fmtF(totalPaye)}</td></tr>
            <tr><td style="color:#A32D2D;font-weight:700;">Solde restant:</td><td style="text-align:right;font-weight:800;color:#A32D2D;">${fmtF(restant)}</td></tr>
          </table>
        </div>
        <div style="text-align:right;font-size:11px;color:#555;margin-top:20px;">
          <div>Agent encaisseur</div>
          <div style="border-top:1px solid #888;margin-top:30px;padding-top:4px;">${req.user.prenom} ${req.user.nom}</div>
        </div>`;
      html += genFooterHtml(params, numero);

    } else if (type === 'SITUATION') {
      titre = 'SITUATION CLIENT';
      html = genHeaderHtml(params, titre, numero, type);
      html += `
        <!-- Infos client -->
        <div style="background:#F7F7F5;padding:14px;border-radius:8px;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:${coul};margin-bottom:8px;">INFORMATIONS CLIENT</div>
          <table style="width:100%;font-size:12px;">
            <tr><td style="color:#888;padding:3px 0;">Nom complet</td><td style="font-weight:600;">${client ? `${client.prenom} ${client.nom}` : '—'}</td><td style="color:#888;padding:3px 0;">Téléphone</td><td style="font-weight:600;">${client?.telephone||'—'}</td></tr>
            <tr><td style="color:#888;padding:3px 0;">Statut</td><td><span style="background:${coul}18;color:${coul};padding:2px 8px;border-radius:8px;font-size:10px;font-weight:600;">${client?.statut||'—'}</span></td><td style="color:#888;padding:3px 0;">Commercial</td><td style="font-weight:600;">${client?.commercialNom||'—'}</td></tr>
          </table>
        </div>
        <!-- Infos lot -->
        <div style="background:#EEF3FB;padding:14px;border-radius:8px;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:${coul};margin-bottom:8px;">INFORMATIONS LOT</div>
          <table style="width:100%;font-size:12px;">
            <tr><td style="color:#888;padding:3px 0;">Projet</td><td style="font-weight:600;">${lot.projet.nom}</td><td style="color:#888;padding:3px 0;">Lot N°</td><td style="font-weight:600;">${lot.numero}</td></tr>
            <tr><td style="color:#888;padding:3px 0;">Superficie</td><td style="font-weight:600;">${(lot.superficie||0).toLocaleString('fr')} m²</td><td style="color:#888;padding:3px 0;">Localisation</td><td style="font-weight:600;">${lot.projet.localisation||''}, ${lot.projet.ville||''}</td></tr>
            <tr><td style="color:#888;padding:3px 0;">Prix lot</td><td style="font-weight:700;color:${coul};" colspan="3">${fmtF(vente?.prixVente||lot.prix)}</td></tr>
          </table>
        </div>
        <!-- Situation financière -->
        <div style="background:#F7F7F5;padding:14px;border-radius:8px;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:${coul};margin-bottom:10px;">SITUATION FINANCIÈRE</div>
          <table style="width:100%;font-size:13px;">
            <tr style="border-bottom:1px solid #e8e7e1;">
              <td style="padding:6px 0;">Prix du lot</td>
              <td style="text-align:right;font-weight:700;">${fmtF(vente?.prixVente||lot.prix)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e8e7e1;color:#27500A;">
              <td style="padding:6px 0;">Montant versé (${pct}%)</td>
              <td style="text-align:right;font-weight:700;">${fmtF(totalPaye)}</td>
            </tr>
            <tr style="color:#A32D2D;font-weight:700;">
              <td style="padding:6px 0;">Solde restant</td>
              <td style="text-align:right;font-size:16px;">${fmtF(restant)}</td>
            </tr>
          </table>
          <div style="margin-top:10px;height:10px;background:#e8e7e1;border-radius:5px;">
            <div style="height:100%;width:${pct}%;background:${coul};border-radius:5px;"></div>
          </div>
          <div style="text-align:right;font-size:10px;color:#888;margin-top:3px;">${pct}% payé</div>
        </div>
        <!-- Historique paiements -->
        ${vente?.paiements?.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:${coul};margin-bottom:8px;">HISTORIQUE DES PAIEMENTS (${vente.paiements.length})</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead><tr style="background:${coul};color:white;">
              <th style="padding:7px 10px;text-align:left;">#</th>
              <th style="padding:7px 10px;text-align:left;">Date</th>
              <th style="padding:7px 10px;text-align:left;">Mode</th>
              <th style="padding:7px 10px;text-align:right;">Montant</th>
            </tr></thead>
            <tbody>
              ${vente.paiements.map((p,i) => `
              <tr style="border-bottom:1px solid #e8e7e1;${i%2===0?'background:#FAFAF8':''}">
                <td style="padding:6px 10px;">${i+1}</td>
                <td style="padding:6px 10px;">${fmtDate(p.createdAt)}</td>
                <td style="padding:6px 10px;">${p.typePaiement?.replace(/_/g,' ')||'—'}</td>
                <td style="padding:6px 10px;text-align:right;font-weight:600;">${fmtF(p.montant)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}
        <!-- Échéancier -->
        ${vente?.echeanciers?.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:${coul};margin-bottom:8px;">ÉCHÉANCIER (${vente.echeanciers.length} échéances)</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead><tr style="background:${coul};color:white;">
              <th style="padding:7px 10px;text-align:left;">#</th>
              <th style="padding:7px 10px;text-align:left;">Échéance</th>
              <th style="padding:7px 10px;text-align:right;">Attendu</th>
              <th style="padding:7px 10px;text-align:center;">Statut</th>
            </tr></thead>
            <tbody>
              ${vente.echeanciers.map((e,i) => {
                const retard = e.statut === 'RETARD';
                const paye = e.statut === 'PAYE';
                const bg = retard ? '#FDF2F2' : paye ? '#F0F9EA' : i%2===0 ? '#FAFAF8' : 'white';
                return `<tr style="border-bottom:1px solid #e8e7e1;background:${bg};">
                  <td style="padding:6px 10px;">${e.numero}</td>
                  <td style="padding:6px 10px;">${fmtDate(e.dateEcheance)}</td>
                  <td style="padding:6px 10px;text-align:right;font-weight:600;">${fmtF(e.montant)}</td>
                  <td style="padding:6px 10px;text-align:center;font-size:10px;font-weight:600;color:${retard?'#A32D2D':paye?'#27500A':'#BA7517'};">${e.statut}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : ''}`;
      html += genFooterHtml(params, numero);
    }

    // Sauvegarder en BDD
    const doc = await prisma.documentGenere.create({
      data: {
        numero, type, filiale: 'TOPTELSIG',
        projetId: lot.projetId, lotId, venteId: vente?.id, souscripteurId: client?.id,
        paiementId: paiementId || null,
        titre: `${titre} — Lot ${lot.numero} — ${client ? `${client.prenom} ${client.nom}` : 'N/A'}`,
        contenuHtml: html,
        statut: 'GENERE',
        creePar: req.user.id,
        creeParNom: `${req.user.prenom} ${req.user.nom}`,
      }
    }).catch(() => ({ id: null, numero }));

    res.json({ numero, titre, html, id: doc.id });
  } catch (e) {
    console.error('[Facturation]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /historique/:lotId — Historique documents d'un lot ─────────────────
router.get('/historique/:lotId', auth, toptelsig, async (req, res) => {
  try {
    const docs = await prisma.documentGenere.findMany({
      where: { lotId: req.params.lotId },
      orderBy: { createdAt: 'desc' },
      select: { id:true, numero:true, type:true, titre:true, statut:true, creeParNom:true, createdAt:true }
    });
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /params — Paramètres entreprise ─────────────────────────────────────
router.get('/params', auth, async (req, res) => {
  try {
    const { filiale = 'TOPTELSIG' } = req.query;
    const params = await getParams(filiale);
    res.json(params);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /params — Modifier paramètres entreprise ─────────────────────────────
router.put('/params', auth, async (req, res) => {
  try {
    const { filiale = 'TOPTELSIG', ...data } = req.body;
    const params = await prisma.parametresEntreprise.upsert({
      where: { filiale },
      update: { ...data, updatedAt: new Date() },
      create: { filiale, nomLegal: data.nomLegal || filiale, ...data }
    });
    res.json(params);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /document/:id — Récupérer un document généré ──────────────────────────
router.get('/document/:id', auth, async (req, res) => {
  try {
    const doc = await prisma.documentGenere.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
