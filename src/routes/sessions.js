const express = require("express");
const { authenticate } = require("../middleware/auth");
const sessionController = require("../controllers/sessionController");
const upload = require("../middleware/fileUpload");

const router = express.Router();

router.post("/", authenticate, sessionController.createSession);
router.get("/", authenticate, sessionController.getSessions);
router.get("/:sessionId", authenticate, sessionController.getSessionDetails);
router.put("/:sessionId", authenticate, sessionController.updateSession);
router.delete("/:sessionId", authenticate, sessionController.deleteSession);
router.post(
  "/:sessionId/outline",
  authenticate,
  upload.single("outline"),
  sessionController.uploadOutline,
);
router.post(
  "/:sessionId/generate-blueprint",
  authenticate,
  sessionController.generateBlueprint,
);
router.get(
  "/:sessionId/stats",
  authenticate,
  sessionController.getSessionStats,
);

module.exports = router;
