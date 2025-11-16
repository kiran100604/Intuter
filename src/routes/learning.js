const express = require('express');
const { authenticate } = require('../middleware/auth');
const learningController = require('../controllers/learningController');

const router = express.Router();

router.post('/content/generate', authenticate, learningController.generateContent);
router.get('/content/:contentId', authenticate, learningController.getContent);
router.post('/content/:contentId/regenerate', authenticate, learningController.regenerateContent);
router.post('/progress/step-complete', authenticate, learningController.markStepComplete);
router.get('/progress/session/:sessionId', authenticate, learningController.getSessionProgress);
router.post('/questions/ask', authenticate, learningController.askQuestion);
router.get('/questions/:questionId', authenticate, learningController.getQuestion);
router.post('/questions/:questionId/feedback', authenticate, learningController.provideFeedback);

module.exports = router;
