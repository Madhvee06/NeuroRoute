const { getTrafficAt } = require('../services/trafficService');

async function getTraffic(req, res) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng query params are required' });
    }
    const traffic = await getTrafficAt(Number(lat), Number(lng));
    res.json(traffic);
  } catch (err) {
    console.error('Traffic fetch failed:', err.message);
    res.status(500).json({ error: 'Could not fetch traffic data' });
  }
}

module.exports = { getTraffic };