const express = require('express');
const { authenticate } = require('../middleware/auth');
const topicController = require('../controllers/topicController');

const router = express.Router();

router.get('/', authenticate, topicController.getTopics);
router.get('/:topicId', authenticate, topicController.getTopicDetails);
router.post('/:topicId/intuition', authenticate, topicController.generateIntuition);
router.get('/:topicId/prerequisites', authenticate, topicController.checkPrerequisites);

module.exports = router;
