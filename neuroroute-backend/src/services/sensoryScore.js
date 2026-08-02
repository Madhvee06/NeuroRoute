// ============================================================
// NeuroRoute — Rule-based Sensory Scoring Engine
//
// Implements the formula from the project synopsis:
//   S = W1(Traffic) + W2(Crowd) + W3(Noise)
//     + W4(Brightness) + W5(Construction) + W6(Weather)
//
// NOTE ON REAL DATA SOURCES:
// This starter backend generates deterministic *placeholder*
// environmental readings per road segment (so the app is fully
// runnable end-to-end without paid API keys). To go from
// prototype -> production, replace `readEnvironmentalFactors()`
// below with real calls to:
//   - Traffic:      TomTom Traffic API / Google Roads API
//   - Crowd:        Overpass API POI density + community_reports table
//   - Noise:        community_reports table + open noise-map datasets
//   - Brightness:   time-of-day + streetlight/POI density
//   - Construction: community_reports table + city open-data feeds
//   - Weather:      OpenWeatherMap API
// Everything downstream (weighting, scoring, route comparison)
// already works with whatever numbers this function returns.
// ============================================================

// Deterministic pseudo-random generator (0-1) so the same segment
// always scores the same way in one run, instead of pure Math.random().
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function readEnvironmentalFactors(lat, lng, index) {
  const seed = lat * 1000 + lng * 1000 + index;
  return {
    traffic: seededRandom(seed) * 10,
    crowd: seededRandom(seed + 1) * 10,
    noise: seededRandom(seed + 2) * 10,
    brightness: seededRandom(seed + 3) * 10,
    construction: seededRandom(seed + 4) * 10,
    weather: seededRandom(seed + 5) * 10,
  };
}

// Base weight profiles per user type, plus preference-based boosting.
function getWeightsForProfile(profile, preferences = {}) {
  const baseWeights = {
    'Autistic User': { traffic: 0.15, crowd: 0.25, noise: 0.25, brightness: 0.15, construction: 0.15, weather: 0.05 },
    'Elderly User': { traffic: 0.2, crowd: 0.15, noise: 0.1, brightness: 0.1, construction: 0.25, weather: 0.2 },
    'General User': { traffic: 0.3, crowd: 0.15, noise: 0.1, brightness: 0.1, construction: 0.2, weather: 0.15 },
  };

  const weights = { ...(baseWeights[profile] || baseWeights['General User']) };

  // User-set preferences increase the importance of the factors they care about
  if (preferences.avoid_crowds) weights.crowd *= 1.5;
  if (preferences.avoid_noise) weights.noise *= 1.5;
  if (preferences.avoid_bright_lights) weights.brightness *= 1.5;
  if (preferences.avoid_construction) weights.construction *= 1.5;

  return weights;
}

function scoreSegment(lat, lng, index, weights) {
  const f = readEnvironmentalFactors(lat, lng, index);
  const score =
    weights.traffic * f.traffic +
    weights.crowd * f.crowd +
    weights.noise * f.noise +
    weights.brightness * f.brightness +
    weights.construction * f.construction +
    weights.weather * f.weather;

  return { lat, lng, score: Math.round(score * 100) / 100, factors: f };
}

// Splits a GeoJSON LineString geometry into ~numSegments sample points
// and sums their individual sensory scores into one route-level score.
function scoreRoute(geometry, weights, numSegments = 12) {
  const coordinates = geometry.coordinates; // array of [lng, lat]
  const step = Math.max(1, Math.floor(coordinates.length / numSegments));

  let totalScore = 0;
  const segments = [];

  for (let i = 0; i < coordinates.length; i += step) {
    const [lng, lat] = coordinates[i];
    const segment = scoreSegment(lat, lng, i, weights);
    totalScore += segment.score;
    segments.push(segment);
  }

  return { totalScore: Math.round(totalScore * 100) / 100, segments };
}

module.exports = { getWeightsForProfile, scoreRoute, scoreSegment };
