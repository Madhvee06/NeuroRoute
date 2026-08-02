const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const requireAuth = require('../middleware/auth');

router.post('/', requireAuth, reportsController.createReport);
router.get('/nearby', reportsController.nearbyReports);

module.exports = router;
