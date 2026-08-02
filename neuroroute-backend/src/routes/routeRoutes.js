const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const requireAuth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');

// Works for guests; saves to history if logged in
router.post('/plan', optionalAuth, routeController.planRoute);

// "Agentic AI" style mid-journey re-check
router.post('/reevaluate', optionalAuth, routeController.reevaluateRoute);

// Requires login - past journeys
router.get('/history', requireAuth, routeController.getHistory);

module.exports = router;
