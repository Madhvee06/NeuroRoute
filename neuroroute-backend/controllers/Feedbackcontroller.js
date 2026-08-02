const pool = require('../config/db');

const VALID_RATINGS = ['Comfortable', 'Moderate', 'Stressful'];

// POST /api/feedback (protected)
// Body: { journeyId, rating, comments? }
exports.submitFeedback = async (req, res) => {
  const { journeyId, rating, comments } = req.body;

  if (!journeyId || !VALID_RATINGS.includes(rating)) {
    return res.status(400).json({
      error: `journeyId is required and rating must be one of: ${VALID_RATINGS.join(', ')}`,
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO feedback (journey_id, user_id, rating, comments)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [journeyId, req.user.id, rating, comments || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Submit feedback error:', err.message);
    res.status(500).json({ error: 'Could not save feedback' });
  }
};