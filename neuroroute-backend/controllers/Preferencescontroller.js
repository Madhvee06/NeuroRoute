const pool = require('../config/db');

// GET /api/preferences (protected)
exports.getPreferences = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preferences not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get preferences error:', err.message);
    res.status(500).json({ error: 'Could not fetch preferences' });
  }
};

// PUT /api/preferences (protected)
// Body: any subset of { avoid_crowds, avoid_noise, avoid_bright_lights,
//                        avoid_construction, prefer_parks, prefer_safe_routes }
exports.updatePreferences = async (req, res) => {
  const fields = [
    'avoid_crowds',
    'avoid_noise',
    'avoid_bright_lights',
    'avoid_construction',
    'prefer_parks',
    'prefer_safe_routes',
  ];

  const updates = [];
  const values = [];
  let i = 1;

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${i}`);
      values.push(Boolean(req.body[field]));
      i += 1;
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid preference fields provided' });
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.user.id);

  try {
    const result = await pool.query(
      `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = $${i} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update preferences error:', err.message);
    res.status(500).json({ error: 'Could not update preferences' });
  }
};