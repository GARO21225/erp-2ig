import { useState } from 'react';
import { ClipboardList, Receipt, Landmark, Clock, Wallet } from 'lucide-react';
import { useYakro } from '../../lib/useYakro';
import CommandesYakro from './CommandesYakro';
import CaisseYakro from './CaisseYakro';
import GestionCaissePage from './GestionCaissePage';
import PointagePage from './PointagePage';
import DepensesYakroPage from './DepensesYakroPage';

/** Tous les historiques du restaurant au même endroit. */
export default function HistoriquesPage() {
  const { courant } = useYakro();
  const [onglet, setOnglet] = useState('commandes');
  const onglets = [['commandes', 'Commandes', ClipboardList], ['passages', 'Passages en caisse', Receipt], ['clotures', 'Clôtures de caisse', Landmark], ['depenses', 'Dépenses', Wallet], ['pointages', 'Pointages du personnel', Clock]];
  return (
    <div>
      <div className="yk-head"><div><h1 className="yk-title">Historiques</h1><div className="yk-sub">{courant?.nom}</div></div></div>
      <div className="yk-chips" role="tablist" style={{ marginBottom: 14 }}>
        {onglets.map(([k, l, Icon]) => <button key={k} role="tab" className="yk-chip" aria-pressed={onglet === k} onClick={() => setOnglet(k)}><Icon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{l}</button>)}
      </div>
      {onglet === 'commandes' && <CommandesYakro />}
      {onglet === 'passages' && <CaisseYakro histo />}
      {onglet === 'clotures' && <GestionCaissePage histo />}
      {onglet === 'depenses' && <DepensesYakroPage histo />}
      {onglet === 'pointages' && <PointagePage histo />}
    </div>
  );
}
