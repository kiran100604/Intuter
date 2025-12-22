const express = require("express");
const { authenticate } = require("../middleware/auth");
const notesController = require("../controllers/notesController");

const router = express.Router();

// Get all notes for a session
router.get("/session/:sessionId", authenticate, notesController.getSessionNotes);

// Get notes for a specific subtopic
router.get("/subtopic/:subtopicId", authenticate, notesController.getSubtopicNotes);

// Get a specific note
router.get("/:noteId", authenticate, notesController.getNote);

// Create a new note
router.post("/", authenticate, notesController.createNote);

// Update a note (full update)
router.put("/:noteId", authenticate, notesController.updateNote);

// Add a block to a note
router.post("/:noteId/blocks", authenticate, notesController.addBlock);

// Update a specific block
router.put("/:noteId/blocks/:blockId", authenticate, notesController.updateBlock);

// Delete a block
router.delete("/:noteId/blocks/:blockId", authenticate, notesController.deleteBlock);

// Reorder blocks
router.put("/:noteId/reorder", authenticate, notesController.reorderBlocks);

// Toggle star
router.post("/:noteId/star", authenticate, notesController.toggleStar);

// Delete a note
router.delete("/:noteId", authenticate, notesController.deleteNote);

// Quick save from learning content (highlight and save)
router.post("/quick-save", authenticate, notesController.quickSave);

module.exports = router;
