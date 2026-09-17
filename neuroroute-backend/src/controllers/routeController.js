const axios = require('axios');
const Journey = require('../models/Journey');
const { geocode } = require('../services/geocodeService');
const { getRoutes } = require('../services/osrmService');
const { getWeightsForProfile, scoreRoute } = require('../services/sensoryScore');
const { findNearbyQuietPlaces } = require('../services/overpassService');

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8000/agent/plan';

// Average pedestrian walking speed, used to ESTIMATE walking duration
// from the same driving-route geometry/distance. We deliberately do
// NOT call OSRM's walking profile separately — a walking-optimized
// route can be a genuinely different path (different roads, different
// alternative count/order) than the driving one, which would break
// the 1-to-1 match between what's drawn on the map (driving geometry)
// and the walking duration shown for it. This keeps map, sensory
// score, and both duration numbers all describing the exact same path.
const WALKING_SPEED_MPS = 1.4; // ~5 km/h

// The agent's ML model was trained on 0-1 scale factors (see generate_data.py),
// but sensoryScore.js's readEnvironmentalFactors() produces 0-10 scale values.
// Average each segment's factors into one per-route object AND rescale to 0-1
// so the Random Forest sees the same range it was trained on.
function averageFactors(segments) {
  const keys = ['traffic', 'crowd', 'noise', 'brightness', 'construction', 'weather'];
  const totals = Object.fromEntries(keys.map((k) => [k, 0]));

  segments.forEach((seg) => {
    keys.forEach((k) => { totals[k] += seg.factors[k]; });
  });

  const avg = {};
  keys.forEach((k) => { avg[k] = (totals[k] / segments.length) / 10; }); // /10 rescales to 0-1
  return avg;
}

function buildScoredRoutes(routes, weights) {
  return routes
    .map((route, idx) => {
      const { totalScore, segments } = scoreRoute(route.geometry, weights);

      // OSRM returns turn-by-turn instructions per leg when steps=true
      // is passed (see osrmService.js). Flatten every leg's steps into
      // one array — NavigationScreen expects this field directly on
      // each route.
      const steps = (route.legs || []).flatMap((leg) => leg.steps || []);

      return {
        id: idx,
        distanceMeters: Math.round(route.distance),
        durationSecondsDriving: Math.round(route.duration), // real, from OSRM
        durationSecondsWalking: Math.round(route.distance / WALKING_SPEED_MPS), // estimated
        sensoryScore: totalScore,
        geometry: route.geometry,
        segments,
        factors: averageFactors(segments), // <-- new: per-route average, 0-1 scale, for the agent
        steps,
      };
    })
    .sort((a, b) => a.sensoryScore - b.sensoryScore);
}

// main.py checks for lowercase "autistic" | "elderly" | "general", but the
// frontend/DB use "Autistic User" | "Elderly User" | "General User".
function toAgentProfile(profile) {
  if (!profile) return 'general';
  const p = profile.toLowerCase();
  if (p.includes('autistic')) return 'autistic';
  if (p.includes('elderly')) return 'elderly';
  return 'general';
}

// Mongoose stores preferences as camelCase (avoidCrowds, avoidNoise, ...)
// while the sensory scoring engine expects snake_case keys - this bridges the two.
function toSnakeCasePreferences(prefs = {}) {
  return {
    avoid_crowds: prefs.avoidCrowds,
    avoid_noise: prefs.avoidNoise,
    avoid_bright_lights: prefs.avoidBrightLights,
    avoid_construction: prefs.avoidConstruction,
    prefer_parks: prefs.preferParks,
    prefer_safe_routes: prefs.preferSafeRoutes,
  };
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
    const weights = getWeightsForProfile(profile, toSnakeCasePreferences(preferences || {}));
    const scoredRoutes = buildScoredRoutes(rawRoutes, weights);

    const best = scoredRoutes[0];
    const alternatives = scoredRoutes.slice(1);

    let nearbyQuietPlaces = [];
    try {
      nearbyQuietPlaces = await findNearbyQuietPlaces(destCoords.lat, destCoords.lng);
    } catch (placesErr) {
      console.warn('Could not fetch nearby quiet places:', placesErr.message);
    }

    // --- Agentic AI Decision Engine call ---
    // Sends every candidate route to the Python/LangGraph agent, which
    // re-ranks them using the trained Random Forest and writes a plain-
    // English explanation. If the Python service is down or slow, we
    // silently fall back to the rule-based result above — the app must
    // never break because of this call.
    let agentDecision = null;
    try {
      const agentRes = await axios.post(AGENT_URL, {
        routes: [best, ...alternatives].map((r) => ({
          id: r.id,
          sensoryScore: r.sensoryScore,
          distanceMeters: r.distanceMeters,
          durationSeconds: r.durationSecondsDriving,
          factors: r.factors,
        })),
        profile: toAgentProfile(profile),
        preferences: preferences || {},
      }, { timeout: 30000 });
      agentDecision = agentRes.data; // { chosenRoute: {...}, explanation: "..." }
    } catch (err) {
      console.log('Agent unavailable, falling back to rule-based score:', err.message);
    }

    // If the agent responded, use ITS chosen route (it may re-rank vs. the
    // rule-based `best`), matched back to our full route object by id.
    const allRoutes = [best, ...alternatives];
    const agentChosenId = agentDecision?.chosenRoute?.id;
    const recommendedRoute = agentChosenId !== undefined
      ? (allRoutes.find((r) => r.id === agentChosenId) || best)
      : best;
    const alternativeRoutes = allRoutes.filter((r) => r.id !== recommendedRoute.id);

    let journeyId = null;
    if (req.user) {
      const journey = await Journey.create({
        user: req.user.id,
        sourceText: source,
        destinationText: destination,
        sourceLat: sourceCoords.lat,
        sourceLng: sourceCoords.lng,
        destinationLat: destCoords.lat,
        destinationLng: destCoords.lng,
        sensoryScore: recommendedRoute.sensoryScore,
        travelTimeSeconds: recommendedRoute.durationSecondsDriving,
        distanceMeters: recommendedRoute.distanceMeters,
      });
      journeyId = journey._id;
    }

    res.json({
      journeyId,
      sourceCoords,
      destCoords,
      recommendedRoute,
      alternativeRoutes,
      nearbyQuietPlaces,
      explanation:
        agentDecision?.explanation ||
        `This route was chosen for a ${profile || 'General User'} profile because it has the lowest estimated sensory load (score: ${best.sensoryScore}), balancing traffic, crowd density, noise, brightness, construction and weather along the way.`,
      agentPowered: !!agentDecision, // shows the examiner whether the agent actually ran
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
    const destCoords = await geocode(destination);
    const rawRoutes = await getRoutes({ lat: currentLat, lng: currentLng }, destCoords);
    const weights = getWeightsForProfile(profile, toSnakeCasePreferences(preferences || {}));
    const scoredRoutes = buildScoredRoutes(rawRoutes, weights);

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
    const journeys = await Journey.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('sourceText destinationText sensoryScore travelTimeSeconds distanceMeters createdAt');
    res.json({ journeys });
  } catch (err) {
    console.error('History fetch error:', err.message);
    res.status(500).json({ error: 'Could not fetch journey history' });
  }
};