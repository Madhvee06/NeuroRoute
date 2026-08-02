const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const VALID_PROFILES = ['Autistic User', 'Elderly User', 'General User'];

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
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, profile)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, profile, created_at`,
      [name, email, passwordHash, profile]
    );
    const user = result.rows[0];

    await pool.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [user.id]);

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({ token, user });
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
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, profile: user.profile },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Something went wrong while logging in' });
  }
};

// GET /api/auth/me  (protected)
exports.me = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, profile, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fetch profile error:', err.message);
    res.status(500).json({ error: 'Something went wrong while fetching your profile' });
  }
};