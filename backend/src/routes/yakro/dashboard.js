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

    // Charges de la période : fixes (salaires, loyer, énergie…) et autres (achats, transport…)
    const parNature = await safe(() => prisma.depenseYakro.groupBy({ by: ['nature'], _sum: { montant: true }, where: { date: { gte: debut, lte: fin }, ...scD(req) } })) || [];
    const chargesFixes = parNature.find(x => x.nature === 'FIXE')?._sum.montant || 0;
    const autresCharges = parNature.find(x => x.nature === 'VARIABLE')?._sum.montant || 0;

    // Vue globale : comparaison restaurant par restaurant
    let parRestaurant;
    if (req.portee === 'TOUS') {
      parRestaurant = await Promise.all(req.restos.map(async (r) => {
        const [ca, tickets, ch] = await Promise.all([
          safe(() => prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: debut, lte: fin }, commande: { restaurantId: r.id } } })),
          safe(() => prisma.commandeYakro.count({ where: { statut: 'PAYEE', createdAt: { gte: debut, lte: fin }, restaurantId: r.id } })),
          safe(() => prisma.depenseYakro.groupBy({ by: ['nature'], _sum: { montant: true }, where: { date: { gte: debut, lte: fin }, restaurantId: r.id } })),
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
        depensesJour: chargesFixes + autresCharges, chargesFixes, autresCharges,
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

module.exports = router;
