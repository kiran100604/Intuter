const express = require("express");
const { authenticate } = require("../middleware/auth");
const knowledgeController = require("../controllers/knowledgeController");

const router = express.Router();

// Get all knowledge nodes for a session
router.get("/session/:sessionId", authenticate, knowledgeController.getSessionKnowledge);

// Get knowledge nodes for a specific subtopic
router.get("/subtopic/:subtopicId", authenticate, knowledgeController.getSubtopicKnowledge);

// Get a specific knowledge node by tag
router.get("/tag/:sessionId/:tagId", authenticate, knowledgeController.getNodeByTag);

// Search knowledge nodes
router.get("/search/:sessionId", authenticate, knowledgeController.searchKnowledge);

// Get prerequisites for a subtopic (what you need to know before)
router.get("/prerequisites/:subtopicId", authenticate, knowledgeController.getPrerequisites);

// Update mastery level for a concept (when user demonstrates understanding)
router.post("/mastery/:nodeId", authenticate, knowledgeController.updateMastery);

// Track that a concept was referenced (increment timesReferenced)
router.post("/reference/:nodeId", authenticate, knowledgeController.trackReference);

// Manually add a knowledge node
router.post("/", authenticate, knowledgeController.createNode);

// Update a knowledge node
router.put("/:nodeId", authenticate, knowledgeController.updateNode);

module.exports = router;
