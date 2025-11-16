const express = require('express');
const { authenticate } = require('../middleware/auth');
const progressController = require('../controllers/progressController');

const router = express.Router();

router.get('/session/:sessionId', authenticate, progressController.getSessionProgress);
router.get('/topic/:topicId', authenticate, progressController.getTopicProgress);
router.get('/analytics/:sessionId', authenticate, progressController.getAnalytics);

module.exports = router;
