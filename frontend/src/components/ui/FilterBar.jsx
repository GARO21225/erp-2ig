import { useState } from 'react';
import { Calendar } from 'lucide-react';

const PRESETS = [
  { key: 'today',  label: "Aujourd'hui" },
  { key: 'week',   label: 'Semaine' },
  { key: 'month',  label: 'Mois' },
  { key: 'year',   label: 'Année' },
  { key: 'custom', label: 'Période...' },
  { key: 'all',    label: 'Tout' },
];

function getRange(key) {
  const now = new Date();
  switch (key) {
    case 'today': {
      const d = new Date(now); d.setHours(0,0,0,0);
      const f = new Date(now); f.setHours(23,59,59,999);
      return { debut: d, fin: f };
    }
    case 'week': {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      monday.setHours(0,0,0,0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23,59,59,999);
      return { debut: monday, fin: sunday };
    }
    case 'month': {
      const debut = new Date(now.getFullYear(), now.getMonth(), 1);
      const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { debut, fin };
    }
    case 'year': {
      const debut = new Date(now.getFullYear(), 0, 1);
      const fin = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      return { debut, fin };
    }
    case 'all': return { debut: null, fin: null };
    default: return null;
  }
}

export default function FilterBar({ onChange, defaultPreset = 'month', color = '#1a3f6f' }) {
  const [active, setActive] = useState(defaultPreset);
  const [customDebut, setCustomDebut] = useState('');
  const [customFin, setCustomFin] = useState('');

  const select = (key) => {
    setActive(key);
    if (key !== 'custom') {
      const range = getRange(key);
      onChange?.(range);
    }
  };

  const applyCustom = () => {
    if (customDebut && customFin) {
      onChange?.({ debut: new Date(customDebut), fin: new Date(customFin + 'T23:59:59') });
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {PRESETS.map(p => (
        <button key={p.key} onClick={() => select(p.key)}
          style={{
            padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
            background: active === p.key ? color : '#F1EFE8',
            color: active === p.key ? 'white' : '#666',
            fontWeight: active === p.key ? 600 : 400,
            transition: 'all 0.1s',
          }}>
          {p.label}
        </button>
      ))}
      {active === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <input type="date" value={customDebut} onChange={e => setCustomDebut(e.target.value)}
            style={{ padding: '3px 8px', border: '0.5px solid #e8e7e1', borderRadius: 6, fontSize: 12 }} />
          <span style={{ fontSize: 12, color: '#888' }}>→</span>
          <input type="date" value={customFin} onChange={e => setCustomFin(e.target.value)}
            style={{ padding: '3px 8px', border: '0.5px solid #e8e7e1', borderRadius: 6, fontSize: 12 }} />
          <button onClick={applyCustom}
            style={{ padding: '3px 10px', background: color, color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}
