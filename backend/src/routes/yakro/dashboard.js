/**
 * YAKRO GRILL — Dashboard Exécutif
 */
const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { auth, requireFiliale } = require('../../middleware/auth');
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

router.get('/', auth, yakro, async (req, res) => {
  try {
    const { periode = 'jour' } = req.query;
    const { debut, fin } = getDateRange(periode);
    const { debut: debutHier } = getDateRange('jour');
    const hierDebut = new Date(debutHier); hierDebut.setDate(hierDebut.getDate() - 1);
    const hierFin = new Date(debutHier);

    const where = { createdAt: { gte: debut, lte: fin } };
    const wherePayee = { ...where, statut: 'PAYEE' };

    const safe = async (fn) => { try { return await fn(); } catch { return null; } };
    const [
      caAgg, caHier, nbCommandes, nbAnnulees,
      paiementsParMode, tables,
      lignesVendues,
      caWeek, caMois,
      depenses,
    ] = await Promise.all([
      safe(() => prisma.paiementYakro.aggregate({ _sum: { montant: true }, _count: { id: true }, where: { createdAt: { gte: debut, lte: fin } } })),
      safe(() => prisma.paiementYakro.aggregate({ _sum: { montant: true }, where: { createdAt: { gte: hierDebut, lte: hierFin } } })),
      safe(() => prisma.commandeYakro.count({ where: wherePayee })),
      safe(() => prisma.commandeYakro.count({ where: { ...where, statut: 'ANNULEE' } })),
      safe(() => prisma.paiementYakro.groupBy({ by: ['type'], _sum: { montant: true }, _count: { id: true }, where: { createdAt: { gte: debut } }, orderBy: { _sum: { montant: 'desc' } } })),
      safe(() => prisma.tableRestaurant.findMany({ orderBy: { numero: 'asc' } })),
      prisma.ligneCommandeYakro.findMany({
        where: { commande: { statut: 'PAYEE', ...where } },
        include: { menu: { select: { nom:true, categorie:true, prix:true, coutRevient:true } } },
      }),
      prisma.paiementYakro.aggregate({ _sum:{ montant:true }, where:{ createdAt:{ gte: new Date(new Date().setDate(new Date().getDate()-7)) } } }),
      prisma.paiementYakro.aggregate({ _sum:{ montant:true }, where:{ createdAt:{ gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
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
      where: { statut: { in: ['EN_COURS','CUISINE','PRETE','SERVIE'] }, tableId: { not: null } },
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
      select: { serveurId:true, serveurNom:true, total:true, nbCouverts:true }
    });
    commandesPayees.forEach(c => {
      const key = c.serveurId || 'inconnu';
      if (!serveurStats[key]) serveurStats[key] = { id:key, nom:c.serveurNom||'Inconnu', ca:0, nbCommandes:0, nbClients:0 };
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

    // Courbe CA 7 derniers jours
    const courbe = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
      const fin2 = new Date(d); fin2.setHours(23,59,59);
      const ca = await prisma.paiementYakro.aggregate({ _sum:{ montant:true }, where:{ createdAt:{ gte:d, lte:fin2 } } });
      courbe.push({ label: d.toLocaleDateString('fr', { day:'2-digit', month:'short' }), ca: ca._sum.montant || 0 });
    }

    // Alertes
    const alertes = [];
    if (nbAnnulees > 5) alertes.push({ type:'ANNULATIONS', gravite:'ATTENTION', msg:`${nbAnnulees} annulation(s) aujourd'hui` });
    if (trendCA < -20) alertes.push({ type:'BAISSE_CA', gravite:'ATTENTION', msg:`CA en baisse de ${Math.abs(trendCA)}% vs hier` });

    res.json({
      kpi: {
        caJour, caSemaine: caWeek._sum.montant||0, caMois: caMois._sum.montant||0,
        nbTickets, nbClients, ticketMoyen, margeEstimee, tauxMarge,
        tablesOccupees, tablesLibres: tables.length - tablesOccupees, totalTables: tables.length,
        trendCA, objectifJour: 500000,
        depensesJour: depenses._sum.total || 0,
        resultatEstime: caJour - (depenses._sum.total || 0),
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
