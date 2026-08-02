const CommunityReport = require('../models/CommunityReport');

const VALID_TYPES = ['crowd', 'noise', 'construction', 'hazard', 'event'];

// POST /api/reports (protected)
// Body: { lat, lng, reportType, description? }
exports.createReport = async (req, res) => {
  const { lat, lng, reportType, description } = req.body;

  if (lat === undefined || lng === undefined || !VALID_TYPES.includes(reportType)) {
    return res.status(400).json({
      error: `lat, lng and a valid reportType are required (one of: ${VALID_TYPES.join(', ')})`,
    });
  }

  try {
    const report = await CommunityReport.create({
      user: req.user.id,
      lat,
      lng,
      reportType,
      description: description || '',
    });
    res.status(201).json(report);
  } catch (err) {
    console.error('Create report error:', err.message);
    res.status(500).json({ error: 'Could not save community report' });
  }
};

// GET /api/reports/nearby?lat=..&lng=..&radiusKm=..
// Simple bounding-box lookup - fine for a prototype's scale of data.
exports.nearbyReports = async (req, res) => {
  const { lat, lng, radiusKm } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query params are required' });
  }

  const radius = radiusKm ? parseFloat(radiusKm) : 2; // default 2km
  const latDelta = radius / 111; // ~111km per degree latitude
  const lngDelta = radius / (111 * Math.cos((parseFloat(lat) * Math.PI) / 180));

  try {
    const reports = await CommunityReport.find({
      lat: { $gte: parseFloat(lat) - latDelta, $lte: parseFloat(lat) + latDelta },
      lng: { $gte: parseFloat(lng) - lngDelta, $lte: parseFloat(lng) + lngDelta },
    })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ reports });
  } catch (err) {
    console.error('Nearby reports error:', err.message);
    res.status(500).json({ error: 'Could not fetch nearby reports' });
  }
};
