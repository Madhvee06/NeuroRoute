const { findNearbyQuietPlaces } = require('../services/overpassService');

// GET /api/places/nearby?lat=..&lng=..&radius=..
exports.nearby = async (req, res) => {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query params are required' });
  }

  try {
    const places = await findNearbyQuietPlaces(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseInt(radius, 10) : undefined
    );
    res.json({ places });
  } catch (err) {
    console.error('Nearby places error:', err.message);
    res.status(500).json({ error: 'Could not fetch nearby quiet places' });
  }
};
