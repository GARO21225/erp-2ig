/**
 * YAKRO GRILL — Dashboard Exécutif
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
const Y = require('../../lib/yakro-resto');
const { resto, sc } = Y;
const yakro = requireFiliale('YAKRO_GRILL');

const CATS_BAR = ['BIERE','VIN','CHAMPAGNE','COCKTAIL_ALCOOLISE','COCKTAIL_SANS_ALCOOL','SUCRERIE','TISANE','BOISSON'];

function getDateRange(periode) {
  const now = new Date();
  let debut, fin = new Date();
  switch(periode) {
    case 'semaine':
      debut = new Date(now); debut.setDate(now.getDate() - 7); debut.setHours(0,0,0,0); break;
    case 'mois':
      debut = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'annee':
      debut = new Date(now.getFullYear(), 0, 1); break;
    default: // jour
      debut = new Date(now); debut.setHours(0,0,0,0);
  }
  return { debut, fin };
}

// Portée : ?portee=TOUS → tous les restaurants accessibles (vue globale) ; ?portee=<id> → un restaurant ; sinon restaurant courant
const portee = async (req, res, next) => {
  try {
    const p = req.query.portee;
    if (p === 'TOUS') {
      const liste = await Y.accesDe(req.user);
      if (!liste.length) return res.status(403).json({ error: "Aucun restaurant ne vous est affecté" });
      req.restaurantId = null; req.portee = 'TOUS'; req.restos = liste.map(a => a.restaurant);
      req.scopeIds = req.restos.map(r => r.id);
      return next();
    }
    delete req.headers['x-portee']; // la portée de ce tableau de bord vient du paramètre
    if (p) req.headers['x-restaurant-id'] = p;
    return resto(req, res, next);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
// Filtres Prisma selon la portée (un restaurant, ou l'ensemble de ceux accessibles)
const scD = (req) => (req.scopeIds ? { restaurantId: { in: req.scopeIds } } : sc(req));

router.get('/', auth, yakro, portee, async (req, res) => {
  try {
    const { periode = 'jour' } = req.query;
    const { debut, fin } = getDateRange(periode);
    const { debut: debutHier } = getDateRange('jour');
    const hierDebut = new Date(debutHier); hierDebut.setDate(hierDebut.getDate() - 1);
    const hierFin = new Date(debutHier);

    const where = { createdAt: { gte: debut, lte: fin }, ...scD(req) };
    const pc = req.scopeIds ? { commande: { restaurantId: { in: req.scopeIds } } } : req.restaurantId ? { commande: { restaurantId: req.restaurantId } } : {};
    const wherePayee = { ...where, statut: 'PAYEE' };

    const safe = async (fn) => { try { return await fn(); } catch { return null; } };
    const [
      caAgg, caHier, nbCommandes, nbAnnulees,
      paiementsParMode, tables,
      lignesVendues,
      caWeek, caMois,
      depenses,
    ] = await Promise.all([
      safe(() => prisma.paiementYakro.aggregate({ _sum: { montant: true }, _count: { id: true }, where: { createdAt: { gte: debut, lte: fin }, ...pc } })),
      safe(() => prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: hierDebut, lte: hierFin }, ...pc } })),
      safe(() => prisma.commandeYakro.count({ where: wherePayee })),
      safe(() => prisma.commandeYakro.count({ where: { ...where, statut: 'ANNULEE' } })),
      safe(() => prisma.paiementYakro.groupBy({ by: ['type'], _sum: { montant: true }, _count: { id: true }, where: { createdAt: { gte: debut }, ...pc }, orderBy: { _sum: { montant: 'desc' } } })),
      safe(() => prisma.tableRestaurant.findMany({ where: scD(req), orderBy: { numero: 'asc' } })),
      prisma.ligneCommandeYakro.findMany({
        where: { commande: { statut: 'PAYEE', ...where } },
        include: { menu: { select: { nom:true, categorie:true, prix:true, coutRevient:true } } },
      }),
      prisma.paiementYakro.aggregate({ _sum:{ montant:true }, where:{ createdAt:{ gte: new Date(new Date().setDate(new Date().getDate()-7)) }, ...pc } }),
      prisma.paiementYakro.aggregate({ _sum:{ montant:true }, where:{ createdAt:{ gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }, ...pc } }),
      prisma.commandeYakro.aggregate({ _sum:{ total:true }, where:{ statut:'PAYEE', ...where } }),
    ]);

    const caJour = caAgg?._sum?.montant || 0;
    const caHierVal = caHier._sum.montant || 0;
    const nbTickets = nbCommandes;
    const nbClients = await prisma.commandeYakro.aggregate({ _sum:{ nbCouverts:true }, where: wherePayee }).then(r => r._sum.nbCouverts || 0);
    const ticketMoyen = nbTickets > 0 ? Math.round(caJour / nbTickets) : 0;

    // Marge estimée depuis coutRevient
    let totalCout = 0, totalVente = 0;
    lignesVendues.forEach(l => {
      totalVente += l.prixUnitaire * l.quantite;
      if (l.menu?.coutRevient) totalCout += l.menu.coutRevient * l.quantite;
    });
    const margeEstimee = totalVente > 0 ? Math.round(totalVente - totalCout) : Math.round(caJour * 0.35);
    const tauxMarge = totalVente > 0 ? Math.round((totalVente-totalCout)/totalVente*100) : 35;

    // Tables occupées
    const commandesOuvertes = await prisma.commandeYakro.findMany({
      where: { statut: { in: ['EN_COURS','CUISINE','PRETE','SERVIE'] }, tableId: { not: null }, ...scD(req) },
      select: { tableId: true }
    });
    const tablesOccupees = new Set(commandesOuvertes.map(c => c.tableId)).size;

    // Trend vs hier
    const trendCA = caHierVal > 0 ? Math.round((caJour-caHierVal)/caHierVal*100) : 0;

    // Top serveurs
    const serveurStats = {};
    lignesVendues.forEach(l => {
      // On récupère serveurNom via la commande
    });
    const commandesPayees = await prisma.commandeYakro.findMany({
      where: { statut:'PAYEE', ...where },
      select: { serveurId:true, serveurNom:true, restaurantId:true, total:true, nbCouverts:true }
    });
    const nomsResto = new Map((req.restos || (req.restaurant ? [req.restaurant] : [])).map(r => [r.id, r.nom]));
    commandesPayees.forEach(c => {
      const key = `${c.serveurId || 'inconnu'}|${c.restaurantId || ''}`; // un serveur par restaurant
      if (!serveurStats[key]) serveurStats[key] = { id:key, nom:c.serveurNom||'Inconnu', restaurant: nomsResto.get(c.restaurantId) || '', ca:0, nbCommandes:0, nbClients:0 };
      serveurStats[key].ca += c.total || 0;
      serveurStats[key].nbCommandes++;
      serveurStats[key].nbClients += c.nbCouverts || 0;
    });
    const topServeurs = Object.values(serveurStats)
      .map(s => ({ ...s, ticketMoyen: s.nbCommandes > 0 ? Math.round(s.ca/s.nbCommandes) : 0 }))
      .sort((a,b) => b.ca - a.ca)
      .slice(0, 10);

    // Top tables
    const tableStats = {};
    commandesPayees.forEach(c => {});
    const commandesAvecTable = await prisma.commandeYakro.findMany({
      where: { statut:'PAYEE', ...where, tableId: { not: null } },
      include: { table: { select: { numero:true } }, paiements: { select:{ montant:true } } }
    });
    commandesAvecTable.forEach(c => {
      const k = c.tableId;
      if (!tableStats[k]) tableStats[k] = { id:k, numero:c.table?.numero||'?', ca:0, nbClients:0, nbCommandes:0 };
      tableStats[k].ca += c.total || 0;
      tableStats[k].nbClients += c.nbCouverts || 0;
      tableStats[k].nbCommandes++;
    });
    const topTables = Object.values(tableStats).sort((a,b) => b.ca - a.ca).slice(0, 10);

    // Top produits
    const produitStats = {};
    lignesVendues.forEach(l => {
      const k = l.menuId;
      if (!produitStats[k]) produitStats[k] = { id:k, nom:l.menu?.nom||'?', quantite:0, ca:0, cout:0 };
      produitStats[k].quantite += l.quantite;
      produitStats[k].ca += l.prixUnitaire * l.quantite;
      if (l.menu?.coutRevient) produitStats[k].cout += l.menu.coutRevient * l.quantite;
    });
    const topProduits = Object.values(produitStats)
      .map(p => ({ ...p, marge: p.ca > 0 && p.cout > 0 ? Math.round((p.ca-p.cout)/p.ca*100) : null }))
      .sort((a,b) => b.ca - a.ca).slice(0, 20);

    // Courbe du CA adaptée à la période : jour/semaine = 7 derniers jours, mois = jour par jour, année = mois par mois
    const courbe = [];
    const parMois = periode === 'annee';
    const debutCourbe = periode === 'mois' ? new Date(debut) : parMois ? new Date(debut) : (() => { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; })();
    const paiementsCourbe = await prisma.paiementYakro.findMany({ where: { createdAt: { gte: debutCourbe, lte: fin }, ...pc }, select: { montant: true, createdAt: true } });
    const cle = (d) => (parMois ? `${d.getFullYear()}-${d.getMonth()}` : d.toISOString().slice(0, 10));
    const somme = new Map();
    paiementsCourbe.forEach(x => somme.set(cle(x.createdAt), (somme.get(cle(x.createdAt)) || 0) + (x.montant || 0)));
    for (const d = new Date(debutCourbe); d <= fin; parMois ? d.setMonth(d.getMonth() + 1) : d.setDate(d.getDate() + 1)) {
      courbe.push({ label: d.toLocaleDateString('fr', parMois ? { month: 'short' } : { day: '2-digit', month: 'short' }), ca: somme.get(cle(d)) || 0 });
    }

    // Alertes
    const alertes = [];
    const boissons = await safe(() => prisma.produit.findMany({ where: { filiale: 'YAKRO_GRILL', type: 'BOISSON', actif: true }, include: { stocks: true }, omit: { imageData: true } })) || [];
    const totalStock = (p) => p.stocks.reduce((s, x) => s + x.quantite, 0);
    const ruptures = boissons.filter(p => totalStock(p) <= 0).map(p => p.nom);
    const basses = boissons.filter(p => totalStock(p) > 0 && totalStock(p) <= (p.stockMinimum ?? 3)).map(p => `${p.nom} (${totalStock(p)})`);
    if (ruptures.length) alertes.push({ type:'RUPTURE_STOCK', gravite:'CRITIQUE', msg:`Rupture de stock — ${ruptures.length} boisson(s) retirée(s) du POS : ${ruptures.slice(0,6).join(', ')}${ruptures.length>6?'…':''}` });
    if (basses.length) alertes.push({ type:'STOCK_BAS', gravite:'ATTENTION', msg:`Stock critique — ${basses.length} boisson(s) bientôt épuisée(s) : ${basses.slice(0,6).join(', ')}${basses.length>6?'…':''}` });
    if (nbAnnulees > 5) alertes.push({ type:'ANNULATIONS', gravite:'ATTENTION', msg:`${nbAnnulees} annulation(s) aujourd'hui` });
    if (trendCA < -20) alertes.push({ type:'BAISSE_CA', gravite:'ATTENTION', msg:`CA en baisse de ${Math.abs(trendCA)}% vs hier` });

    const pourboires = (await safe(() => prisma.commandeYakro.aggregate({ _sum: { pourboire: true }, where: wherePayee })))?._sum?.pourboire || 0;

    // Charges de la période : fixes (salaires, loyer, énergie…) et autres (achats, transport…)
    const parNature = await safe(() => prisma.depenseYakro.groupBy({ by: ['nature'], _sum: { montant: true }, where: { statut: { not: 'REJETEE' }, date: { gte: debut, lte: fin }, ...scD(req) } })) || [];
    const chargesFixes = parNature.find(x => x.nature === 'FIXE')?._sum.montant || 0;
    const autresCharges = parNature.find(x => x.nature === 'VARIABLE')?._sum.montant || 0;

    // Vue globale : comparaison restaurant par restaurant
    let parRestaurant;
    if (req.portee === 'TOUS') {
      parRestaurant = await Promise.all(req.restos.map(async (r) => {
        const [ca, tickets, ch] = await Promise.all([
          safe(() => prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: debut, lte: fin }, commande: { restaurantId: r.id } } })),
          safe(() => prisma.commandeYakro.count({ where: { statut: 'PAYEE', createdAt: { gte: debut, lte: fin }, restaurantId: r.id } })),
          safe(() => prisma.depenseYakro.groupBy({ by: ['nature'], _sum: { montant: true }, where: { statut: { not: 'REJETEE' }, date: { gte: debut, lte: fin }, restaurantId: r.id } })),
        ]);
        const fixes = (ch || []).find(x => x.nature === 'FIXE')?._sum.montant || 0;
        const autres = (ch || []).find(x => x.nature === 'VARIABLE')?._sum.montant || 0;
        const c = ca?._sum?.montant || 0;
        return { id: r.id, nom: r.nom, ca: c, tickets: tickets || 0, ticketMoyen: tickets ? Math.round(c / tickets) : 0, chargesFixes: fixes, autresCharges: autres, resultat: c - fixes - autres };
      }));
    }

    res.json({
      portee: req.portee || 'UN', parRestaurant,
      kpi: {
        caJour, caSemaine: caWeek._sum.montant||0, caMois: caMois._sum.montant||0,
        nbTickets, nbClients, ticketMoyen, margeEstimee, tauxMarge,
        tablesOccupees, tablesLibres: tables.length - tablesOccupees, totalTables: tables.length,
        trendCA, objectifJour: 500000,
        pourboires, depensesJour: chargesFixes + autresCharges, chargesFixes, autresCharges,
        resultatEstime: caJour - chargesFixes - autresCharges,
      },
      topServeurs, topTables, topProduits,
      paiements: paiementsParMode.map(p => ({ type:p.type, montant:p._sum.montant||0, nb:p._count.id })),
      courbe,
      alertes,
    });
  } catch (e) {
    console.error('[Dashboard Yakro]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Bilan financier : ventes, dépenses, marge, ratios, points d'amélioration ─────────────
const r0 = (n) => Math.round(n || 0);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

router.get('/bilan', auth, yakro, portee, async (req, res) => {
  try {
    // Données financières : DG / Directeur, ou profil avec la permission « rapports.voir » dans le restaurant
    if (!['DG', 'DIRECTEUR'].includes(req.user.role) && !req.permissions?.has('rapports.voir')) return res.status(403).json({ error: 'Accès réservé à la direction et aux profils autorisés aux rapports' });
    const fin = req.query.au ? new Date(`${req.query.au}T23:59:59.999Z`) : new Date();
    const debut = req.query.du ? new Date(`${req.query.du}T00:00:00.000Z`) : new Date(fin.getFullYear(), fin.getMonth(), 1);
    const duree = Math.max(1, fin - debut);
    const precFin = new Date(debut.getTime() - 1), precDebut = new Date(precFin.getTime() - duree);
    const nbJours = Math.max(1, Math.round(duree / 86400000));
    const S = scD(req);
    const pc = req.scopeIds ? { commande: { restaurantId: { in: req.scopeIds } } } : req.restaurantId ? { commande: { restaurantId: req.restaurantId } } : {};

    const [commandes, lignes, paiements, retours, depenses, depPrec, caPrec, pertes, stocks, menus] = await Promise.all([
      prisma.commandeYakro.findMany({ where: { statut: 'PAYEE', createdAt: { gte: debut, lte: fin }, ...S }, select: { id: true, total: true, remise: true, pourboire: true, serveurNom: true, type: true, nbCouverts: true, createdAt: true, restaurantId: true } }),
      prisma.ligneCommandeYakro.findMany({ where: { commande: { statut: 'PAYEE', createdAt: { gte: debut, lte: fin }, ...S } }, select: { quantite: true, prixUnitaire: true, menu: { select: { nom: true, categorie: true, coutRevient: true, produitId: true } } } }),
      prisma.paiementYakro.groupBy({ by: ['type'], _sum: { montant: true }, where: { createdAt: { gte: debut, lte: fin }, ...pc } }),
      prisma.retourArticleYakro.findMany({ where: { createdAt: { gte: debut, lte: fin } }, select: { montantDeduit: true, commandeId: true } }).catch(() => []),
      prisma.depenseYakro.findMany({ where: { statut: { not: 'REJETEE' }, date: { gte: debut, lte: fin }, ...S }, select: { categorie: true, nature: true, montant: true, statut: true, montantJustifie: true, payeLe: true, date: true } }),
      prisma.depenseYakro.aggregate({ _sum: { montant: true }, where: { statut: { not: 'REJETEE' }, date: { gte: precDebut, lte: precFin }, ...S } }),
      prisma.commandeYakro.aggregate({ _sum: { total: true }, where: { statut: 'PAYEE', createdAt: { gte: precDebut, lte: precFin }, ...S } }),
      prisma.mouvementStock.findMany({ where: { filiale: 'YAKRO_GRILL', type: 'PERTE', createdAt: { gte: debut, lte: fin } }, select: { quantite: true, produitId: true } }),
      prisma.stock.findMany({ where: { filiale: 'YAKRO_GRILL' }, select: { quantite: true, produitId: true } }),
      prisma.menuYakro.findMany({ where: { disponible: true }, select: { id: true, nom: true } }),
    ]);
    const produits = await prisma.produit.findMany({ where: { filiale: 'YAKRO_GRILL' }, select: { id: true, nom: true, prixAchat: true } });
    const achat = new Map(produits.map(p => [p.id, p.prixAchat || 0]));

    // Ventes
    const ca = commandes.reduce((t, c) => t + (c.total || 0), 0);
    const remises = commandes.reduce((t, c) => t + (c.remise || 0), 0);
    const pourboires = commandes.reduce((t, c) => t + (c.pourboire || 0), 0);
    const couverts = commandes.reduce((t, c) => t + (c.nbCouverts || 1), 0);
    const montantRetours = retours.reduce((t, x) => t + (x.montantDeduit || 0), 0);
    const parCat = {}, parArt = {};
    let coutConnu = 0, caConnu = 0, caBrutLignes = 0;
    for (const l of lignes) {
      const m = l.menu || {}; const v = l.quantite * l.prixUnitaire; caBrutLignes += v;
      const cat = m.categorie || 'AUTRE';
      const c = (m.coutRevient ?? (m.produitId ? achat.get(m.produitId) : 0)) || 0;
      parCat[cat] = parCat[cat] || { categorie: cat, ca: 0, qte: 0, cout: 0 };
      parCat[cat].ca += v; parCat[cat].qte += l.quantite; parCat[cat].cout += c * l.quantite;
      const k = m.nom || '?'; parArt[k] = parArt[k] || { nom: k, qte: 0, ca: 0 }; parArt[k].qte += l.quantite; parArt[k].ca += v;
      if (c > 0) { coutConnu += c * l.quantite; caConnu += v; }
    }
    const cats = Object.values(parCat).map(c => ({ ...c, ca: r0(c.ca), cout: r0(c.cout), marge: c.cout > 0 ? r0(c.ca - c.cout) : null, bar: CATS_BAR.includes(c.categorie) })).sort((a, b) => b.ca - a.ca);
    const arts = Object.values(parArt).sort((a, b) => b.ca - a.ca);
    const vendus = new Set(Object.keys(parArt));
    const invendus = menus.filter(m => !vendus.has(m.nom)).map(m => m.nom);
    const caBar = cats.filter(c => c.bar).reduce((t, c) => t + c.ca, 0);
    const couvertureCout = pct(caConnu, caBrutLignes);
    const margeBrute = caConnu > 0 ? caConnu - coutConnu : null;
    const tauxMarge = caConnu > 0 ? (caConnu - coutConnu) / caConnu : null;

    const parServeur = {}; const parJour = {}; const parJourSem = [0, 0, 0, 0, 0, 0, 0]; const parHeure = Array(24).fill(0);
    for (const c of commandes) {
      const n = c.serveurNom || '—'; parServeur[n] = parServeur[n] || { nom: n, tickets: 0, ca: 0, pourboires: 0 };
      parServeur[n].tickets++; parServeur[n].ca += c.total || 0; parServeur[n].pourboires += c.pourboire || 0;
      const d = new Date(c.createdAt); const j = d.toISOString().slice(0, 10);
      parJour[j] = (parJour[j] || 0) + (c.total || 0); parJourSem[d.getUTCDay()] += c.total || 0; parHeure[d.getUTCHours()] += c.total || 0;
    }
    const serveurs = Object.values(parServeur).map(x => ({ ...x, ca: r0(x.ca), ticketMoyen: x.tickets ? r0(x.ca / x.tickets) : 0 })).sort((a, b) => b.ca - a.ca);
    const jours = Object.entries(parJour).map(([date, v]) => ({ date, ca: r0(v) })).sort((a, b) => a.date < b.date ? -1 : 1);
    const paie = paiements.map(p => ({ type: p.type, montant: r0(p._sum.montant) })).sort((a, b) => b.montant - a.montant);
    const totalPaie = paie.reduce((t, p) => t + p.montant, 0);

    // Dépenses
    const parCatDep = {}; let fixes = 0, autres = 0, enRetard = 0, nbEnRetard = 0, ecartJustif = 0, nbEcarts = 0, nonJustifie = 0;
    const sept = Date.now() - 7 * 86400000;
    for (const d of depenses) {
      parCatDep[d.categorie] = (parCatDep[d.categorie] || 0) + d.montant;
      if (d.nature === 'FIXE') fixes += d.montant; else autres += d.montant;
      if (d.statut === 'PAYEE') { nonJustifie += d.montant; if (d.payeLe && new Date(d.payeLe).getTime() < sept) { enRetard += d.montant; nbEnRetard++; } }
      if (d.montantJustifie != null && d.montantJustifie !== d.montant) { ecartJustif += d.montant - d.montantJustifie; nbEcarts++; }
    }
    const charges = fixes + autres;
    const depCats = Object.entries(parCatDep).map(([categorie, montant]) => ({ categorie, montant: r0(montant), pct: pct(montant, charges) })).sort((a, b) => b.montant - a.montant);
    const salaires = parCatDep['Salaires'] || 0;
    const parStatut = {}; for (const d of depenses) parStatut[d.statut] = (parStatut[d.statut] || 0) + 1;

    // Stock
    const valeurStock = stocks.reduce((t, x) => t + x.quantite * (achat.get(x.produitId) || 0), 0);
    const valeurPertes = pertes.reduce((t, x) => t + x.quantite * (achat.get(x.produitId) || 0), 0);

    const resultat = ca - charges;
    const caPrecedent = caPrec._sum.total || 0, chargesPrec = depPrec._sum.montant || 0;
    const seuil = tauxMarge && tauxMarge > 0 ? fixes / tauxMarge : null;

    // Points d'amélioration (règles simples, chiffrées)
    const pts = [];
    const add = (niveau, titre, detail) => pts.push({ niveau, titre, detail });
    if (!commandes.length) add('attention', 'Aucune vente sur la période', 'Vérifiez les dates choisies ou que les commandes sont bien encaissées.');
    if (ca > 0 && resultat < 0) add('alerte', 'Résultat négatif', `Les charges (${r0(charges).toLocaleString('fr')} F) dépassent le chiffre d'affaires (${r0(ca).toLocaleString('fr')} F) : déficit de ${r0(-resultat).toLocaleString('fr')} F. Priorité : réduire les charges variables ou augmenter le panier moyen.`);
    else if (ca > 0 && pct(resultat, ca) < 10) add('attention', 'Marge nette faible', `Le résultat ne représente que ${pct(resultat, ca)} % du chiffre d'affaires. Un objectif sain pour un restaurant est de 10 à 15 %.`);
    else if (ca > 0) add('ok', 'Résultat positif', `Résultat de ${r0(resultat).toLocaleString('fr')} F (${pct(resultat, ca)} % du chiffre d'affaires).`);
    if (caPrecedent > 0) { const ev = pct(ca - caPrecedent, caPrecedent) * (ca >= caPrecedent ? 1 : 1); const e = Math.round(((ca - caPrecedent) / caPrecedent) * 1000) / 10;
      if (e <= -10) add('alerte', `Chiffre d'affaires en baisse de ${Math.abs(e)} %`, `Par rapport à la période précédente (${r0(caPrecedent).toLocaleString('fr')} F). Identifier les jours et catégories qui ont reculé, relancer les clients habituels.`);
      else if (e >= 10) add('ok', `Chiffre d'affaires en hausse de ${e} %`, 'Par rapport à la période précédente : consolider ce qui a fonctionné.'); }
    if (ca > 0 && pct(fixes, ca) > 35) add('attention', 'Charges fixes lourdes', `${pct(fixes, ca)} % du chiffre d'affaires (cible : moins de 35 %). Renégocier loyer, énergie, abonnements ou augmenter les volumes.`);
    if (ca > 0 && pct(salaires, ca) > 30) add('attention', 'Masse salariale élevée', `${pct(salaires, ca)} % du chiffre d'affaires (cible : 25 à 30 %). Ajuster les plannings aux heures de forte affluence.`);
    if (tauxMarge != null && couvertureCout >= 50 && tauxMarge < 0.6) add('attention', 'Marge sur matières insuffisante', `Taux de marge de ${Math.round(tauxMarge * 100)} % sur les articles dont le coût est connu (cible : 65 à 70 %). Revoir les prix de vente ou les prix d'achat.`);
    if (ca > 0 && couvertureCout < 80) add('attention', 'Marge brute peu fiable', `Le coût n'est connu que pour ${couvertureCout} % des ventes. Renseignez le prix d'achat des boissons (Stocks) et le coût de revient des plats (Menu) pour piloter la marge.`);
    if (ca > 0 && pct(remises, ca + remises) > 3) add('attention', 'Remises importantes', `${r0(remises).toLocaleString('fr')} F de remises (${pct(remises, ca + remises)} % des ventes brutes). Encadrer qui peut accorder une remise.`);
    if (ca > 0 && pct(montantRetours, ca) > 2) add('attention', "Retours d'articles élevés", `${r0(montantRetours).toLocaleString('fr')} F de retours (${pct(montantRetours, ca)} % du CA). Analyser les motifs : qualité, erreurs de prise de commande.`);
    if (ca > 0 && valeurPertes > 0 && pct(valeurPertes, ca) > 2) add('attention', 'Pertes de stock', `${r0(valeurPertes).toLocaleString('fr')} F de pertes valorisées (${pct(valeurPertes, ca)} % du CA). Contrôler péremption, casse et consommation interne.`);
    if (nbEnRetard > 0) add('alerte', 'Dépenses décaissées non justifiées', `${nbEnRetard} dépense(s), ${r0(enRetard).toLocaleString('fr')} F, décaissée(s) depuis plus de 7 jours sans justificatif. Exiger les pièces avant tout nouveau décaissement.`);
    if (nbEcarts > 0 && Math.abs(ecartJustif) > 0) add('attention', 'Écarts de justification', `${nbEcarts} dépense(s) avec un écart de ${r0(ecartJustif).toLocaleString('fr')} F entre décaissé et justifié. Faire restituer le trop-perçu ou expliquer le dépassement.`);
    if (charges > 0 && pct(parCatDep['Divers'] || 0, charges) > 10) add('attention', "Poste « Divers » trop important", `${pct(parCatDep['Divers'] || 0, charges)} % des charges : classer ces dépenses dans des catégories précises pour mieux les maîtriser.`);
    if (arts.length >= 3 && ca > 0) { const top3 = arts.slice(0, 3).reduce((t, a) => t + a.ca, 0); if (pct(top3, caBrutLignes) > 50) add('attention', 'Forte dépendance à 3 articles', `${pct(top3, caBrutLignes)} % des ventes viennent de ${arts.slice(0, 3).map(a => a.nom).join(', ')}. Ne jamais les mettre en rupture ; développer d'autres best-sellers.`); }
    if (invendus.length) add('attention', 'Articles sans aucune vente', `${invendus.length} article(s) disponible(s) jamais vendu(s) sur la période (ex. ${invendus.slice(0, 4).join(', ')}). Les retirer de la carte, les promouvoir ou revoir leur prix.`);
    const espPart = pct(paie.find(p => p.type === 'ESPECES')?.montant || 0, totalPaie);
    if (totalPaie > 0 && espPart > 80) add('attention', 'Paiements surtout en espèces', `${espPart} % des encaissements en espèces : risque de manquants. Encourager le mobile money (traçable) et rapprocher chaque jour la caisse.`);
    const jMin = jours.length > 2 ? jours.reduce((a, b) => (b.ca < a.ca ? b : a)) : null;
    if (jMin && ca > 0 && jMin.ca < (ca / jours.length) * 0.5) add('ok', 'Jours creux identifiés', `Le ${new Date(jMin.date).toLocaleDateString('fr', { day: '2-digit', month: 'long' })} n'a fait que ${r0(jMin.ca).toLocaleString('fr')} F : envisager une offre ou un événement les jours faibles.`);
    if (seuil && ca > 0) add(ca >= seuil ? 'ok' : 'attention', 'Seuil de rentabilité', `Il faut environ ${r0(seuil).toLocaleString('fr')} F de ventes sur la période pour couvrir les charges fixes ; vous êtes à ${r0(ca).toLocaleString('fr')} F (${pct(ca, seuil)} %).`);

    res.json({
      periode: { du: debut.toISOString().slice(0, 10), au: fin.toISOString().slice(0, 10), nbJours },
      portee: req.portee || 'RESTO',
      ventes: { ca: r0(ca), tickets: commandes.length, ticketMoyen: commandes.length ? r0(ca / commandes.length) : 0, couverts, parCouvert: couverts ? r0(ca / couverts) : 0, caParJour: r0(ca / nbJours), remises: r0(remises), retours: r0(montantRetours), pourboires: r0(pourboires), caBar: r0(caBar), caCuisine: r0(ca - caBar), parCategorie: cats, topArticles: arts.slice(0, 10), flopArticles: arts.slice(-5).reverse(), invendus: invendus.slice(0, 20), serveurs, jours, jourSemaine: parJourSem.map(r0), heures: parHeure.map(r0), paiements: paie },
      depenses: { total: r0(charges), fixes: r0(fixes), autres: r0(autres), salaires: r0(salaires), parCategorie: depCats, parStatut, nonJustifie: r0(nonJustifie), enRetard: r0(enRetard), ecartJustification: r0(ecartJustif) },
      resultat: { net: r0(resultat), tauxNet: pct(resultat, ca), margeBrute: margeBrute == null ? null : r0(margeBrute), tauxMargeBrute: tauxMarge == null ? null : Math.round(tauxMarge * 1000) / 10, couvertureCout, seuilRentabilite: seuil ? r0(seuil) : null, chargesSurCA: pct(charges, ca), fixesSurCA: pct(fixes, ca), salairesSurCA: pct(salaires, ca) },
      comparaison: { caPrecedent: r0(caPrecedent), chargesPrecedentes: r0(chargesPrec), evolutionCA: caPrecedent > 0 ? Math.round(((ca - caPrecedent) / caPrecedent) * 1000) / 10 : null, resultatPrecedent: r0(caPrecedent - chargesPrec) },
      stock: { valeur: r0(valeurStock), pertes: r0(valeurPertes) },
      pointsAmelioration: pts,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
