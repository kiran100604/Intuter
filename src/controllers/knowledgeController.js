const db = require("../models");
const { NotFoundError, ValidationError } = require("../utils/errors");
const { Op } = require("sequelize");

/**
 * Get all knowledge nodes for a session
 */
exports.getSessionKnowledge = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const { nodeType, importance } = req.query;

    // Validate session access
    const session = await db.StudySession.findOne({
      where: { sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError("Session not found or unauthorized");
    }

    const where = { sessionId };
    if (nodeType) where.nodeType = nodeType;
    if (importance) where.importance = importance;

    const nodes = await db.KnowledgeNode.findAll({
      where,
      include: [
        {
          model: db.Subtopic,
          as: "sourceSubtopic",
          attributes: ["id", "name"],
        },
      ],
      order: [
        ["importance", "ASC"], // core first
        ["createdAt", "ASC"],
      ],
    });

    // Group by type for easier frontend consumption
    const grouped = {
      concepts: nodes.filter((n) => n.nodeType === "concept"),
      formulas: nodes.filter((n) => n.nodeType === "formula"),
      definitions: nodes.filter((n) => n.nodeType === "definition"),
      examples: nodes.filter((n) => n.nodeType === "example"),
      tips: nodes.filter((n) => n.nodeType === "tip"),
    };

    res.json({
      success: true,
      data: {
        nodes,
        grouped,
        stats: {
          total: nodes.length,
          concepts: grouped.concepts.length,
          formulas: grouped.formulas.length,
          definitions: grouped.definitions.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get knowledge nodes for a specific subtopic
 */
exports.getSubtopicKnowledge = async (req, res, next) => {
  try {
    const { subtopicId } = req.params;
    const userId = req.user.id;

    // Validate access
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

    const nodes = await db.KnowledgeNode.findAll({
      where: { sourceSubtopicId: subtopicId },
      order: [["importance", "ASC"]],
    });

    res.json({
      success: true,
      data: { nodes },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific knowledge node by tag
 */
exports.getNodeByTag = async (req, res, next) => {
  try {
    const { sessionId, tagId } = req.params;
    const userId = req.user.id;

    // Validate session access
    const session = await db.StudySession.findOne({
      where: { sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError("Session not found or unauthorized");
    }

    // Handle URL encoding of # character
    const decodedTagId = tagId.startsWith("#") ? tagId : `#${tagId}`;

    const node = await db.KnowledgeNode.findOne({
      where: { sessionId, tagId: decodedTagId },
      include: [
        {
          model: db.Subtopic,
          as: "sourceSubtopic",
          attributes: ["id", "name"],
          include: [
            {
              model: db.Topic,
              as: "topic",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
    });

    if (!node) {
      throw new NotFoundError(`Knowledge node with tag ${decodedTagId} not found`);
    }

    // Increment reference count
    await node.increment("timesReferenced");

    res.json({
      success: true,
      data: { node },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search knowledge nodes
 */
exports.searchKnowledge = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { query, nodeType } = req.query;
    const userId = req.user.id;

    // Validate session access
    const session = await db.StudySession.findOne({
      where: { sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError("Session not found or unauthorized");
    }

    const where = {
      sessionId,
      [Op.or]: [
        { name: { [Op.iLike]: `%${query}%` } },
        { explanation: { [Op.iLike]: `%${query}%` } },
        { tagId: { [Op.iLike]: `%${query}%` } },
      ],
    };

    if (nodeType) {
      where.nodeType = nodeType;
    }

    const nodes = await db.KnowledgeNode.findAll({
      where,
      limit: 20,
      order: [
        ["importance", "ASC"],
        ["timesReferenced", "DESC"],
      ],
    });

    res.json({
      success: true,
      data: { nodes },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get prerequisites for a subtopic
 */
exports.getPrerequisites = async (req, res, next) => {
  try {
    const { subtopicId } = req.params;
    const userId = req.user.id;

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

    // Get concepts from this subtopic
    const subtopicNodes = await db.KnowledgeNode.findAll({
      where: { sourceSubtopicId: subtopicId },
    });

    // Collect all prerequisite tags
    const prerequisiteTags = new Set();
    for (const node of subtopicNodes) {
      for (const prereq of node.prerequisites || []) {
        prerequisiteTags.add(prereq);
      }
    }

    // Fetch the prerequisite nodes
    const prerequisites = await db.KnowledgeNode.findAll({
      where: {
        sessionId: subtopic.topic.session.sessionId,
        tagId: { [Op.in]: Array.from(prerequisiteTags) },
      },
      include: [
        {
          model: db.Subtopic,
          as: "sourceSubtopic",
          attributes: ["id", "name"],
        },
      ],
    });

    res.json({
      success: true,
      data: {
        prerequisites,
        count: prerequisites.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update mastery level for a concept
 */
exports.updateMastery = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const { masteryChange } = req.body; // e.g., +10 for correct answer, -5 for wrong
    const userId = req.user.id;

    const node = await db.KnowledgeNode.findByPk(nodeId, {
      include: [
        {
          model: db.StudySession,
          as: "session",
        },
      ],
    });

    if (!node || node.session.userId !== userId) {
      throw new NotFoundError("Knowledge node not found or unauthorized");
    }

    const newMastery = Math.max(0, Math.min(100, node.masteryLevel + masteryChange));
    await node.update({ masteryLevel: newMastery });

    res.json({
      success: true,
      data: {
        nodeId: node.id,
        previousMastery: node.masteryLevel - masteryChange,
        newMastery,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Track that a concept was referenced
 */
exports.trackReference = async (req, res, next) => {
  try {
    const { nodeId } = req.params;

    const node = await db.KnowledgeNode.findByPk(nodeId);
    if (!node) {
      throw new NotFoundError("Knowledge node not found");
    }

    await node.increment("timesReferenced");

    res.json({
      success: true,
      data: { timesReferenced: node.timesReferenced + 1 },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a knowledge node manually
 */
exports.createNode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { sessionId, tagId, nodeType, name, explanation, relatedNodes } = req.body;

    if (!sessionId || !tagId || !nodeType || !name) {
      throw new ValidationError("sessionId, tagId, nodeType, and name are required");
    }

    // Validate session access
    const session = await db.StudySession.findOne({
      where: { sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError("Session not found or unauthorized");
    }

    // Check for duplicate tagId
    const existing = await db.KnowledgeNode.findOne({
      where: { sessionId, tagId },
    });

    if (existing) {
      throw new ValidationError(`A node with tag ${tagId} already exists`);
    }

    const node = await db.KnowledgeNode.create({
      sessionId,
      tagId,
      nodeType,
      name,
      explanation: explanation || "",
      relatedNodes: relatedNodes || [],
      sources: [{ type: "user_created" }],
    });

    res.status(201).json({
      success: true,
      data: { node },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a knowledge node
 */
exports.updateNode = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const node = await db.KnowledgeNode.findByPk(nodeId, {
      include: [{ model: db.StudySession, as: "session" }],
    });

    if (!node || node.session.userId !== userId) {
      throw new NotFoundError("Knowledge node not found or unauthorized");
    }

    // Only allow updating certain fields
    const allowedUpdates = [
      "name",
      "explanation",
      "relatedNodes",
      "prerequisites",
      "importance",
    ];
    const filteredUpdates = {};
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    await node.update(filteredUpdates);

    res.json({
      success: true,
      data: { node: node.toJSON() },
    });
  } catch (error) {
    next(error);
  }
};
