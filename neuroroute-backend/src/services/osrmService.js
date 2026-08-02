const axios = require('axios');

const OSRM_BASE = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

// Asks the OSRM routing engine for one or more candidate routes between
// two coordinates. Returns raw OSRM route objects (distance, duration,
// GeoJSON geometry, steps).
exports.getRoutes = async (source, destination) => {
  const coords = `${source.lng},${source.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_BASE}/route/v1/driving/${coords}`;

  const resp = await axios.get(url, {
    params: {
      overview: 'full',
      geometries: 'geojson',
      alternatives: 'true',
      steps: 'true',
    },
  });

  if (resp.data.code !== 'Ok' || !resp.data.routes || resp.data.routes.length === 0) {
    throw new Error('The routing engine could not find a route between these locations');
  }

  return resp.data.routes;
};
