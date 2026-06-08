/**
 * Utilitaires d'export universels — ERP 2IG
 * Excel via xlsx, PDF via jsPDF + autotable
 */
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── EXCEL ───────────────────────────────────────────────────────────────────

/**
 * Exporter un tableau en fichier Excel
 * @param {string} nomFichier - Nom du fichier sans extension
 * @param {string} nomFeuille - Nom de l'onglet
 * @param {string[]} entetes - En-têtes des colonnes
 * @param {Array[]} lignes - Données (tableau de tableaux)
 */
export function exportExcel(nomFichier, nomFeuille, entetes, lignes) {
  const ws = XLSX.utils.aoa_to_sheet([entetes, ...lignes]);

  // Style en-têtes
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1a3f6f' } },
        alignment: { horizontal: 'center' },
      };
    }
  }

  // Largeur auto des colonnes
  ws['!cols'] = entetes.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...lignes.map(row => String(row[i] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nomFeuille);
  XLSX.writeFile(wb, `${nomFichier}_${formatDate(new Date())}.xlsx`);
}

/**
 * Parser un fichier Excel importé
 * @param {File} file - Fichier input
 * @returns {Promise<{entetes: string[], lignes: any[][]}>}
 */
export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (data.length === 0) return reject(new Error('Fichier vide'));
        const entetes = data[0].map(String);
        const lignes = data.slice(1).filter(row => row.some(c => c !== ''));
        resolve({ entetes, lignes });
      } catch (err) {
        reject(new Error('Fichier Excel invalide : ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

/**
 * Exporter un tableau en PDF A4
 * @param {string} titre - Titre du document
 * @param {string} nomFichier - Nom sans extension
 * @param {string[]} entetes - En-têtes
 * @param {Array[]} lignes - Données
 * @param {Object} opts - Options (sous-titre, totaux, orientation)
 */
export function exportPDF(titre, nomFichier, entetes, lignes, opts = {}) {
  const doc = new jsPDF({
    orientation: opts.orientation || 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // En-tête
  doc.setFillColor(26, 63, 111); // --c-2ig-blue
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('2iG', 14, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('ERP Groupe', 28, 13);
  doc.setFontSize(9);
  doc.text(today, pageW - 14, 13, { align: 'right' });

  // Titre
  doc.setTextColor(26, 63, 111);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(titre, 14, 34);

  if (opts.sousTitre) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(opts.sousTitre, 14, 40);
  }

  // Tableau
  const startY = opts.sousTitre ? 46 : 42;

  autoTable(doc, {
    startY,
    head: [entetes],
    body: lignes,
    headStyles: {
      fillColor: [26, 63, 111],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [247, 247, 245] },
    styles: { cellPadding: 3, lineColor: [220, 220, 215], lineWidth: 0.2 },
    margin: { left: 14, right: 14 },
  });

  // Totaux si fournis
  if (opts.totaux) {
    const finalY = doc.lastAutoTable.finalY || startY;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 63, 111);
    doc.text(opts.totaux, pageW - 14, finalY + 10, { align: 'right' });
  }

  // Pied de page
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`ERP Groupe 2IG — Document confidentiel`, 14, 290);
    doc.text(`Page ${i} / ${pages}`, pageW - 14, 290, { align: 'right' });
  }

  doc.save(`${nomFichier}_${formatDate(new Date())}.pdf`);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDate(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function formatMontant(n) {
  return typeof n === 'number' ? n.toLocaleString('fr') + ' F' : n || '—';
}

export function formatDateFR(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

// ─── FONCTIONS SPÉCIALISÉES PAR MODULE ───────────────────────────────────────

export function exportEmployes(employes) {
  const entetes = ['Matricule', 'Nom', 'Prénom', 'Poste', 'Filiale', 'Téléphone', 'Date embauche', 'Salaire base', 'Statut'];
  const lignes = employes.map(e => [
    e.matricule, e.nom, e.prenom, e.poste,
    e.filiale?.replace('_', ' '), e.telephone,
    formatDateFR(e.dateEmbauche),
    formatMontant(e.salaireBase), e.statut
  ]);
  return { entetes, lignes };
}

export function exportLots(lots) {
  const entetes = ['Numéro', 'Îlot', 'Projet', 'Superficie (m²)', 'Prix (FCFA)', 'Statut', 'Souscripteur'];
  const lignes = lots.map(l => [
    l.numero, l.ilot || '—', l.projet?.nom || '—',
    l.superficie, formatMontant(l.prix), l.statut,
    l.vente?.souscripteur ? `${l.vente.souscripteur.prenom} ${l.vente.souscripteur.nom}` : '—'
  ]);
  return { entetes, lignes };
}

export function exportSouscripteurs(souscripteurs) {
  const entetes = ['Code', 'Nom', 'Prénom', 'Téléphone', 'Email', 'Statut', 'Prescripteur'];
  const lignes = souscripteurs.map(s => [
    s.code, s.nom, s.prenom, s.telephone, s.email || '—', s.statut,
    s.prescripteur ? `${s.prescripteur.prenom} ${s.prescripteur.nom}` : '—'
  ]);
  return { entetes, lignes };
}

export function exportLivraisons(livraisons) {
  const entetes = ['N°', 'Client', 'Téléphone', 'Adresse livraison', 'Livreur', 'Moto', 'Montant', 'Statut', 'Date'];
  const lignes = livraisons.map(l => [
    l.numero, l.clientNom, l.clientTel, l.adresseLivraison,
    l.chauffeur ? `${l.chauffeur.prenom} ${l.chauffeur.nom}` : '—',
    l.moto?.immatriculation || '—',
    formatMontant(l.montant), l.statut?.replace('_', ' '),
    formatDateFR(l.createdAt)
  ]);
  return { entetes, lignes };
}

export function exportDepenses(depenses) {
  const entetes = ['Date', 'Projet', 'Catégorie', 'Sous-catégorie', 'Description', 'Bénéficiaire', 'Montant (FCFA)', 'Statut'];
  const lignes = depenses.map(d => [
    formatDateFR(d.date), d.projet?.nom || '—', d.categorie, d.sousCategorie || '—',
    d.description, d.beneficiaire || '—',
    formatMontant(d.montant), d.statut
  ]);
  return { entetes, lignes };
}

export function exportEncaissements(enc) {
  const entetes = ['Date', 'Motif', 'Filiale', 'Type paiement', 'Référence', 'Montant (FCFA)'];
  const lignes = enc.map(e => [
    formatDateFR(e.createdAt), e.motif,
    e.filiale?.replace('_', ' '), e.typePaiement?.replace('_', ' '), e.reference || '—',
    formatMontant(e.montant)
  ]);
  return { entetes, lignes };
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

/**
 * Exporter un tableau en CSV (UTF-8 BOM, séparateur ;, compatible Excel France)
 */
export function exportCSV(nomFichier, entetes, lignes) {
  const BOM = '\uFEFF';
  const sep = ';';
  const escape = (v) => {
    const s = String(v === null || v === undefined ? '' : v);
    return s.includes(sep) || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [entetes.map(escape).join(sep), ...lignes.map(row => row.map(escape).join(sep))];
  const csv = BOM + rows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomFichier}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportPrescripteurs(prescripteurs) {
  const entetes = ['Code', 'Nom', 'Prénom', 'Type', 'Téléphone', 'Email', 'Taux commission', 'Actif'];
  const lignes = prescripteurs.map(p => [
    p.code, p.nom, p.prenom, p.typePersonne,
    p.telephone, p.email || '—',
    p.tauxCommission + '%', p.actif ? 'Oui' : 'Non'
  ]);
  return { entetes, lignes };
}

export function exportPaiementsFoncier(paiements) {
  const entetes = ['Date', 'Souscripteur', 'Lot', 'Projet', 'Montant (FCFA)', 'Type', 'Référence', 'Statut'];
  const lignes = paiements.map(p => [
    formatDateFR(p.createdAt),
    `${p.souscripteur?.prenom || ''} ${p.souscripteur?.nom || ''}`.trim(),
    p.echeancier?.vente?.lot?.numero || '—',
    p.echeancier?.vente?.lot?.projet?.nom || '—',
    formatMontant(p.montant),
    p.typePaiement?.replace(/_/g, ' '), p.reference || '—', p.statut
  ]);
  return { entetes, lignes };
}

export function exportMouvementsStock(mouvements) {
  const entetes = ['Date', 'Produit', 'Référence', 'Filiale', 'Type', 'Quantité', 'Motif', 'Type motif'];
  const lignes = mouvements.map(m => [
    formatDateFR(m.createdAt), m.produit?.nom || '—', m.produit?.reference || '—',
    m.filiale, m.type, m.quantite, m.motif || '—', m.typeMotif || '—'
  ]);
  return { entetes, lignes };
}

// ── TICKET YAKRO GRILL avec logo et formatage restaurant ─────────────────────
export function exportTicketYakro(commande) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 200] }); // Format ticket 80mm
  const w = 80;
  const now = new Date();

  // En-tête rouge Yakro
  doc.setFillColor(139, 26, 26); // #8B1A1A
  doc.rect(0, 0, w, 28, 'F');

  // Texte logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('YAKRO GRILL', w/2, 12, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Restaurant • Yamoussoukro', w/2, 18, { align: 'center' });
  doc.text('Tél: +225 XX XX XX XX XX', w/2, 23, { align: 'center' });

  let y = 34;

  // Infos commande
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`N° ${commande.numero}`, w/2, y, { align: 'center' }); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Table ${commande.table?.numero || 'Emporter'} • ${commande.nbCouverts} couvert(s)`, w/2, y, { align: 'center' }); y += 4;
  doc.text(now.toLocaleString('fr', { dateStyle: 'short', timeStyle: 'short' }), w/2, y, { align: 'center' }); y += 3;

  // Séparateur
  doc.setDrawColor(200);
  doc.line(4, y, w-4, y); y += 5;

  // Articles
  doc.setFontSize(8);
  (commande.lignes || []).forEach(l => {
    const nom = l.menu?.nom || l.nom || `Article`;
    const montant = ((l.prixUnitaire || l.prix || 0) * (l.quantite || 1)).toLocaleString('fr');
    doc.setFont('helvetica', 'bold');
    doc.text(`${l.quantite || 1}×`, 4, y);
    doc.setFont('helvetica', 'normal');
    // Nom tronqué si trop long
    const nomTronc = nom.length > 22 ? nom.slice(0, 22) + '…' : nom;
    doc.text(nomTronc, 14, y);
    doc.text(`${montant} F`, w-4, y, { align: 'right' });
    y += 5;
    if (y > 180) { doc.addPage([80, 200]); y = 10; }
  });

  // Séparateur
  doc.line(4, y, w-4, y); y += 4;

  // Remise si applicable
  if (commande.remise > 0) {
    doc.setFontSize(8);
    doc.text('Remise :', 4, y);
    doc.text(`-${commande.remise.toLocaleString('fr')} F`, w-4, y, { align: 'right' }); y += 5;
  }

  // Total
  doc.setFillColor(139, 26, 26);
  doc.rect(4, y-2, w-8, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 8, y+4);
  doc.text(`${commande.total?.toLocaleString('fr')} F`, w-6, y+4, { align: 'right' });
  y += 12;

  // Pied de page
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Merci de votre visite !', w/2, y, { align: 'center' }); y += 4;
  doc.text('Yakro Grill - Groupe 2iG', w/2, y, { align: 'center' });

  // Ouvrir pour impression navigateur
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => { win.print(); setTimeout(() => URL.revokeObjectURL(url), 2000); };
  } else {
    // Fallback : télécharger
    doc.save(`ticket_${commande.numero}.pdf`);
  }
}
