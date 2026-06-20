import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader } from 'lucide-react';

export default function AdressePoiInput({ value, onChange, onCoords, placeholder, label }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  const search = (q) => {
    clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ci&limit=6&addressdetails=1`,
          { headers: { 'Accept-Language': 'fr', 'User-Agent': 'ERP-2IG-LiYA/1.0' } }
        );
        const data = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 450);
  };

  const select = (item) => {
    const addr = item.display_name;
    setQuery(addr);
    onChange(addr);
    onCoords?.(parseFloat(item.lat), parseFloat(item.lon));
    setSuggestions([]);
    setOpen(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && <label className="label">{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          className="input"
          value={query}
          placeholder={placeholder || 'Rechercher une adresse ou un lieu...'}
          autoComplete="off"
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); onCoords?.(null, null); search(e.target.value); }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          style={{ paddingRight: 32 }}
        />
        {loading && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Loader size={13} color="#E85D04" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 9999, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'white', border: '1px solid #e8e7e1', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => select(s)}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: i < suggestions.length - 1 ? '1px solid #f5f5f5' : 'none', display: 'flex', gap: 8, alignItems: 'flex-start', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#FFF0EB'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <MapPin size={13} style={{ color: '#E85D04', marginTop: 2, flexShrink: 0 }} />
              <span style={{ color: '#333', lineHeight: 1.4 }}>{s.display_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
