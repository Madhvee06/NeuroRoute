const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const VALID_PROFILES = ['Autistic User', 'Elderly User', 'General User'];

function signToken(user) {
  return jwt.sign({ id: user._id.toString(), email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

// POST /api/auth/signup
// Body: { name, email, password, profile? }
exports.signup = async (req, res) => {
  const { name, email, password } = req.body;
  let { profile } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password should be at least 6 characters' });
  }
  if (!profile || !VALID_PROFILES.includes(profile)) {
    profile = 'General User';
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, profile });

    const token = signToken(user);
    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Something went wrong while creating your account' });
  }
};

// POST /api/auth/login
// Body: { email, password }
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Something went wrong while logging in' });
  }
};

// GET /api/auth/me (protected)
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.toSafeObject());
  } catch (err) {
    console.error('Fetch profile error:', err.message);
    res.status(500).json({ error: 'Something went wrong while fetching your profile' });
  }
  
};
// Add this at the bottom of authController.js, before the final closing of the file

// PUT /api/auth/profile (protected)
// Body: { profile: "Autistic User" | "Elderly User" | "General User" }
exports.updateProfile = async (req, res) => {
  const { profile } = req.body;

  if (!VALID_PROFILES.includes(profile)) {
    return res.status(400).json({ error: `profile must be one of: ${VALID_PROFILES.join(', ')}` });
  }

  try {
    const user = await User.findByIdAndUpdate(req.user.id, { profile }, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.toSafeObject());
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ error: 'Could not update profile' });
  }
};
