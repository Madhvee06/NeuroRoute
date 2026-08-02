const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    journey: { type: mongoose.Schema.Types.ObjectId, ref: 'Journey', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: {
      type: String,
      enum: ['Comfortable', 'Moderate', 'Stressful'],
      required: true,
    },
    comments: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
