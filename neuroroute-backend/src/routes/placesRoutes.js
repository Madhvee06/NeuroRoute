const express = require('express');
const router = express.Router();
const placesController = require('../controllers/placesController');

router.get('/nearby', placesController.nearby);

module.exports = router;
