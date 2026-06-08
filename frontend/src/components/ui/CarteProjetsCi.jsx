/**
 * CarteProjetsCi — Carte Côte d'Ivoire avec marqueurs projets
 * Utilise Leaflet OpenStreetMap
 */
import { useEffect, useRef } from 'react';

// Coordonnées par défaut des villes CI
const COORDS_CI = {
  'Abidjan':      [5.3600, -4.0083],
  'Yamoussoukro': [6.8276, -5.2893],
  'Bouaké':       [7.6897, -5.0299],
  'Daloa':        [6.8770, -6.4500],
  'San-Pédro':    [4.7485, -6.6363],
  'Korhogo':      [9.4580, -5.6291],
  'Man':          [7.4125, -7.5536],
  'Gagnoa':       [6.1319, -5.9500],
  'Abengourou':   [6.7296, -3.4965],
  'Agboville':    [5.9291, -4.2144],
  'Divo':         [5.8369, -5.3572],
  'Soubré':       [5.7833, -6.6000],
  'Bondoukou':    [8.0333, -2.8000],
  'Grand-Bassam': [5.1985, -3.7349],
  'Assinie':      [5.1500, -3.4667],
  'Bingerville':  [5.3565, -3.8821],
  'Toumodi':      [6.5588, -5.0175],
  'Tiassalé':     [5.8980, -4.8236],
  'Sassandra':    [4.9500, -6.0833],
};

export default function CarteProjetsCi({ projets = [] }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Charger Leaflet depuis CDN
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => initMap();
    document.head.appendChild(script);

    function initMap() {
      const L = window.L;
      if (!mapRef.current || mapInstance.current) return;

      // Centré sur la Côte d'Ivoire
      const map = L.map(mapRef.current).setView([7.5400, -5.5471], 7);
      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      // Ajouter les marqueurs projets
      projets.forEach(p => {
        const coords = p.latitude && p.longitude
          ? [p.latitude, p.longitude]
          : COORDS_CI[p.ville] || COORDS_CI['Abidjan'];

        const lotsDispo = p._count?.lots || 0;
        const color = p.statut === 'EN_COURS' ? '#1a3f6f' : p.statut === 'TERMINE' ? '#888' : '#E87722';

        // Icône custom avec nombre de lots
        const icon = L.divIcon({
          html: `<div style="
            background: ${color};
            color: white;
            border-radius: 50%;
            width: 36px; height: 36px;
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; font-weight: 800;
            font-family: Syne, sans-serif;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            border: 2px solid white;
          ">${lotsDispo}</div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker(coords, { icon }).addTo(map);

        // Popup avec info projet
        marker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 200px;">
            <div style="font-weight: 800; font-size: 14px; color: #1a3f6f; margin-bottom: 6px;">
              ${p.nom}
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              📍 ${p.localisation || p.ville}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px;">
              <div style="background: #EEF3FB; border-radius: 6px; padding: 6px; text-align: center;">
                <div style="font-size: 18px; font-weight: 800; color: #1a3f6f;">${lotsDispo}</div>
                <div style="font-size: 10px; color: #888;">Lots dispos</div>
              </div>
              <div style="background: #F7F7F5; border-radius: 6px; padding: 6px; text-align: center;">
                <div style="font-size: 12px; font-weight: 600;">${p.superficie?.toLocaleString('fr')} m²</div>
                <div style="font-size: 10px; color: #888;">Superficie</div>
              </div>
            </div>
            <div style="margin-top: 8px; font-size: 11px;">
              Prix : ${p.prixLotMin >= 1000000 ? (p.prixLotMin/1000000).toFixed(1)+'M' : Math.round(p.prixLotMin/1000)+'k'} — ${p.prixLotMax >= 1000000 ? (p.prixLotMax/1000000).toFixed(1)+'M' : Math.round(p.prixLotMax/1000)+'k'} FCFA
            </div>
            <div style="margin-top: 4px;">
              <span style="background: ${color}22; color: ${color}; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 500;">${p.statut}</span>
            </div>
          </div>
        `);
      });

      // Si aucun projet, afficher info
      if (projets.length === 0) {
        L.popup()
          .setLatLng([7.5400, -5.5471])
          .setContent('<div style="font-family:sans-serif; font-size:12px; color:#888">Aucun projet foncier créé</div>')
          .openOn(map);
      }
    }

    // Si Leaflet déjà chargé
    if (window.L) initMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Mettre à jour les marqueurs quand les projets changent
  useEffect(() => {
    if (!mapInstance.current || !window.L) return;
    // Simple refresh — re-render complet si projets changent
  }, [projets]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: 'white', borderRadius: 8, padding: '6px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: 12, fontWeight: 600 }}>
        🗺 Carte des projets — Côte d'Ivoire
      </div>
      <div ref={mapRef} style={{ height: 380, borderRadius: 10, overflow: 'hidden', border: '0.5px solid #e8e7e1' }} />
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#888', justifyContent: 'center' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#1a3f6f', marginRight: 4 }} />En cours</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#E87722', marginRight: 4 }} />Planifié</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#888', marginRight: 4 }} />Terminé</span>
        <span style={{ color: '#aaa' }}>• Chiffre = lots disponibles</span>
      </div>
    </div>
  );
}
