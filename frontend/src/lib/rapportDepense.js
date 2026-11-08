import autoTable from 'jspdf-autotable';
import { exportExcel, creerPDF, logoPng } from './export';

const F = (n) => `${Math.round(n || 0).toLocaleString('fr').replace(/[  ]/g, ' ')} F`;
const D = (d) => (d ? new Date(d).toLocaleString('fr', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const STATUTS = { BROUILLON: 'Émise', VALIDEE: 'Validée', REJETEE: 'Rejetée', PAYEE: 'Décaissée', JUSTIFIEE: 'Justifiée', CLOTUREE: 'Clôturée' };

/** Rapport détaillé d'une dépense (PDF) : circuit complet, écart, justificatif. */
export async function rapportDepensePDF(d, recu, restaurant = '') {
  const doc = creerPDF({ unit: 'mm', format: 'a4' });
  const logo = await logoPng();
  const W = doc.internal.pageSize.getWidth();
  // En-tête : logo du restaurant à gauche, titre et date à droite, filet rouge
  if (logo) doc.addImage(logo.data, 'PNG', 14, 8, 50, 50 * logo.h / logo.w);
  doc.setTextColor(139, 26, 26); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Rapport de dépense', W - 14, 14, { align: 'right' });
  doc.setTextColor(110); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(restaurant || 'Yakro Grill', W - 14, 20, { align: 'right' });
  doc.text(`Édité le ${D(new Date())}`, W - 14, 25, { align: 'right' });
  doc.setDrawColor(139, 26, 26); doc.setLineWidth(0.8); doc.line(14, 30, W - 14, 30);
  doc.setTextColor(30); doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(d.description, 14, 40);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(110);
  doc.text(`N° ${d.numero || d.id}   ·   Statut : ${STATUTS[d.statut] || d.statut}`, 14, 46);

  const ecart = d.montantJustifie != null ? d.montant - d.montantJustifie : null;
  autoTable(doc, {
    startY: 52, theme: 'grid', styles: { fontSize: 9, cellPadding: 2 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, fillColor: [247, 245, 240] } },
    body: [
      ['Catégorie / nature', `${d.categorie} — ${d.nature === 'FIXE' ? 'charge fixe' : 'autre charge'}`],
      ['Bénéficiaire', d.beneficiaire || '—'],
      ...(d.periode ? [['Mois du salaire', d.periode]] : []),
      ['Date de la dépense', D(d.date || d.createdAt)],
      ['Montant demandé', F(d.montant)],
      ['Mode de paiement', (d.typePaiement || '—').replace(/_/g, ' ')],
      ['Référence du décaissement', d.reference || '—'],
      ['Montant justifié', d.montantJustifie != null ? F(d.montantJustifie) : '—'],
      ['Écart (décaissé - justifié)', ecart == null ? '—' : ecart === 0 ? 'Aucun' : `${F(ecart)} ${ecart > 0 ? '(non justifié / à restituer)' : '(dépassement)'}`],
      ...(d.notes ? [['Notes', d.notes]] : []),
    ],
  });
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6, theme: 'striped', styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [26, 63, 111] },
    head: [['Étape du circuit', 'Par', 'Date', 'Détail']],
    body: [
      ['1. Émission', d.creeParNom, D(d.createdAt), ''],
      [d.statut === 'REJETEE' ? '2. Rejet (DG)' : '2. Validation (DG)', d.valideParNom || '—', D(d.valideLe), d.motifRejet ? `Motif : ${d.motifRejet}` : ''],
      ['3. Décaissement', d.payeParNom || '—', D(d.payeLe), d.reference ? `Réf. ${d.reference}` : ''],
      ['4. Justification', d.justifieParNom || '—', D(d.justifieLe), d.noteJustification || ''],
      ['5. Clôture', d.clotureParNom || '—', D(d.clotureLe), ''],
    ],
  });
  let y = doc.lastAutoTable.finalY + 8;
  doc.setTextColor(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Justificatif', 14, y); y += 4;
  if (recu?.startsWith('data:image')) {
    try {
      const p = doc.getImageProperties(recu); const maxW = W - 28, maxH = 297 - y - 14;
      const k = Math.min(maxW / p.width, maxH / p.height, 0.35); // taille raisonnable
      doc.addImage(recu, 'JPEG', 14, y, p.width * k, p.height * k);
    } catch { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Justificatif joint (image non intégrable).', 14, y + 4); }
  } else doc.setFont('helvetica', 'normal'), doc.setFontSize(9), doc.text(recu ? 'Justificatif au format PDF — consultable depuis l’application.' : 'Aucun justificatif joint.', 14, y + 4);
  doc.save(`depense_${d.id}.pdf`);
}

/** Rapport détaillé de l'historique des dépenses (Excel, une ligne par dépense avec tout le circuit). */
export function rapportDepensesExcel(liste) {
  exportExcel('rapport_depenses_yakro', 'Dépenses', ['Date', 'N°', 'Catégorie', 'Nature', 'Description', 'Bénéficiaire', 'Montant', 'Statut', 'Mode', 'Référence', 'Montant justifié', 'Écart', 'Émise par', 'Validée/Rejetée par', 'Date validation', 'Motif rejet', 'Décaissée par', 'Date décaissement', 'Justifiée par', 'Date justification', 'Note justification', 'Clôturée par', 'Date clôture'],
    liste.map(d => [new Date(d.date || d.createdAt).toLocaleDateString('fr'), d.numero || '', d.categorie, d.nature === 'FIXE' ? 'Fixe' : 'Autre', d.description, d.beneficiaire || '', d.montant, STATUTS[d.statut] || d.statut, (d.typePaiement || '').replace(/_/g, ' '), d.reference || '', d.montantJustifie ?? '', d.montantJustifie != null ? d.montant - d.montantJustifie : '', d.creeParNom || '', d.valideParNom || '', D(d.valideLe), d.motifRejet || '', d.payeParNom || '', D(d.payeLe), d.justifieParNom || '', D(d.justifieLe), d.noteJustification || '', d.clotureParNom || '', D(d.clotureLe)]));
}
