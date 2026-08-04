const axios = require('axios');

const NOMINATIM_URL =
  process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';

// Converts a free-text place name (e.g. "Carter Road, Bandra") into
// { lat, lng } coordinates using OpenStreetMap's free Nominatim service.
// If the caller already passes coordinates as "lat,lng", we use those directly.
// src/services/geocodeService.js
exports.geocode = async (query) => {
  const coordMatch = query.trim().match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[3]) };
  }

  const resp = await axios.get(NOMINATIM_URL, {
    params: {
      q: query,
      format: 'json',
      limit: 1,
      countrycodes: 'in',
      viewbox: '72.7,19.3,73.1,18.85',
      bounded: 1,
    },
    headers: { 'User-Agent': 'NeuroRoute-Student-Project/1.0' },
  });

  if (!resp.data || resp.data.length === 0) {
    throw new Error(`Could not find a location matching "${query}"`);
  }

  return {
    lat: parseFloat(resp.data[0].lat),
    lng: parseFloat(resp.data[0].lon),
  };
};
