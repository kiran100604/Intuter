const db = require("../models");
const { NotFoundError, ValidationError } = require("../utils/errors");
const contentGapService = require("../services/ai/contentGapService");

/**
 * Create a new content request
 */
exports.createRequest = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { sessionId, subtopicId, requestType, description, preferredStyle } = req.body;

    if (!sessionId || !requestType || !description) {
      throw new ValidationError("sessionId, requestType, and description are required");
    }

    // Validate session belongs to user
    const session = await db.StudySession.findOne({
      where: { sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError("Session not found or unauthorized");
    }

    const request = await db.ContentRequest.create({
      sessionId,
      subtopicId: subtopicId || null,
      userId,
      requestType,
      description,
      preferredStyle: preferredStyle || null,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Content request submitted successfully",
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all requests for a session
 */
exports.getSessionRequests = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Validate access
    const session = await db.StudySession.findOne({
      where: { sessionId, userId },
    });

    if (!session) {
      throw new NotFoundError("Session not found or unauthorized");
    }

    const requests = await db.ContentRequest.findAll({
      where: { sessionId },
      include: [
        {
          model: db.Subtopic,
          as: "subtopic",
          attributes: ["id", "name"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      data: { requests },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific request
 */
exports.getRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await db.ContentRequest.findOne({
      where: { id: requestId, userId },
      include: [
        {
          model: db.Subtopic,
          as: "subtopic",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!request) {
      throw new NotFoundError("Request not found");
    }

    res.json({
      success: true,
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process a pending request - generate content using AI
 */
exports.processRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await db.ContentRequest.findOne({
      where: { id: requestId, userId },
      include: [
        {
          model: db.Subtopic,
          as: "subtopic",
          include: [
            {
              model: db.Topic,
              as: "topic",
              include: [{ model: db.StudySession, as: "session" }],
            },
          ],
        },
      ],
    });

    if (!request) {
      throw new NotFoundError("Request not found");
    }

    if (request.status === "integrated") {
      throw new ValidationError("Request has already been integrated");
    }

    // Update status to processing
    await request.update({ status: "processing" });

    try {
      // Get existing learning content for context
      let existingContent = null;
      if (request.subtopicId) {
        existingContent = await db.LearningContent.findOne({
          where: { subtopicId: request.subtopicId },
        });
      }

      // Generate content based on request type
      const generatedContent = await contentGapService.generateGapContent({
        request: request.toJSON(),
        existingContent: existingContent ? existingContent.toJSON() : null,
        subtopic: request.subtopic ? request.subtopic.toJSON() : null,
      });

      // Update request with AI response
      await request.update({
        aiGeneratedContent: generatedContent,
        status: "pending", // Back to pending for user review before integration
        processedAt: new Date(),
      });

      res.json({
        success: true,
        message: "Content generated successfully",
        data: {
          request: request.toJSON(),
          generatedContent,
        },
      });
    } catch (aiError) {
      await request.update({
        status: "pending",
        processingNotes: `Generation failed: ${aiError.message}`,
      });
      throw aiError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Integrate processed content into learning content
 */
exports.integrateContent = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;
    const { mergeStrategy = "append" } = req.body; // append, prepend, replace_section

    const request = await db.ContentRequest.findOne({
      where: { id: requestId, userId },
    });

    if (!request) {
      throw new NotFoundError("Request not found");
    }

    if (!request.aiGeneratedContent) {
      throw new ValidationError("Request has no generated content to integrate");
    }

    if (!request.subtopicId) {
      // For new subtopic requests, create the subtopic first
      // This would require more complex logic
      throw new ValidationError("New subtopic integration not yet implemented");
    }

    // Get or create learning content
    let learningContent = await db.LearningContent.findOne({
      where: { subtopicId: request.subtopicId },
    });

    if (!learningContent) {
      learningContent = await db.LearningContent.create({
        subtopicId: request.subtopicId,
        theory: "",
        story: "",
        summary: "",
        practice: [],
      });
    }

    // Merge the generated content based on strategy
    const generated = request.aiGeneratedContent;
    let updatedTheory = learningContent.theory || "";

    if (mergeStrategy === "append") {
      updatedTheory = `${updatedTheory}\n\n---\n\n**Additional Content (based on your request):**\n\n${generated.content}`;
    } else if (mergeStrategy === "prepend") {
      updatedTheory = `**Additional Context:**\n\n${generated.content}\n\n---\n\n${updatedTheory}`;
    }

    // Update learning content
    await learningContent.update({
      theory: updatedTheory,
      regeneratedCount: (learningContent.regeneratedCount || 0) + 1,
    });

    // Mark request as integrated
    await request.update({
      status: "integrated",
      integratedIntoContentId: learningContent.id,
    });

    // Extract and save any new concepts to KnowledgeGraph
    if (generated.newConcepts && generated.newConcepts.length > 0) {
      const session = await db.StudySession.findOne({
        include: [
          {
            model: db.Topic,
            as: "topics",
            include: [
              {
                model: db.Subtopic,
                as: "subtopics",
                where: { id: request.subtopicId },
              },
            ],
          },
        ],
      });

      if (session) {
        for (const concept of generated.newConcepts) {
          await db.KnowledgeNode.upsert({
            sessionId: session.sessionId,
            tagId: concept.tagId,
            nodeType: concept.type || "concept",
            name: concept.name,
            explanation: concept.explanation,
            sourceSubtopicId: request.subtopicId,
            sources: [{ type: "content_request", requestId: request.id }],
          });
        }
      }
    }

    res.json({
      success: true,
      message: "Content integrated successfully",
      data: {
        request: request.toJSON(),
        learningContent: learningContent.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Quick "Explain Differently" - regenerate explanation with different style
 */
exports.explainDifferently = async (req, res, next) => {
  try {
    const { subtopicId, section, preferredStyle, specificFeedback } = req.body;
    const userId = req.user.id;

    if (!subtopicId || !preferredStyle) {
      throw new ValidationError("subtopicId and preferredStyle are required");
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

    // Get existing content
    const learningContent = await db.LearningContent.findOne({
      where: { subtopicId },
    });

    if (!learningContent) {
      throw new NotFoundError("No content found for this subtopic");
    }

    // Generate alternative explanation
    const alternativeExplanation = await contentGapService.generateAlternativeExplanation({
      subtopic: subtopic.toJSON(),
      existingContent: learningContent.toJSON(),
      preferredStyle,
      section: section || "theory",
      specificFeedback,
    });

    res.json({
      success: true,
      message: "Alternative explanation generated",
      data: {
        alternativeExplanation,
        style: preferredStyle,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * AI Action on a specific block - explain, simplify, expand, add examples, regenerate
 */
exports.aiAction = async (req, res, next) => {
  try {
    const { action, content, blockType, subtopicId, sessionId } = req.body;
    const userId = req.user.id;

    if (!action || !content) {
      throw new ValidationError("action and content are required");
    }

    // Validate session access if provided
    if (sessionId) {
      const session = await db.StudySession.findOne({
        where: { sessionId, userId },
      });
      if (!session) {
        throw new NotFoundError("Session not found or unauthorized");
      }
    }

    // Get context if subtopicId provided
    let context = "";
    if (subtopicId) {
      const subtopic = await db.Subtopic.findByPk(subtopicId, {
        include: [{ model: db.Topic, as: "topic" }],
      });
      if (subtopic) {
        context = `Topic: ${subtopic.topic?.name || "Unknown"}, Subtopic: ${subtopic.name}`;
      }
    }

    // Generate content based on action
    const aiContent = await contentGapService.handleBlockAction({
      action,
      content,
      blockType,
      context,
    });

    res.json({
      success: true,
      message: "AI action completed",
      data: {
        content: aiContent,
        action,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate new content with AI based on user prompt
 */
exports.generateContent = async (req, res, next) => {
  try {
    const { prompt, style, subtopicId, sessionId } = req.body;
    const userId = req.user.id;

    if (!prompt) {
      throw new ValidationError("prompt is required");
    }

    // Validate session access if provided
    if (sessionId) {
      const session = await db.StudySession.findOne({
        where: { sessionId, userId },
      });
      if (!session) {
        throw new NotFoundError("Session not found or unauthorized");
      }
    }

    // Get context if subtopicId provided
    let context = "";
    if (subtopicId) {
      const subtopic = await db.Subtopic.findByPk(subtopicId, {
        include: [{ model: db.Topic, as: "topic" }],
      });
      if (subtopic) {
        context = `Topic: ${subtopic.topic?.name || "Unknown"}, Subtopic: ${subtopic.name}`;
      }
    }

    // Generate content
    const generatedContent = await contentGapService.generateFromPrompt({
      prompt,
      style: style || "first_principles",
      context,
    });

    res.json({
      success: true,
      message: "Content generated successfully",
      data: {
        content: generatedContent,
        style,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Explain an uploaded image with AI
 */
exports.explainImage = async (req, res, next) => {
  try {
    const { imageData, subtopicId, sessionId } = req.body;
    const userId = req.user.id;

    if (!imageData) {
      throw new ValidationError("imageData is required");
    }

    // Validate session access if provided
    if (sessionId) {
      const session = await db.StudySession.findOne({
        where: { sessionId, userId },
      });
      if (!session) {
        throw new NotFoundError("Session not found or unauthorized");
      }
    }

    // Get context if subtopicId provided
    let context = "";
    if (subtopicId) {
      const subtopic = await db.Subtopic.findByPk(subtopicId, {
        include: [{ model: db.Topic, as: "topic" }],
      });
      if (subtopic) {
        context = `Topic: ${subtopic.topic?.name || "Unknown"}, Subtopic: ${subtopic.name}`;
      }
    }

    // Generate explanation for the image
    const explanation = await contentGapService.explainImage({
      imageData,
      context,
    });

    res.json({
      success: true,
      message: "Image explanation generated",
      data: {
        explanation,
      },
    });
  } catch (error) {
    next(error);
  }
};
