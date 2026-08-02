const User = require('../models/User');

const FIELDS = [
  'avoidCrowds',
  'avoidNoise',
  'avoidBrightLights',
  'avoidConstruction',
  'preferParks',
  'preferSafeRoutes',
];

// GET /api/preferences (protected)
exports.getPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('preferences');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.preferences);
  } catch (err) {
    console.error('Get preferences error:', err.message);
    res.status(500).json({ error: 'Could not fetch preferences' });
  }
};

// PUT /api/preferences (protected)
// Body: any subset of { avoidCrowds, avoidNoise, avoidBrightLights,
//                        avoidConstruction, preferParks, preferSafeRoutes }
exports.updatePreferences = async (req, res) => {
  const updates = {};
  for (const field of FIELDS) {
    if (req.body[field] !== undefined) {
      updates[`preferences.${field}`] = Boolean(req.body[field]);
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid preference fields provided' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    ).select('preferences');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.preferences);
  } catch (err) {
    console.error('Update preferences error:', err.message);
    res.status(500).json({ error: 'Could not update preferences' });
  }
};
