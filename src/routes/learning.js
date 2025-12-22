const express = require('express');
const { authenticate } = require('../middleware/auth');
const learningController = require('../controllers/learningController');

const router = express.Router();

// Content Generation & Management
router.post('/content/generate', authenticate, learningController.generateContent);
router.get('/content', authenticate, learningController.getContent);
router.post('/content/regenerate-with-feedback', authenticate, learningController.regenerateWithFeedback);
router.post('/content/add-missing', authenticate, learningController.addMissingContent);

// Teaching Styles
router.get('/teaching-styles', authenticate, learningController.getTeachingStyles);

// Progress Tracking
router.post('/progress/step-complete', authenticate, learningController.markStepComplete);
router.get('/progress/session/:sessionId', authenticate, learningController.getSessionProgress);

// Questions & Chat
router.post('/questions/ask', authenticate, learningController.askQuestion);
router.get('/questions/:questionId', authenticate, learningController.getQuestion);
router.post('/questions/:questionId/feedback', authenticate, learningController.provideFeedback);
router.post('/chat/summarize', authenticate, learningController.summarizeChat);

// User Notes & Customization
router.post('/notes/save', authenticate, learningController.saveUserNotes);
router.post('/custom/subtopic', authenticate, learningController.addCustomSubtopic);
router.post('/custom/topic', authenticate, learningController.addCustomTopic);

// Legacy routes for backwards compatibility
router.get('/content/:contentId', authenticate, learningController.getContent);
router.post('/content/:contentId/regenerate', authenticate, learningController.generateContent);

module.exports = router;
