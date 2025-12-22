const express = require("express");
const { authenticate } = require("../middleware/auth");
const contentRequestController = require("../controllers/contentRequestController");

const router = express.Router();

// Create a new content request (user suggests missing content)
router.post("/", authenticate, contentRequestController.createRequest);

// Get all requests for a session (for review)
router.get("/session/:sessionId", authenticate, contentRequestController.getSessionRequests);

// Get a specific request
router.get("/:requestId", authenticate, contentRequestController.getRequest);

// Process a pending request (generate content)
router.post("/:requestId/process", authenticate, contentRequestController.processRequest);

// Integrate processed content into learning content
router.post("/:requestId/integrate", authenticate, contentRequestController.integrateContent);

// Quick "Explain Differently" endpoint
router.post("/explain-differently", authenticate, contentRequestController.explainDifferently);

// Block editor AI actions (explain, simplify, expand, examples, regenerate)
router.post("/ai-action", authenticate, contentRequestController.aiAction);

// Generate content from user prompt
router.post("/generate", authenticate, contentRequestController.generateContent);

// Explain an uploaded image
router.post("/explain-image", authenticate, contentRequestController.explainImage);

module.exports = router;
