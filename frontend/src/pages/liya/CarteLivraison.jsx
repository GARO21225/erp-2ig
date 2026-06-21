import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { liyaAPI, employesAPI } from '../../lib/api';
import { MapPin, Truck, Navigation, Clock, CheckCircle, XCircle } from 'lucide-react';

// Leaflet CSS via CDN injection
function useLeafletCSS() {
  useEffect(() => {
    if (document.getElementById('leaflet-css')) return;
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }, []);
}

const STATUT_COULEUR = {
  EN_ATTENTE:      '#888780',
  PRISE_EN_CHARGE: '#1a3f6f',
  EN_ROUTE:        '#E85D04',
  LIVRE:           '#27500A',
  ECHEC:           '#A32D2D',
  ANNULE:          '#888780',
};

const STATUT_ICONE = {
  EN_ROUTE:  '🛵',
  LIVRE:     '✅',
  ECHEC:     '❌',
  EN_ATTENTE:'⏳',
  PRISE_EN_CHARGE: '📦',
  ANNULE:    '✖',
};

// Zones arbitraires — notion inventée pour permettre le filtrage demandé,
// le système n'a pas de découpage administratif réel. Quadrillage simple
// autour du centre de Yamoussoukro (6.8276, -5.2893), 4 quadrants nommés
// par point cardinal. Approximatif par construction : sert à filtrer
// grossièrement, pas à délimiter une zone de livraison officielle.
const CENTRE_VILLE = { lat: 6.8276, lon: -5.2893 };
function zoneDe(lat, lon) {
  if (lat == null || lon == null) return null;
  const nord = lat >= CENTRE_VILLE.lat;
  const est = lon >= CENTRE_VILLE.lon;
  if (nord && est) return 'Nord-Est';
  if (nord && !est) return 'Nord-Ouest';
  if (!nord && est) return 'Sud-Est';
  return 'Sud-Ouest';
}
const ZONES = ['Nord-Est', 'Nord-Ouest', 'Sud-Est', 'Sud-Ouest'];

export default function CarteLivraison() {
  useLeafletCSS();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const tracesHistoriqueRef = useRef([]); // polylignes des parcours historiques affichés
  const itineraireLayerRef = useRef(null); // polyligne + marqueurs départ/arrivée du tracé sélectionné
  const [selected, setSelected] = useState(null);
  const [erreurCarte, setErreurCarte] = useState(false);
  const [itineraireErreur, setItineraireErreur] = useState(null);

  // Filtres pour l'historique des parcours
  const [filtreChauffeurId, setFiltreChauffeurId] = useState('');
  const [filtreZone, setFiltreZone] = useState('');
  const [filtreHeureDebut, setFiltreHeureDebut] = useState('');
  const [filtreHeureFin, setFiltreHeureFin] = useState('');
  const [filtreDate, setFiltreDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [afficherHistorique, setAfficherHistorique] = useState(false);

  const { data: statsData } = useQuery({
    queryKey: ['stats-liya'],
    queryFn: liyaAPI.stats,
    refetchInterval: 15000,
  });

  const { data: livraisonsData } = useQuery({
    queryKey: ['livraisons-carte'],
    queryFn: () => liyaAPI.livraisons({ statut: 'EN_ROUTE', limit: 50 }),
    refetchInterval: 10000,
  });

  // Historique complet du jour sélectionné — utilisé pour la liste latérale
  // ET pour le mode "voir tous les parcours" avec filtres heure/livreur/zone.
  const { data: toutesLivraisons } = useQuery({
    queryKey: ['livraisons-liste-carte', filtreDate, filtreChauffeurId],
    queryFn: () => liyaAPI.livraisons({ date: filtreDate, chauffeurId: filtreChauffeurId || undefined, limit: 200 }),
    refetchInterval: 15000,
  });

  const { data: livreursData } = useQuery({
    queryKey: ['employes-liya-filtre-carte'],
    queryFn: () => employesAPI.list({ filiale: 'LIYA', statut: 'ACTIF', limit: 50 }),
    staleTime: 5 * 60000,
  });
  const listeLivreurs = Array.isArray(livreursData) ? livreursData : (livreursData?.data || []);

  const enRoute = livraisonsData?.data || [];
  const toutesBrutes = toutesLivraisons?.data || [];
  const stats = statsData || {};

  // Filtre zone/heure côté frontend — chauffeurId est déjà filtré côté
  // backend (paramètre supporté par GET /), pas besoin de le refaire ici.
  const toutes = toutesBrutes.filter(l => {
    if (filtreZone) {
      const zoneDepart = zoneDe(l.latPrise, l.lonPrise);
      const zoneArrivee = zoneDe(l.latDest, l.lonDest);
      if (zoneDepart !== filtreZone && zoneArrivee !== filtreZone) return false;
    }
    if (filtreHeureDebut || filtreHeureFin) {
      const heure = new Date(l.createdAt).getHours() + new Date(l.createdAt).getMinutes() / 60;
      if (filtreHeureDebut && heure < parseFloat(filtreHeureDebut)) return false;
      if (filtreHeureFin && heure > parseFloat(filtreHeureFin)) return false;
    }
    return true;
  });

  // Initialiser la carte Leaflet
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import('leaflet').then(L => {
      try {
        // Fixer l'icône Leaflet (problème Vite)
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        // Yamoussoukro comme centre par défaut
        const map = L.map(mapRef.current, {
          center: [6.8276, -5.2893],
          zoom: 13,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      } catch (e) {
        setErreurCarte(true);
      }
    }).catch(() => setErreurCarte(true));

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Mettre à jour les marqueurs quand les livraisons changent
  useEffect(() => {
    if (!mapInstanceRef.current || enRoute.length === 0) return;

    import('leaflet').then(L => {
      const map = mapInstanceRef.current;
      const ids = new Set(enRoute.map(l => l.id));

      // Supprimer les marqueurs qui ne sont plus EN_ROUTE
      Object.keys(markersRef.current).forEach(id => {
        if (!ids.has(id)) {
          markersRef.current[id].remove();
          delete markersRef.current[id];
        }
      });

      enRoute.forEach(livraison => {
        // Utiliser position GPS si disponible, sinon coordonnées destination
        const lat = livraison.latDest || 6.8276 + (Math.random() - 0.5) * 0.05;
        const lng = livraison.lonDest || -5.2893 + (Math.random() - 0.5) * 0.05;

        const couleur = STATUT_COULEUR[livraison.statut] || '#E85D04';

        const icon = L.divIcon({
          html: `<div style="background:${couleur};color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🛵</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          className: '',
        });

        if (markersRef.current[livraison.id]) {
          markersRef.current[livraison.id].setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], { icon })
            .addTo(map)
            .bindPopup(`
              <div style="font-family:DM Sans,sans-serif;min-width:180px">
                <div style="font-weight:700;font-size:14px;margin-bottom:6px">${livraison.numero}</div>
                <div style="font-size:12px;color:#555;margin-bottom:3px">📦 ${livraison.clientNom}</div>
                <div style="font-size:12px;color:#555;margin-bottom:3px">📍 ${livraison.adresseLivraison}</div>
                <div style="font-size:11px;color:#E85D04;font-weight:600">${(livraison.montant||0).toLocaleString('fr')} FCFA</div>
              </div>
            `);
          marker.on('click', () => setSelected(livraison));
          markersRef.current[livraison.id] = marker;
        }
      });

      // Centrer sur les livraisons si présentes
      if (enRoute.length > 0 && enRoute[0].latDest) {
        map.setView([enRoute[0].latDest, enRoute[0].lonDest], 14);
      }
    });
  }, [enRoute]);

  // Tracer l'itinéraire réel (départ → arrivée) de la livraison sélectionnée.
  // Nécessite que les deux points aient été géocodés à la création (latPrise/
  // lonPrise/latDest/lonDest) — les livraisons créées avant cette fonctionnalité,
  // ou avec une adresse tapée sans choisir de suggestion, n'ont pas ces coordonnées.
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Toujours nettoyer le tracé précédent avant d'en afficher un nouveau (ou aucun)
    if (itineraireLayerRef.current) {
      itineraireLayerRef.current.forEach(layer => layer.remove());
      itineraireLayerRef.current = null;
    }
    setItineraireErreur(null);

    if (!selected) return;
    const { latPrise, lonPrise, latDest, lonDest } = selected;
    if (!latPrise || !lonPrise || !latDest || !lonDest) {
      // Pas une erreur à proprement parler — juste pas de coordonnées disponibles
      // (adresse saisie en texte libre sans passer par la recherche de lieu)
      return;
    }

    import('leaflet').then(async L => {
      try {
        const res = await liyaAPI.itineraire(latPrise, lonPrise, latDest, lonDest);
        const coords = res.geometrie.coordinates.map(([lon, lat]) => [lat, lon]); // GeoJSON = [lon,lat], Leaflet = [lat,lon]

        const ligne = L.polyline(coords, { color: '#1a3f6f', weight: 4, opacity: 0.75 }).addTo(map);
        const depart = L.circleMarker([latPrise, lonPrise], { radius: 7, color: 'white', weight: 2, fillColor: '#27500A', fillOpacity: 1 })
          .bindPopup('📍 Départ').addTo(map);
        const arrivee = L.circleMarker([latDest, lonDest], { radius: 7, color: 'white', weight: 2, fillColor: '#A32D2D', fillOpacity: 1 })
          .bindPopup('🏁 Arrivée').addTo(map);

        itineraireLayerRef.current = [ligne, depart, arrivee];
        map.fitBounds(ligne.getBounds(), { padding: [40, 40] });
      } catch (e) {
        // Service indisponible (limite atteinte, coupure du serveur démo OSRM...) —
        // ne bloque jamais l'affichage de la carte, juste pas de tracé pour cette fois.
        setItineraireErreur('Itinéraire indisponible pour le moment');
      }
    });

    return () => {
      if (itineraireLayerRef.current) {
        itineraireLayerRef.current.forEach(layer => layer.remove());
        itineraireLayerRef.current = null;
      }
    };
  }, [selected]);

  // Affichage de l'ensemble des parcours filtrés (mode "historique"). Pour
  // ne pas multiplier les appels au service d'itinéraire (limite 1 req/s,
  // potentiellement des dizaines de trajets affichés à la fois), ces tracés
  // sont des lignes droites départ→arrivée — une vue d'ensemble, pas le
  // tracé routier exact de chacun (réservé au mode "sélection unique"
  // ci-dessus, qui lui appelle le vrai service de routing).
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    tracesHistoriqueRef.current.forEach(layer => layer.remove());
    tracesHistoriqueRef.current = [];

    if (!afficherHistorique) return;

    import('leaflet').then(L => {
      const tracable = toutes.filter(l => l.latPrise && l.lonPrise && l.latDest && l.lonDest);
      tracable.forEach(l => {
        const couleur = STATUT_COULEUR[l.statut] || '#888';
        const ligne = L.polyline(
          [[l.latPrise, l.lonPrise], [l.latDest, l.lonDest]],
          { color: couleur, weight: 2, opacity: 0.5, dashArray: '4,6' }
        ).addTo(map).bindPopup(`
          <div style="font-family:DM Sans,sans-serif;font-size:12px">
            <strong>${l.numero}</strong><br/>
            ${l.expediteurNom || l.clientNom || '—'} → ${l.destinataireNom || '—'}<br/>
            ${new Date(l.createdAt).toLocaleString('fr')}
          </div>
        `);
        tracesHistoriqueRef.current.push(ligne);
      });
      if (tracable.length > 0) {
        const group = L.featureGroup(tracesHistoriqueRef.current);
        map.fitBounds(group.getBounds(), { padding: [30, 30] });
      }
    });

    return () => {
      tracesHistoriqueRef.current.forEach(layer => layer.remove());
      tracesHistoriqueRef.current = [];
    };
  }, [afficherHistorique, toutes]);

  return (
    <div className="page-enter" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header + KPI */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Carte GPS — LiYA</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="dot dot-pulse" style={{ background: '#E85D04' }} />
            Temps réel · {enRoute.length} livreur(s) en transit
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'En transit', value: stats.enCours || enRoute.length, color: '#E85D04' },
            { label: 'Livrées aujourd\'hui', value: stats.livrees || 0, color: '#27500A' },
            { label: 'Taux réussite', value: (stats.tauxReussite || 0) + '%', color: '#1a3f6f' },
          ].map(k => (
            <div key={k.label} className="kpi" style={{ minWidth: 100, padding: '8px 12px' }}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ fontSize: 20, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtres parcours / historique */}
      <div className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setAfficherHistorique(v => !v)}
          className="btn btn-sm"
          style={{
            background: afficherHistorique ? '#1a3f6f' : '#F1EFE8',
            color: afficherHistorique ? 'white' : '#666',
            border: 'none', fontSize: 11, fontWeight: 600,
          }}>
          {afficherHistorique ? '🗺 Tous les parcours (actif)' : '🗺 Voir tous les parcours'}
        </button>

        <input type="date" className="input" style={{ width: 140, fontSize: 12 }}
          value={filtreDate} onChange={e => setFiltreDate(e.target.value)} />

        <select className="input" style={{ width: 150, fontSize: 12 }}
          value={filtreChauffeurId} onChange={e => setFiltreChauffeurId(e.target.value)}>
          <option value="">Tous les livreurs</option>
          {listeLivreurs.map(l => <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>)}
        </select>

        <select className="input" style={{ width: 130, fontSize: 12 }}
          value={filtreZone} onChange={e => setFiltreZone(e.target.value)}>
          <option value="">Toutes les zones</option>
          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' }}>
          <Clock size={12} />
          <input type="number" min="0" max="23" placeholder="0h" className="input" style={{ width: 50, fontSize: 12, padding: '6px 8px' }}
            value={filtreHeureDebut} onChange={e => setFiltreHeureDebut(e.target.value)} />
          <span>—</span>
          <input type="number" min="0" max="23" placeholder="23h" className="input" style={{ width: 50, fontSize: 12, padding: '6px 8px' }}
            value={filtreHeureFin} onChange={e => setFiltreHeureFin(e.target.value)} />
        </div>

        {(filtreChauffeurId || filtreZone || filtreHeureDebut || filtreHeureFin) && (
          <button onClick={() => { setFiltreChauffeurId(''); setFiltreZone(''); setFiltreHeureDebut(''); setFiltreHeureFin(''); }}
            style={{ fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>
            Réinitialiser
          </button>
        )}

        {afficherHistorique && (
          <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>
            {toutes.filter(l => l.latPrise && l.latDest).length} parcours affiché(s) sur {toutes.length} course(s) du jour
          </span>
        )}
      </div>

      {/* Carte + sidebar */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12, minHeight: 0 }}>

        {/* Carte Leaflet */}
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '0.5px solid #e8e7e1', position: 'relative' }}>
          {erreurCarte ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F7F7F5', color: '#888', gap: 12 }}>
              <MapPin size={40} color="#ccc" />
              <div style={{ fontFamily: 'Syne', fontWeight: 700 }}>Carte indisponible</div>
              <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 280 }}>
                Leaflet / OpenStreetMap requis.<br />Vérifier la connexion réseau.
              </div>
            </div>
          ) : (
            <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
          )}

          {/* Légende */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'white', borderRadius: 10, padding: '8px 12px', zIndex: 999, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', fontSize: 11 }}>
            {[['🛵 En route', '#E85D04'], ['✅ Livré', '#27500A'], ['❌ Échec', '#A32D2D']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ color: '#555' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Liste livraisons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: '#1a1a1a' }}>
            {afficherHistorique ? 'Parcours filtrés' : 'Livraisons récentes'}
          </div>
          {toutes?.map(l => (
            <div key={l.id}
              onClick={() => setSelected(l)}
              style={{
                background: selected?.id === l.id ? '#FFF0EB' : 'white',
                border: `1px solid ${selected?.id === l.id ? '#E85D04' : '#e8e7e1'}`,
                borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 12, color: '#E85D04' }}>{l.numero}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: STATUT_COULEUR[l.statut] || '#888' }}>
                  {STATUT_ICONE[l.statut] || '•'} {l.statut?.replace('_', ' ')}
                </span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{l.expediteurNom || l.clientNom} → {l.destinataireNom || '—'}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{l.adresseLivraison}</div>
              <div style={{ fontSize: 11, color: '#E85D04', marginTop: 4, fontWeight: 600 }}>
                {(l.montant || 0).toLocaleString('fr')} FCFA
              </div>
            </div>
          ))}
          {toutes.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#ccc', fontSize: 13 }}>
              <Truck size={28} style={{ marginBottom: 8 }} /><br />
              Aucune livraison
            </div>
          )}
        </div>
      </div>

      {/* Détail livraison sélectionnée */}
      {selected && (
        <div style={{ background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 10, padding: '14px 20px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#E85D04' }}>{selected.numero}</div>
            <div style={{ display: 'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap: 12 }}>
              {[
                ['Expéditeur', selected.expediteurNom || selected.clientNom],
                ['Tél. expéditeur', selected.expediteurTel || selected.clientTel],
                ['Destinataire', selected.destinataireNom || '—'],
                ['Tél. destinataire', selected.destinataireTel || '—'],
                ['Départ', selected.adressePrise],
                ['Destination', selected.adresseLivraison],
                ['Moto', selected.moto?.immatriculation || '—'],
                ['Livreur', selected.chauffeur ? `${selected.chauffeur.prenom} ${selected.chauffeur.nom}` : '—'],
                ['Montant', `${(selected.montant || 0).toLocaleString('fr')} FCFA`],
                ['Statut', selected.statut?.replace('_', ' ')],
                ['Code certification', selected.codeVerifieLe ? '✓ Vérifié' : (selected.codeCertification ? `•••${selected.codeCertification.slice(-1)}` : '—')],
              ].map(([label, val]) => (
                <div key={label} style={{ background: '#F7F7F5', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontSize: 10, color: '#888' }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{val}</div>
                </div>
              ))}
            </div>
            {(!selected.latPrise || !selected.latDest) && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#BA7517', background: '#FAEEDA', borderRadius: 6, padding: '6px 10px' }}>
                ⚠ Itinéraire non tracé — l'adresse de départ et/ou d'arrivée n'a pas été localisée précisément (saisie en texte libre sans choisir de suggestion lors de la création).
              </div>
            )}
            {itineraireErreur && selected.latPrise && selected.latDest && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#A32D2D', background: '#FCEBEB', borderRadius: 6, padding: '6px 10px' }}>
                ⚠ {itineraireErreur} — le service de calcul d'itinéraire est temporairement indisponible.
              </div>
            )}
          </div>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>✕</button>
        </div>
      )}
    </div>
  );
}
