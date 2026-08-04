const pool = require('../config/db');
const { geocode } = require('../services/geocodeService');
const { getRoutes } = require('../services/osrmService');
const { getWeightsForProfile, scoreRoute } = require('../services/sensoryScore');
const { findNearbyQuietPlaces } = require('../services/overpassService');

function buildScoredRoutes(routes, weights) {
  return routes
    .map((route, idx) => {
      const { totalScore, segments } = scoreRoute(route.geometry, weights);
      return {
        id: idx,
        distanceMeters: Math.round(route.distance),
        durationSeconds: Math.round(route.duration),
        sensoryScore: totalScore,
        geometry: route.geometry,
        segments,
      };
    })
    .sort((a, b) => a.sensoryScore - b.sensoryScore);
}

// POST /api/routes/plan
// Body: { source, destination, profile, preferences }
// Works for guests too; if a Bearer token is present (req.user), the
// journey is saved to history for that user.
exports.planRoute = async (req, res) => {
  const { source, destination, profile, preferences } = req.body;

  if (!source || !destination) {
    return res.status(400).json({ error: 'source and destination are required' });
  }

  try {
    const sourceCoords = await geocode(source);
    const destCoords = await geocode(destination);

    const rawRoutes = await getRoutes(sourceCoords, destCoords);
    const weights = getWeightsForProfile(profile, preferences || {});
    const scoredRoutes = buildScoredRoutes(rawRoutes, weights);

    const best = scoredRoutes[0];
    const alternatives = scoredRoutes.slice(1);

    let nearbyQuietPlaces = [];
    try {
      nearbyQuietPlaces = await findNearbyQuietPlaces(destCoords.lat, destCoords.lng);
    } catch (placesErr) {
      console.warn('Could not fetch nearby quiet places:', placesErr.message);
    }

    let journeyId = null;
    if (req.user) {
      const result = await pool.query(
        `INSERT INTO journeys
           (user_id, source_text, destination_text, source_lat, source_lng,
            destination_lat, destination_lng, sensory_score, travel_time_seconds, distance_meters)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          req.user.id,
          source,
          destination,
          sourceCoords.lat,
          sourceCoords.lng,
          destCoords.lat,
          destCoords.lng,
          best.sensoryScore,
          best.durationSeconds,
          best.distanceMeters,
        ]
      );
      journeyId = result.rows[0].id;
    }

    res.json({
      journeyId,
      recommendedRoute: best,
      alternativeRoutes: alternatives,
      nearbyQuietPlaces,
      explanation: `This route was chosen for a ${profile || 'General User'} profile because it has the lowest estimated sensory load (score: ${best.sensoryScore}), balancing traffic, crowd density, noise, brightness, construction and weather along the way.`,
    });
  } catch (err) {
    console.error('Route planning error:', err.message);
    res.status(500).json({ error: err.message || 'Could not plan a route for these locations' });
  }
};

// POST /api/routes/reevaluate
// Simulates the "Agentic AI" step: given the user's current position,
// re-checks conditions and recommends whether to reroute.
// Body: { journeyId?, currentLat, currentLng, destination, profile, preferences }
exports.reevaluateRoute = async (req, res) => {
  const { journeyId, currentLat, currentLng, destination, profile, preferences } = req.body;

  if (currentLat === undefined || currentLng === undefined || !destination) {
    return res.status(400).json({ error: 'currentLat, currentLng and destination are required' });
  }

  try {
    const sourceCoords = await geocode(source);
    const destCoords = await geocode(destination);
    const rawRoutes = await getRoutes({ lat: currentLat, lng: currentLng }, destCoords);
    const weights = getWeightsForProfile(profile, preferences || {});
    const scoredRoutes = buildScoredRoutes(rawRoutes, weights);
    console.log('GEOCODED:', { source, sourceCoords, destination, destCoords });

    res.json({
      journeyId: journeyId || null,
      updatedRoute: scoredRoutes[0],
      alternatives: scoredRoutes.slice(1),
      rerouted: true,
    });
  } catch (err) {
    console.error('Route re-evaluation error:', err.message);
    res.status(500).json({ error: err.message || 'Could not re-evaluate the route' });
  }
};

// GET /api/routes/history (protected)
exports.getHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, source_text, destination_text, sensory_score, travel_time_seconds, distance_meters, created_at
       FROM journeys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ journeys: result.rows });
  } catch (err) {
    console.error('History fetch error:', err.message);
    res.status(500).json({ error: 'Could not fetch journey history' });
  }
};
