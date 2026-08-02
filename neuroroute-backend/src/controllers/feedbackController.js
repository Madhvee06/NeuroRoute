const Feedback = require('../models/Feedback');
const Journey = require('../models/Journey');

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
    const journey = await Journey.findById(journeyId);
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    const feedback = await Feedback.create({
      journey: journeyId,
      user: req.user.id,
      rating,
      comments: comments || '',
    });

    res.status(201).json(feedback);
  } catch (err) {
    console.error('Submit feedback error:', err.message);
    res.status(500).json({ error: 'Could not save feedback' });
  }
};
