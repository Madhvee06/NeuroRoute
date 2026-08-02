const mongoose = require('mongoose');

const communityReportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    reportType: {
      type: String,
      enum: ['crowd', 'noise', 'construction', 'hazard', 'event'],
      required: true,
    },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

// Supports "find reports near this point" queries
communityReportSchema.index({ lat: 1, lng: 1 });

module.exports = mongoose.model('CommunityReport', communityReportSchema);
