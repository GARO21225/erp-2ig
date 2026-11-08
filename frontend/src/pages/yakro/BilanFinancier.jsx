import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import autoTable from 'jspdf-autotable';
import { yakroAPI } from '../../lib/api';
import { useYakro } from '../../lib/useYakro';
import { useRestoStore } from '../../store';
import { exportExcel, creerPDF, logoPng } from '../../lib/export';

const F = (n) => `${Math.round(n || 0).toLocaleString('fr')} F`;
const iso = (d) => d.toISOString().slice(0, 10);
const MODES = { ESPECES: 'Espèces', ORANGE_MONEY: 'Orange Money', MTN_MONEY: 'MTN Money', MOOV_MONEY: 'Moov Money', WAVE: 'Wave', BANQUE: 'Banque / TPE' };
const NIV = { alerte: { c: '#A32D2D', bg: '#FCEBEB', l: 'À corriger' }, attention: { c: '#BA7517', bg: '#FAEEDA', l: 'À surveiller' }, ok: { c: '#27500A', bg: '#EAF3DE', l: 'Positif' } };
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const nomCat = (c) => String(c).replace(/_/g, ' ');

function periodes() {
  const n = new Date(), a = n.getFullYear(), m = n.getMonth();
  const lundi = new Date(n); lundi.setDate(n.getDate() - ((n.getDay() + 6) % 7));
  return [
    ['Ce mois', iso(new Date(Date.UTC(a, m, 1))), iso(n)],
    ['Mois dernier', iso(new Date(Date.UTC(a, m - 1, 1))), iso(new Date(Date.UTC(a, m, 0)))],
    ['Cette semaine', iso(lundi), iso(n)],
    ['30 derniers jours', iso(new Date(Date.now() - 29 * 86400000)), iso(n)],
    ['Cette année', iso(new Date(Date.UTC(a, 0, 1))), iso(n)],
  ];
}

async function pdf(d, nom) {
  const doc = creerPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const logo = await logoPng();
  if (logo) doc.addImage(logo.data, 'PNG', 14, 8, 50, 50 * logo.h / logo.w);
  doc.setTextColor(139, 26, 26); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Bilan financier', W - 14, 14, { align: 'right' });
  doc.setTextColor(110); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(nom, W - 14, 20, { align: 'right' });
  doc.text(`Du ${new Date(d.periode.du).toLocaleDateString('fr')} au ${new Date(d.periode.au).toLocaleDateString('fr')} (${d.periode.nbJours} jours)`, W - 14, 25, { align: 'right' });
  doc.setDrawColor(139, 26, 26); doc.setLineWidth(0.8); doc.line(14, 30, W - 14, 30);
  const th = { fillColor: [26, 63, 111] };
  const t = (titre, head, body, opts = {}) => {
    const y = (doc.lastAutoTable?.finalY ?? 30) + 8;
    doc.setTextColor(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(titre, 14, y);
    autoTable(doc, { startY: y + 2, head: [head], body, theme: 'striped', styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: th, ...opts });
  };
  const v = d.ventes, dp = d.depenses, r = d.resultat, c = d.comparaison;
  t('Synthèse', ['Indicateur', 'Valeur'], [
    ["Chiffre d'affaires", F(v.ca)], ['Charges (dépenses)', F(dp.total)], ['Résultat net', `${F(r.net)} (${r.tauxNet} %)`],
    ['Marge brute sur matières', r.margeBrute == null ? 'non calculable' : `${F(r.margeBrute)} (${r.tauxMargeBrute} %, coût connu pour ${r.couvertureCout} % des ventes)`],
    ['Seuil de rentabilité', r.seuilRentabilite ? F(r.seuilRentabilite) : '—'],
    ['Tickets / ticket moyen', `${v.tickets} / ${F(v.ticketMoyen)}`], ['CA par jour / par couvert', `${F(v.caParJour)} / ${F(v.parCouvert)}`],
    ['Remises / retours / pourboires', `${F(v.remises)} / ${F(v.retours)} / ${F(v.pourboires)}`],
    ['Période précédente', `CA ${F(c.caPrecedent)}${c.evolutionCA != null ? ` (${c.evolutionCA > 0 ? '+' : ''}${c.evolutionCA} %)` : ''} · résultat ${F(c.resultatPrecedent)}`],
    ['Valeur du stock / pertes', `${F(d.stock.valeur)} / ${F(d.stock.pertes)}`],
  ], { columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } } });
  t('Ventes par catégorie', ['Catégorie', 'Ventes', 'Qté', 'Marge'], v.parCategorie.map(x => [nomCat(x.categorie), F(x.ca), x.qte, x.marge == null ? '—' : F(x.marge)]));
  t('Dépenses par catégorie', ['Catégorie', 'Montant', '% des charges'], dp.parCategorie.map(x => [x.categorie, F(x.montant), `${x.pct} %`]));
  t("Modes d'encaissement", ['Mode', 'Montant'], v.paiements.map(x => [MODES[x.type] || x.type, F(x.montant)]));
  t('Meilleures ventes', ['Article', 'Qté', 'Ventes'], v.topArticles.map(x => [x.nom, x.qte, F(x.ca)]));
  t('Serveurs', ['Serveur', 'Tickets', 'Ventes', 'Ticket moyen', 'Pourboires'], v.serveurs.map(x => [x.nom, x.tickets, F(x.ca), F(x.ticketMoyen), F(x.pourboires)]));
  t("Points d'amélioration", ['Niveau', 'Constat et action'], d.pointsAmelioration.map(p => [NIV[p.niveau].l, `${p.titre}. ${p.detail}`]), { columnStyles: { 0: { cellWidth: 26, fontStyle: 'bold' } } });
  doc.save(`bilan_financier_${d.periode.du}_${d.periode.au}.pdf`);
}

function Carte({ l, v, c = '#8B1A1A', s }) {
  return <div className="kpi" style={{ borderTop: `3px solid ${c}` }}><div className="kpi-label">{l}</div><div className="kpi-value" style={{ fontSize: 18, color: c }}>{v}</div>{s && <div style={{ fontSize: 10, color: '#888' }}>{s}</div>}</div>;
}
function Tableau({ titre, head, rows }) {
  return (
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <div style={{ padding: '10px 14px', fontFamily: 'Syne', fontWeight: 700, fontSize: 13 }}>{titre}</div>
      <table className="table-erp"><thead><tr>{head.map((h, i) => <th key={i} style={{ textAlign: i ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ textAlign: j ? 'right' : 'left', fontSize: 12 }}>{c}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={head.length} style={{ textAlign: 'center', color: '#888', fontSize: 12 }}>Aucune donnée</td></tr>}</tbody></table>
    </div>
  );
}

/** Bilan financier : ventes, dépenses, résultat, ratios et points d'amélioration. */
export default function BilanFinancier() {
  const P = periodes();
  const [choix, setChoix] = useState(0);
  const [du, setDu] = useState(P[0][1]); const [au, setAu] = useState(P[0][2]);
  const { restaurants, courant } = useYakro();
  const { global: choixGlobal } = useRestoStore();
  const global = choixGlobal ?? restaurants.length > 1;
  const portee = global ? 'TOUS' : courant?.id;
  const nom = global ? 'Tous les restaurants' : (courant?.nom || 'Yakro Grill');
  const { data: d, isLoading, isError, error } = useQuery({ queryKey: ['bilan-fin', du, au, portee], queryFn: () => yakroAPI.bilanFinancier({ du, au, portee }), enabled: !!portee, staleTime: 30000 });

  const excel = () => {
    const v = d.ventes, dp = d.depenses, r = d.resultat;
    exportExcel('bilan_financier', 'Synthèse', ['Indicateur', 'Valeur'], [
      ["Chiffre d'affaires", v.ca], ['Charges', dp.total], ['Résultat net', r.net], ['Taux net (%)', r.tauxNet], ['Marge brute', r.margeBrute ?? ''], ['Seuil de rentabilité', r.seuilRentabilite ?? ''],
      ['Tickets', v.tickets], ['Ticket moyen', v.ticketMoyen], ['Remises', v.remises], ['Retours', v.retours], ['Pourboires', v.pourboires], ['Charges fixes', dp.fixes], ['Autres charges', dp.autres], ['Salaires', dp.salaires],
      [], ['VENTES PAR CATÉGORIE'], ...v.parCategorie.map(x => [nomCat(x.categorie), x.ca]), [], ['DÉPENSES PAR CATÉGORIE'], ...dp.parCategorie.map(x => [x.categorie, x.montant]),
      [], ["POINTS D'AMÉLIORATION"], ...d.pointsAmelioration.map(p => [p.titre, p.detail])]);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }}>
        <div className="yk-chips" style={{ flex: '1 1 300px' }}>
          {P.map((p, i) => <button key={p[0]} className="yk-chip" aria-pressed={choix === i} onClick={() => { setChoix(i); setDu(p[1]); setAu(p[2]); }}>{p[0]}</button>)}
        </div>
        <div><label className="label">Du</label><input className="input" type="date" value={du} onChange={e => { setDu(e.target.value); setChoix(-1); }} /></div>
        <div><label className="label">Au</label><input className="input" type="date" value={au} onChange={e => { setAu(e.target.value); setChoix(-1); }} /></div>
        <button className="btn btn-sm" style={{ background: '#8B1A1A', color: 'white', border: 'none' }} disabled={!d} onClick={() => pdf(d, nom)}><FileText size={13} /> Télécharger le rapport PDF</button>
        <button className="btn btn-ghost btn-sm" disabled={!d} onClick={excel}><Download size={13} /> Excel</button>
      </div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{nom}</div>
      {isLoading && <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Calcul du bilan…</div>}
      {isError && <div role="alert" style={{ background: '#FDF2F2', color: '#A32D2D', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>Impossible de calculer le bilan : {error?.error || error?.message}</div>}
      {d && (() => {
        const v = d.ventes, dp = d.depenses, r = d.resultat, c = d.comparaison;
        return (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
              <Carte l="Chiffre d'affaires" v={F(v.ca)} s={c.evolutionCA != null ? `${c.evolutionCA > 0 ? '+' : ''}${c.evolutionCA} % vs période précédente` : `${v.tickets} tickets`} />
              <Carte l="Charges" v={F(dp.total)} c="#BA7517" s={`fixes ${F(dp.fixes)} · autres ${F(dp.autres)}`} />
              <Carte l="Résultat net" v={F(r.net)} c={r.net >= 0 ? '#27500A' : '#A32D2D'} s={`${r.tauxNet} % du CA`} />
              <Carte l="Marge brute" v={r.margeBrute == null ? '—' : F(r.margeBrute)} c="#1a3f6f" s={r.tauxMargeBrute != null ? `${r.tauxMargeBrute} % · coût connu ${r.couvertureCout} %` : 'coûts non renseignés'} />
              <Carte l="Seuil de rentabilité" v={r.seuilRentabilite ? F(r.seuilRentabilite) : '—'} c="#6B3FA0" s="ventes pour couvrir les charges fixes" />
              <Carte l="Ticket moyen" v={F(v.ticketMoyen)} c="#0F6E56" s={`${F(v.parCouvert)} par couvert`} />
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Points d'amélioration</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {d.pointsAmelioration.map((p, i) => { const n = NIV[p.niveau]; return (
                  <div key={i} style={{ background: n.bg, borderLeft: `4px solid ${n.c}`, borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: n.c }}>{p.titre} <span style={{ fontSize: 10, fontWeight: 500 }}>· {n.l}</span></div>
                    <div style={{ fontSize: 12, color: '#444', marginTop: 2 }}>{p.detail}</div>
                  </div>); })}
                {!d.pointsAmelioration.length && <div style={{ fontSize: 12, color: '#888' }}>Pas assez de données pour émettre un constat.</div>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 14 }}>
              <Tableau titre="Ventes par catégorie" head={['Catégorie', 'Ventes', 'Qté', 'Marge']} rows={v.parCategorie.map(x => [nomCat(x.categorie), F(x.ca), x.qte, x.marge == null ? '—' : F(x.marge)])} />
              <Tableau titre="Dépenses par catégorie" head={['Catégorie', 'Montant', '% charges']} rows={dp.parCategorie.map(x => [x.categorie, F(x.montant), `${x.pct} %`])} />
              <Tableau titre="Modes d'encaissement" head={['Mode', 'Montant']} rows={v.paiements.map(x => [MODES[x.type] || x.type, F(x.montant)])} />
              <Tableau titre="Meilleures ventes" head={['Article', 'Qté', 'Ventes']} rows={v.topArticles.map(x => [x.nom, x.qte, F(x.ca)])} />
              <Tableau titre="Serveurs" head={['Serveur', 'Tickets', 'Ventes', 'Ticket moy.']} rows={v.serveurs.map(x => [x.nom, x.tickets, F(x.ca), F(x.ticketMoyen)])} />
              <Tableau titre="Ventes par jour de la semaine" head={['Jour', 'Ventes']} rows={v.jourSemaine.map((x, i) => [JOURS[i], F(x)])} />
            </div>

            <div className="card" style={{ padding: 14, fontSize: 12, color: '#555', lineHeight: 1.7 }}>
              <b>Autres repères :</b> remises {F(v.remises)} · retours d'articles {F(v.retours)} · pourboires {F(v.pourboires)} (hors CA) · pertes de stock {F(d.stock.pertes)} · valeur du stock {F(d.stock.valeur)} · dépenses décaissées non justifiées {F(dp.nonJustifie)} (dont en retard {F(dp.enRetard)}).
            </div>
          </div>
        );
      })()}
    </div>
  );
}
