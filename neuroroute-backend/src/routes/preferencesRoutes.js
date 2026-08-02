const express = require('express');
const router = express.Router();
const preferencesController = require('../controllers/preferencesController');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, preferencesController.getPreferences);
router.put('/', requireAuth, preferencesController.updatePreferences);

module.exports = router;
