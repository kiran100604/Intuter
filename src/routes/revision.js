const express = require("express");
const { authenticate } = require("../middleware/auth");
const revisionController = require("../controllers/revisionController");

const router = express.Router();

router.post("/generate", authenticate, revisionController.generateRevision);
router.get("/:subtopicId", authenticate, revisionController.getRevision);

module.exports = router;
