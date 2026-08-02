const mongoose = require('mongoose');

const journeySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sourceText: { type: String, required: true },
    destinationText: { type: String, required: true },
    sourceLat: Number,
    sourceLng: Number,
    destinationLat: Number,
    destinationLng: Number,
    sensoryScore: Number,
    travelTimeSeconds: Number,
    distanceMeters: Number,
  },
  { timestamps: true }
);

journeySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Journey', journeySchema);
