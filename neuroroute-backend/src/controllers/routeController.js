// Derived from the same AGENT_URL env var already used for /agent/plan,
// so only ONE env var needs to be set/changed if the agent's host or
// port ever changes.
const AGENT_MONITOR_URL = AGENT_URL.replace('/agent/plan', '/agent/monitor');

// POST /api/routes/reevaluate
// Called periodically by NavigationScreen during an active journey.
// Recomputes candidate routes from the user's CURRENT position, then
// asks the agent (via /agent/monitor) whether switching is actually
// worth it — the agent applies a threshold so tiny score differences
// don't trigger constant, noisy reroute suggestions.
// Body: { journeyId?, currentLat, currentLng, destination, profile,
//         preferences, activeRouteScore }
exports.reevaluateRoute = async (req, res) => {
  const {
    journeyId,
    currentLat,
    currentLng,
    destination,
    profile,
    preferences,
    activeRouteScore, // sensory score of the route the user is currently following
  } = req.body;

  if (currentLat === undefined || currentLng === undefined || !destination) {
    return res.status(400).json({ error: 'currentLat, currentLng and destination are required' });
  }

  try {
    const destCoords = await geocode(destination);
    const rawRoutes = await getRoutes({ lat: currentLat, lng: currentLng }, destCoords);
    const weights = getWeightsForProfile(profile, toSnakeCasePreferences(preferences || {}));
    const scoredRoutes = buildScoredRoutes(rawRoutes, weights);

    let agentResult = null;
    try {
      const agentRes = await axios.post(AGENT_MONITOR_URL, {
        routes: scoredRoutes.map((r) => ({
          id: r.id,
          sensoryScore: r.sensoryScore,
          distanceMeters: r.distanceMeters,
          durationSeconds: r.durationSecondsDriving,
          factors: r.factors,
        })),
        profile: toAgentProfile(profile),
        preferences: preferences || {},
        activeRouteScore: activeRouteScore ?? scoredRoutes[0].sensoryScore,
      }, { timeout: 15000 });
      agentResult = agentRes.data; // { rerouteSuggested, newRoute?, explanation? }
    } catch (agentErr) {
      console.log('⚠️ Agent unavailable during monitoring, falling back to silent re-score:', agentErr.message);
    }

    if (agentResult) {
      return res.json({
        journeyId: journeyId || null,
        rerouteSuggested: agentResult.rerouteSuggested,
        newRoute: agentResult.newRoute || null,
        explanation: agentResult.explanation || null,
        alternatives: scoredRoutes.slice(1),
      });
    }

    // Agent unreachable — never suggest a reroute blindly without its
    // threshold check. Report current best silently, app keeps working.
    res.json({
      journeyId: journeyId || null,
      rerouteSuggested: false,
      updatedRoute: scoredRoutes[0],
      alternatives: scoredRoutes.slice(1),
    });
  } catch (err) {
    console.error('Route re-evaluation error:', err.message);
    res.status(500).json({ error: err.message || 'Could not re-evaluate the route' });
  }
};