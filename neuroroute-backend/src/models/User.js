const mongoose = require('mongoose');

const VALID_PROFILES = ['Autistic User', 'Elderly User', 'General User'];

// Preferences live directly on the user document since every user
// has exactly one set of preferences - no need for a separate collection.
const preferencesSchema = new mongoose.Schema(
  {
    avoidCrowds: { type: Boolean, default: true },
    avoidNoise: { type: Boolean, default: true },
    avoidBrightLights: { type: Boolean, default: false },
    avoidConstruction: { type: Boolean, default: true },
    preferParks: { type: Boolean, default: false },
    preferSafeRoutes: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    profile: { type: String, enum: VALID_PROFILES, default: 'General User' },
    preferences: { type: preferencesSchema, default: () => ({}) },
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

// Never send the password hash back in API responses
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    profile: this.profile,
    preferences: this.preferences,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.VALID_PROFILES = VALID_PROFILES;
