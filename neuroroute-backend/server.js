require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');

const authRoutes = require('./src/routes/authRoutes');
const routeRoutes = require('./src/routes/routeRoutes');
const placesRoutes = require('./src/routes/placesRoutes');
const preferencesRoutes = require('./src/routes/preferencesRoutes');
const feedbackRoutes = require('./src/routes/feedbackRoutes');
const reportsRoutes = require('./src/routes/reportsRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Simple request logger - helpful while developing in VS Code
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/', (req, res) => {
  res.json({ message: 'NeuroRoute API is running', status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/reports', reportsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `No route found for ${req.method} ${req.originalUrl}` });
});

// Central error handler (catches anything thrown/rejected in route handlers)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 NeuroRoute backend running on http://localhost:${PORT}`);
  });
});
