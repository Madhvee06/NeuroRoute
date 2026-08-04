const axios = require('axios');

const OVERPASS_URL =
  process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

// Finds nearby "sensory-friendly" quiet places (parks, libraries, cafes)
// around a given point using OpenStreetMap's Overpass API.
// Matches the shape expected by HomeScreen.js's QUICK_PLACES list.
exports.findNearbyQuietPlaces = async (lat, lng, radiusMeters = 1500) => {
  const query = `
    [out:json][timeout:25];
    (
      node["leisure"="park"](around:${radiusMeters},${lat},${lng});
      node["amenity"="library"](around:${radiusMeters},${lat},${lng});
      node["amenity"="cafe"](around:${radiusMeters},${lat},${lng});
    );
    out center 20;
  `;

  const resp = await axios.post(OVERPASS_URL, query, {
    headers: {
      'Content-Type': 'text/plain',
      'Accept': 'application/json',
      'User-Agent': 'NeuroRoute/1.0 (contact: your-email@example.com)',
    },
  });

  const elements = resp.data.elements || [];

  return elements
    .filter((el) => el.tags && el.tags.name)
    .slice(0, 10)
    .map((el) => ({
      id: String(el.id),
      name: el.tags.name,
      type:
        el.tags.leisure === 'park'
          ? 'Park · Quiet'
          : el.tags.amenity === 'library'
          ? 'Library · Quiet'
          : 'Café · Low noise',
      lat: el.lat,
      lng: el.lon,
    }));
};