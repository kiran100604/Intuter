const db = require("../models");
const { NotFoundError, ValidationError } = require("../utils/errors");
const { v4: uuidv4 } = require("uuid");

/**
 * Get all notes for a session
 */
exports.getSessionNotes = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const { starred, subtopicId } = req.query;

    // Validate session access
    const session = await db.StudySession.findOne({
      where: { sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError("Session not found or unauthorized");
    }

    const where = { sessionId, userId };
    if (starred === "true") where.isStarred = true;
    if (subtopicId) where.subtopicId = subtopicId;

    const notes = await db.UserNote.findAll({
      where,
      include: [
        {
          model: db.Subtopic,
          as: "subtopic",
          attributes: ["id", "name"],
        },
      ],
      order: [
        ["isStarred", "DESC"],
        ["updatedAt", "DESC"],
      ],
    });

    res.json({
      success: true,
      data: { notes },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notes for a specific subtopic
 */
exports.getSubtopicNotes = async (req, res, next) => {
  try {
    const { subtopicId } = req.params;
    const userId = req.user.id;

    const notes = await db.UserNote.findAll({
      where: { subtopicId, userId },
      order: [["updatedAt", "DESC"]],
    });

    res.json({
      success: true,
      data: { notes },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific note
 */
exports.getNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;

    const note = await db.UserNote.findOne({
      where: { id: noteId, userId },
      include: [
        {
          model: db.Subtopic,
          as: "subtopic",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!note) {
      throw new NotFoundError("Note not found");
    }

    res.json({
      success: true,
      data: { note },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new note
 */
exports.createNote = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { sessionId, subtopicId, title, blocks, tags, color } = req.body;

    if (!sessionId) {
      throw new ValidationError("sessionId is required");
    }

    // Validate session access
    const session = await db.StudySession.findOne({
      where: { sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError("Session not found or unauthorized");
    }

    // Initialize blocks with IDs if not present
    const processedBlocks = (blocks || []).map((block, index) => ({
      ...block,
      id: block.id || uuidv4(),
      order: block.order ?? index,
    }));

    const note = await db.UserNote.create({
      userId,
      sessionId,
      subtopicId: subtopicId || null,
      title: title || "Untitled Note",
      blocks: processedBlocks,
      tags: tags || [],
      color: color || null,
    });

    res.status(201).json({
      success: true,
      data: { note },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a note
 */
exports.updateNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;
    const { title, blocks, tags, color, linkedConcepts } = req.body;

    const note = await db.UserNote.findOne({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundError("Note not found");
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (blocks !== undefined) updates.blocks = blocks;
    if (tags !== undefined) updates.tags = tags;
    if (color !== undefined) updates.color = color;
    if (linkedConcepts !== undefined) updates.linkedConcepts = linkedConcepts;

    await note.update(updates);

    res.json({
      success: true,
      data: { note: note.toJSON() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a block to a note
 */
exports.addBlock = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;
    const { type, content, metadata, afterBlockId } = req.body;

    if (!type) {
      throw new ValidationError("Block type is required");
    }

    const note = await db.UserNote.findOne({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundError("Note not found");
    }

    const blocks = note.blocks || [];
    const newBlock = {
      id: uuidv4(),
      type,
      content: content || "",
      metadata: metadata || {},
      order: blocks.length,
    };

    // Insert after specific block if specified
    if (afterBlockId) {
      const index = blocks.findIndex((b) => b.id === afterBlockId);
      if (index !== -1) {
        blocks.splice(index + 1, 0, newBlock);
        // Update order for all blocks
        blocks.forEach((b, i) => (b.order = i));
      } else {
        blocks.push(newBlock);
      }
    } else {
      blocks.push(newBlock);
    }

    await note.update({ blocks });

    res.status(201).json({
      success: true,
      data: {
        block: newBlock,
        note: note.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a specific block
 */
exports.updateBlock = async (req, res, next) => {
  try {
    const { noteId, blockId } = req.params;
    const userId = req.user.id;
    const { content, metadata, type } = req.body;

    const note = await db.UserNote.findOne({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundError("Note not found");
    }

    const blocks = note.blocks || [];
    const blockIndex = blocks.findIndex((b) => b.id === blockId);

    if (blockIndex === -1) {
      throw new NotFoundError("Block not found");
    }

    if (content !== undefined) blocks[blockIndex].content = content;
    if (metadata !== undefined) blocks[blockIndex].metadata = { ...blocks[blockIndex].metadata, ...metadata };
    if (type !== undefined) blocks[blockIndex].type = type;

    await note.update({ blocks });

    res.json({
      success: true,
      data: {
        block: blocks[blockIndex],
        note: note.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a block
 */
exports.deleteBlock = async (req, res, next) => {
  try {
    const { noteId, blockId } = req.params;
    const userId = req.user.id;

    const note = await db.UserNote.findOne({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundError("Note not found");
    }

    const blocks = note.blocks || [];
    const filteredBlocks = blocks.filter((b) => b.id !== blockId);

    // Update order
    filteredBlocks.forEach((b, i) => (b.order = i));

    await note.update({ blocks: filteredBlocks });

    res.json({
      success: true,
      message: "Block deleted",
      data: { note: note.toJSON() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reorder blocks
 */
exports.reorderBlocks = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;
    const { blockOrder } = req.body; // Array of block IDs in new order

    if (!Array.isArray(blockOrder)) {
      throw new ValidationError("blockOrder must be an array of block IDs");
    }

    const note = await db.UserNote.findOne({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundError("Note not found");
    }

    const blocks = note.blocks || [];
    const reorderedBlocks = [];

    for (let i = 0; i < blockOrder.length; i++) {
      const block = blocks.find((b) => b.id === blockOrder[i]);
      if (block) {
        block.order = i;
        reorderedBlocks.push(block);
      }
    }

    // Add any blocks that weren't in the order array
    for (const block of blocks) {
      if (!reorderedBlocks.find((b) => b.id === block.id)) {
        block.order = reorderedBlocks.length;
        reorderedBlocks.push(block);
      }
    }

    await note.update({ blocks: reorderedBlocks });

    res.json({
      success: true,
      data: { note: note.toJSON() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle star on a note
 */
exports.toggleStar = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;

    const note = await db.UserNote.findOne({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundError("Note not found");
    }

    await note.update({ isStarred: !note.isStarred });

    res.json({
      success: true,
      data: { isStarred: note.isStarred },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a note
 */
exports.deleteNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;

    const note = await db.UserNote.findOne({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundError("Note not found");
    }

    await note.destroy();

    res.json({
      success: true,
      message: "Note deleted",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Quick save from learning content
 */
exports.quickSave = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { sessionId, subtopicId, content, sourceSection, sourceType } = req.body;

    if (!sessionId || !content) {
      throw new ValidationError("sessionId and content are required");
    }

    // Validate session access
    const session = await db.StudySession.findOne({
      where: { sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError("Session not found or unauthorized");
    }

    // Find or create a note for this subtopic
    let note = await db.UserNote.findOne({
      where: {
        userId,
        sessionId,
        subtopicId: subtopicId || null,
        title: "Quick Notes",
      },
    });

    if (!note) {
      note = await db.UserNote.create({
        userId,
        sessionId,
        subtopicId: subtopicId || null,
        title: "Quick Notes",
        blocks: [],
      });
    }

    // Add the new block
    const blocks = note.blocks || [];
    const newBlock = {
      id: uuidv4(),
      type: "highlight",
      content,
      metadata: {
        originalSource: {
          type: sourceType || "learning",
          subtopicId,
          section: sourceSection,
        },
        savedAt: new Date().toISOString(),
      },
      order: blocks.length,
    };

    blocks.push(newBlock);
    await note.update({ blocks });

    res.status(201).json({
      success: true,
      message: "Saved to notes",
      data: {
        noteId: note.id,
        block: newBlock,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Save blocks for a subtopic (used by BlockEditor in main content area)
 */
exports.saveSubtopicBlocks = async (req, res, next) => {
  try {
    const { subtopicId } = req.params;
    const userId = req.user.id;
    const { blocks, sessionId } = req.body;

    if (!blocks || !Array.isArray(blocks)) {
      throw new ValidationError("blocks array is required");
    }

    // Validate subtopic access
    const subtopic = await db.Subtopic.findByPk(subtopicId, {
      include: [
        {
          model: db.Topic,
          as: "topic",
          include: [{ model: db.StudySession, as: "session" }],
        },
      ],
    });

    if (!subtopic || subtopic.topic.session.userId !== userId) {
      throw new NotFoundError("Subtopic not found or unauthorized");
    }

    // Find or create a UserNote for storing block content
    const [note, created] = await db.UserNote.findOrCreate({
      where: {
        userId,
        subtopicId,
        title: "__block_editor_content__", // Special identifier for block editor content
      },
      defaults: {
        userId,
        sessionId: sessionId || subtopic.topic.session.sessionId,
        subtopicId,
        title: "__block_editor_content__",
        blocks: [],
      },
    });

    // Update the blocks
    await note.update({ blocks });

    res.json({
      success: true,
      message: "Blocks saved",
      data: {
        noteId: note.id,
        blockCount: blocks.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get blocks for a subtopic (used by BlockEditor)
 */
exports.getSubtopicBlocks = async (req, res, next) => {
  try {
    const { subtopicId } = req.params;
    const userId = req.user.id;

    // Validate subtopic access
    const subtopic = await db.Subtopic.findByPk(subtopicId, {
      include: [
        {
          model: db.Topic,
          as: "topic",
          include: [{ model: db.StudySession, as: "session" }],
        },
      ],
    });

    if (!subtopic || subtopic.topic.session.userId !== userId) {
      throw new NotFoundError("Subtopic not found or unauthorized");
    }

    // Find the block editor note
    const note = await db.UserNote.findOne({
      where: {
        userId,
        subtopicId,
        title: "__block_editor_content__",
      },
    });

    res.json({
      success: true,
      data: {
        blocks: note ? note.blocks : null,
        noteId: note ? note.id : null,
      },
    });
  } catch (error) {
    next(error);
  }
};
