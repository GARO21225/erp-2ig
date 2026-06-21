import { useState, useEffect, useRef } from 'react';
import { liyaAPI } from '../../lib/api';
import { MapPin } from 'lucide-react';

/**
 * Champ d'adresse avec autocomplete (recherche de lieux/POI via Nominatim,
 * relayé par le backend). Remplace un simple <input> texte libre : la
 * sélection d'une suggestion renvoie aussi les coordonnées GPS, nécessaires
 * pour tracer l'itinéraire ensuite.
 *
 * value attendu/renvoyé : { adresse: string, lat: number|null, lon: number|null }
 * Si l'utilisateur tape une adresse sans jamais cliquer de suggestion,
 * lat/lon restent null — l'adresse texte est tout de même conservée
 * (on ne bloque jamais la saisie, on l'enrichit quand c'est possible).
 */
export default function SelecteurAdresse({ label, value, onChange, placeholder }) {
  const [texte, setTexte] = useState(value?.adresse || '');
  const [suggestions, setSuggestions] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const debounceRef = useRef(null);
  const conteneurRef = useRef(null);

  useEffect(() => { setTexte(value?.adresse || ''); }, [value?.adresse]);

  // Fermer la liste de suggestions si on clique en dehors
  useEffect(() => {
    const handler = (e) => { if (conteneurRef.current && !conteneurRef.current.contains(e.target)) setOuvert(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTexte = (v) => {
    setTexte(v);
    onChange({ adresse: v, lat: null, lon: null }); // coordonnées invalidées tant qu'une suggestion n'est pas choisie
    clearTimeout(debounceRef.current);
    if (v.trim().length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setChargement(true);
      try {
        const res = await liyaAPI.rechercheAdresse(v.trim());
        setSuggestions(Array.isArray(res) ? res : []);
        setOuvert(true);
      } catch {
        setSuggestions([]);
      } finally {
        setChargement(false);
      }
    }, 600); // attend une pause de frappe avant d'interroger le service (limite 1 req/s côté Nominatim)
  };

  const choisir = (s) => {
    setTexte(s.label);
    onChange({ adresse: s.label, lat: s.lat, lon: s.lon });
    setSuggestions([]);
    setOuvert(false);
  };

  return (
    <div ref={conteneurRef} style={{ position: 'relative' }}>
      {label && <label className="label">{label}</label>}
      <div style={{ position: 'relative' }}>
        <input className="input" value={texte} placeholder={placeholder || 'Rechercher une adresse ou un lieu...'}
          onChange={e => handleTexte(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOuvert(true)}
          style={{ paddingRight: 30 }} />
        <MapPin size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: value?.lat ? '#27500A' : '#ccc' }} />
      </div>
      {ouvert && (chargement || suggestions.length > 0) && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #e8e7e1', borderRadius: 8, marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 220, overflowY: 'auto' }}>
          {chargement && <div style={{ padding: 10, fontSize: 12, color: '#888' }}>Recherche...</div>}
          {!chargement && suggestions.map((s, i) => (
            <div key={i} onClick={() => choisir(s)}
              style={{ padding: '8px 10px', fontSize: 12, cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #f0efe9' : 'none' }}
              onMouseDown={e => e.preventDefault()}>
              📍 {s.label}
            </div>
          ))}
        </div>
      )}
      {value?.lat && (
        <div style={{ fontSize: 10, color: '#27500A', marginTop: 3 }}>✓ Position localisée</div>
      )}
    </div>
  );
}
