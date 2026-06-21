/**
 * Géocodage (recherche de lieux/POI) et routing (tracé d'itinéraire)
 * pour LiYA, via les services publics OpenStreetMap.
 *
 * IMPORTANT — limites connues, à respecter scrupuleusement :
 * - Nominatim (recherche d'adresse) : usage public, max 1 req/s, nécessite
 *   un User-Agent identifiant l'app (pas le User-Agent par défaut d'un
 *   client HTTP). Politique : https://operations.osmfoundation.org/policies/nominatim/
 * - OSRM démo (tracé d'itinéraire) : "restricted to reasonable,
 *   non-commercial use-cases", sans garantie de disponibilité, peut être
 *   coupé sans préavis. Politique : https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy
 *
 * Ce relais backend existe pour deux raisons : (1) Nominatim exige un
 * User-Agent identifiant, ce qu'un appel direct depuis le navigateur ne
 * permet pas de garantir de façon fiable ; (2) ça permet de centraliser
 * une limite de débit basique côté serveur plutôt que de laisser chaque
 * client web appeler librement le service public.
 *
 * Limité à la Côte d'Ivoire (viewbox) pour des résultats pertinents et
 * pour réduire la charge inutile sur le service public.
 */
const router = require('express').Router();
const { auth } = require('../../middleware/auth');

const USER_AGENT = 'ERP-2IG-LiYA/1.0 (usage interne Groupe 2IG, Côte d\'Ivoire)';
// Bounding box approximative Côte d'Ivoire (lon min, lat min, lon max, lat max)
const CI_VIEWBOX = '-8.6,4.3,-2.4,10.8';

// Limite de débit très simple, en mémoire : une requête sortante au plus
// toutes les 1100ms vers Nominatim, comme exigé par sa politique d'usage.
let derniereRequeteNominatim = 0;
async function attendreLimiteNominatim() {
  const maintenant = Date.now();
  const attente = Math.max(0, 1100 - (maintenant - derniereRequeteNominatim));
  if (attente > 0) await new Promise(r => setTimeout(r, attente));
  derniereRequeteNominatim = Date.now();
}

// ── GET /recherche-adresse?q=... — Autocomplete d'adresse (Nominatim) ─────
router.get('/recherche-adresse', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 3) return res.json([]);

    await attendreLimiteNominatim();

    const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams({
      q, format: 'jsonv2', limit: '6', viewbox: CI_VIEWBOX, bounded: '1', countrycodes: 'ci',
    });
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!r.ok) return res.status(502).json({ error: 'Service de recherche d\'adresse indisponible' });

    const data = await r.json();
    const resultats = data.map(d => ({
      label: d.display_name,
      lat: parseFloat(d.lat),
      lon: parseFloat(d.lon),
      type: d.type,
    }));
    res.json(resultats);
  } catch (e) {
    res.status(502).json({ error: 'Service de recherche d\'adresse indisponible — réessayez ou saisissez l\'adresse manuellement.' });
  }
});

// ── GET /itineraire?fromLat=&fromLon=&toLat=&toLon= — Tracé OSRM ──────────
router.get('/itineraire', auth, async (req, res) => {
  try {
    const { fromLat, fromLon, toLat, toLon } = req.query;
    if (!fromLat || !fromLon || !toLat || !toLon) {
      return res.status(400).json({ error: 'Coordonnées de départ et d\'arrivée requises' });
    }

    const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!r.ok) return res.status(502).json({ error: 'Service d\'itinéraire indisponible' });

    const data = await r.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) {
      return res.status(404).json({ error: 'Aucun itinéraire trouvé entre ces deux points' });
    }

    const route = data.routes[0];
    res.json({
      distanceMetres: route.distance,
      dureeSecondes: route.duration,
      geometrie: route.geometry, // GeoJSON LineString — directement utilisable par Leaflet
    });
  } catch (e) {
    res.status(502).json({ error: 'Service d\'itinéraire indisponible — le tracé ne peut pas être affiché pour le moment.' });
  }
});

module.exports = router;
