const express = require("express");
const { authenticate } = require("../middleware/auth");
const learningController = require("../controllers/learningController");

const router = express.Router();

router.post(
  "/content/generate-learning",
  authenticate,
  learningController.generateLearningContent,
);
router.get(
  "/progress/session/:sessionId",
  authenticate,
  learningController.getSessionProgress,
);
router.get(
  "/progress/:subtopicId",
  authenticate,
  learningController.getContentGenerationProgress,
);
router.post("/questions/ask", authenticate, learningController.askQuestion);
router.get(
  "/questions/:questionId",
  authenticate,
  learningController.getQuestion,
);
router.post(
  "/questions/:questionId/feedback",
  authenticate,
  learningController.provideFeedback,
);

module.exports = router;
