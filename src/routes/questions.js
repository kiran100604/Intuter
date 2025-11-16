const express = require('express');
const { authenticate } = require('../middleware/auth');
const questionController = require('../controllers/questionController');

const router = express.Router();

router.post('/ask', authenticate, questionController.askQuestion);
router.get('/:questionId', authenticate, questionController.getQuestion);
router.post('/:questionId/feedback', authenticate, questionController.provideFeedback);

module.exports = router;
