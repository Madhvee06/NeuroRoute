const express = require('express');
const router = express.Router();
const { getTraffic } = require('../controllers/trafficController');

router.get('/', getTraffic); // GET /api/traffic?lat=..&lng=..

module.exports = router;