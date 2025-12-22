const { Subtopic, LearningContent, SubtopicProgress, Topic, ConceptMap, StudySummary, UserQuestion } = require("../models");
const { success, error } = require("../utils/response");
const {
  generateContent,
  generateContentWithConcepts,
  regenerateWithFeedback,
  addMissingContent,
  TEACHING_STYLES
} = require("../services/ai/contentGenerator");
const { answerQuestion, summarizeConversation, shouldSummarizeConversation } = require("../services/ai/questionAnswerer");

/**
 * Generate learning content for a subtopic step
 * Now supports teaching styles and context-aware generation
 */
exports.generateContent = async (req, res, next) => {
  try {
    const { subtopicId, step, teachingStyle, userInstructions } = req.body;
    if (!subtopicId || !step)
      return error(res, "subtopicId and step are required", 400);

    const subtopic = await Subtopic.findByPk(subtopicId, {
      include: [{ model: Topic, as: 'topic' }]
    });
    if (!subtopic) return error(res, "Subtopic not found", 404);

    const startTime = Date.now();

    // Generate content with context and concepts
    const result = await generateContentWithConcepts({
      subtopicName: subtopic.name,
      step,
      description: subtopic.description || "",
      sessionId: subtopic.topic?.sessionId,
      subtopicId,
      teachingStyle,
      userInstructions
    });

    const generationTime = (Date.now() - startTime) / 1000;

    // Save or update content
    let content = await LearningContent.findOne({
      where: { subtopicId, step },
    });

    if (content) {
      content.content = result.content;
      content.regeneratedCount += 1;
      content.generatedAt = new Date();
      content.contextUsed = result.metadata?.contextUsed || {};
      content.generationTimeSeconds = generationTime;
      await content.save();
    } else {
      content = await LearningContent.create({
        subtopicId,
        step,
        content: result.content,
        contextUsed: result.metadata?.contextUsed || {},
        generationTimeSeconds: generationTime
      });
    }

    // Save extracted concepts
    if (result.extractedConcepts?.length > 0) {
      const sessionId = subtopic.topic?.sessionId;
      for (const concept of result.extractedConcepts) {
        await ConceptMap.findOrCreate({
          where: {
            sessionId,
            subtopicId,
            conceptName: concept.concept_name
          },
          defaults: {
            conceptExplanation: concept.brief_explanation,
            importance: concept.importance,
            learnedAt: new Date()
          }
        });
      }
    }

    return success(res, {
      content,
      teachingStyle: result.teachingStyle,
      extractedConcepts: result.extractedConcepts,
      tokensUsed: result.metadata?.tokensUsed
    }, "Learning content generated");
  } catch (err) {
    next(err);
  }
};

/**
 * Regenerate content with user feedback
 * Allows students to request improvements
 */
exports.regenerateWithFeedback = async (req, res, next) => {
  try {
    const { subtopicId, step, feedback } = req.body;
    if (!subtopicId || !step || !feedback)
      return error(res, "subtopicId, step, and feedback are required", 400);

    const subtopic = await Subtopic.findByPk(subtopicId, {
      include: [{ model: Topic, as: 'topic' }]
    });
    if (!subtopic) return error(res, "Subtopic not found", 404);

    const existingContent = await LearningContent.findOne({
      where: { subtopicId, step }
    });
    if (!existingContent) return error(res, "No existing content to improve", 404);

    const result = await regenerateWithFeedback({
      subtopicName: subtopic.name,
      step,
      description: subtopic.description || "",
      originalContent: existingContent.content,
      userFeedback: feedback,
      sessionId: subtopic.topic?.sessionId,
      subtopicId
    });

    // Update content
    existingContent.content = result.content;
    existingContent.regeneratedCount += 1;
    existingContent.generatedAt = new Date();
    existingContent.feedbackHistory = [
      ...(existingContent.feedbackHistory || []),
      { feedback, timestamp: new Date() }
    ];
    await existingContent.save();

    return success(res, {
      content: existingContent,
      feedbackAddressed: feedback
    }, "Content regenerated based on feedback");
  } catch (err) {
    next(err);
  }
};

/**
 * Add missing content to an existing subtopic
 * Allows students to request additional topics be covered
 */
exports.addMissingContent = async (req, res, next) => {
  try {
    const { subtopicId, step, missingTopic } = req.body;
    if (!subtopicId || !step || !missingTopic)
      return error(res, "subtopicId, step, and missingTopic are required", 400);

    const subtopic = await Subtopic.findByPk(subtopicId, {
      include: [{ model: Topic, as: 'topic' }]
    });
    if (!subtopic) return error(res, "Subtopic not found", 404);

    const existingContent = await LearningContent.findOne({
      where: { subtopicId, step }
    });
    if (!existingContent) return error(res, "No existing content to supplement", 404);

    const result = await addMissingContent({
      subtopicName: subtopic.name,
      step,
      existingContent: existingContent.content,
      missingTopic,
      sessionId: subtopic.topic?.sessionId,
      subtopicId
    });

    // Append the additional content
    existingContent.content = existingContent.content + "\n\n---\n\n## Additional Content\n\n" + result.additionalContent;
    existingContent.regeneratedCount += 1;
    existingContent.generatedAt = new Date();
    existingContent.addedTopics = [
      ...(existingContent.addedTopics || []),
      { topic: missingTopic, timestamp: new Date() }
    ];
    await existingContent.save();

    return success(res, {
      content: existingContent,
      addedContent: result.additionalContent,
      addedTopic: missingTopic
    }, "Missing content added");
  } catch (err) {
    next(err);
  }
};

/**
 * Get learning content for a subtopic step
 */
exports.getContent = async (req, res, next) => {
  try {
    const { subtopicId, step } = req.query;
    if (!subtopicId || !step)
      return error(res, "subtopicId and step are required", 400);

    const content = await LearningContent.findOne({
      where: { subtopicId, step },
    });
    if (!content) return error(res, "Content not found", 404);

    // Get related concepts for context
    const subtopic = await Subtopic.findByPk(subtopicId, {
      include: [{ model: Topic, as: 'topic' }]
    });

    const concepts = await ConceptMap.findAll({
      where: { subtopicId },
      order: [['importance', 'DESC']]
    });

    return success(res, {
      content,
      concepts,
      topicName: subtopic?.topic?.name
    }, "Learning content fetched");
  } catch (err) {
    next(err);
  }
};

/**
 * Mark a learning step as complete
 * Also generates summary and extracts key concepts
 */
exports.markStepComplete = async (req, res, next) => {
  try {
    const { subtopicId, step, learningSummary, keyConcepts } = req.body;
    if (!subtopicId || !step)
      return error(res, "subtopicId and step are required", 400);

    let progress = await SubtopicProgress.findOne({ where: { subtopicId } });
    if (!progress) {
      progress = await SubtopicProgress.create({ subtopicId });
    }

    const now = new Date();

    if (step === "introduction") {
      progress.introCompleted = true;
      progress.introCompletedAt = now;
      progress.currentStep = "understanding";
    } else if (step === "understanding") {
      progress.understandingCompleted = true;
      progress.understandingCompletedAt = now;
      progress.currentStep = "mastering";
    } else if (step === "mastering") {
      progress.masteringCompleted = true;
      progress.masteringCompletedAt = now;
      progress.currentStep = "completed";

      // Save user's learning summary and concepts when completed
      if (learningSummary) {
        progress.learningSummary = learningSummary;
      }
      if (keyConcepts) {
        progress.keyConcepts = keyConcepts;
      }
    }

    progress.lastAccessed = now;
    await progress.save();

    return success(res, { progress }, "Step marked as complete");
  } catch (err) {
    next(err);
  }
};

/**
 * Get session-wide progress
 */
exports.getSessionProgress = async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return error(res, "sessionId is required", 400);

    const topics = await Topic.findAll({
      where: { sessionId },
      include: [{
        model: Subtopic,
        as: 'subtopics',
        include: [{ model: SubtopicProgress, as: 'progress' }]
      }]
    });

    // Calculate overall progress
    let totalSubtopics = 0;
    let completedSubtopics = 0;
    let inProgressSubtopics = 0;

    topics.forEach(topic => {
      topic.subtopics?.forEach(subtopic => {
        totalSubtopics++;
        if (subtopic.progress?.currentStep === 'completed') {
          completedSubtopics++;
        } else if (subtopic.progress?.currentStep !== 'not_started') {
          inProgressSubtopics++;
        }
      });
    });

    return success(res, {
      topics,
      stats: {
        totalSubtopics,
        completedSubtopics,
        inProgressSubtopics,
        notStarted: totalSubtopics - completedSubtopics - inProgressSubtopics,
        percentComplete: totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0
      }
    }, "Session progress fetched");
  } catch (err) {
    next(err);
  }
};

/**
 * Ask a question with context awareness
 */
exports.askQuestion = async (req, res, next) => {
  try {
    const { sessionId, subtopicId, question } = req.body;
    if (!sessionId || !question)
      return error(res, "sessionId and question are required", 400);

    // Get recent conversation history
    const conversationHistory = await UserQuestion.findAll({
      where: { sessionId },
      order: [['askedAt', 'DESC']],
      limit: 10
    });

    const result = await answerQuestion({
      question,
      sessionId,
      subtopicId,
      conversationHistory: conversationHistory.reverse()
    });

    // Save the Q&A
    const userQuestion = await UserQuestion.create({
      sessionId,
      subtopicId,
      question,
      answer: result.answer,
      contextTopics: result.contextUsed,
      askedAt: new Date()
    });

    // Check if we should suggest summarization
    let summarySuggestion = null;
    if (result.shouldSummarize || shouldSummarizeConversation(conversationHistory)) {
      summarySuggestion = "Consider summarizing this conversation to optimize context.";
    }

    return success(res, {
      userQuestion,
      relatedConcepts: result.relatedConcepts,
      studyRecommendations: result.studyRecommendations,
      summarySuggestion
    }, "Question answered");
  } catch (err) {
    next(err);
  }
};

/**
 * Summarize conversation to optimize token usage
 */
exports.summarizeChat = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId)
      return error(res, "sessionId is required", 400);

    const conversationHistory = await UserQuestion.findAll({
      where: { sessionId },
      order: [['askedAt', 'ASC']]
    });

    const summary = await summarizeConversation(conversationHistory, sessionId);

    if (summary) {
      // Store summary
      await StudySummary.create({
        sessionId,
        summaryText: summary.summary,
        keyPoints: [],
        summaryType: 'conversation',
        originalCount: summary.originalCount
      });

      return success(res, { summary }, "Conversation summarized");
    }

    return error(res, "Not enough conversation history to summarize", 400);
  } catch (err) {
    next(err);
  }
};

/**
 * Get available teaching styles
 */
exports.getTeachingStyles = async (req, res, next) => {
  try {
    return success(res, {
      styles: Object.values(TEACHING_STYLES),
      descriptions: {
        first_principles: "Start from fundamentals, build understanding layer by layer",
        practical: "Focus on real-world applications and hands-on examples",
        academic: "Rigorous, formal approach with proofs and precise definitions",
        intuitive: "Build mental models and deep conceptual understanding"
      }
    }, "Teaching styles fetched");
  } catch (err) {
    next(err);
  }
};

/**
 * Save user's custom notes for a subtopic
 */
exports.saveUserNotes = async (req, res, next) => {
  try {
    const { subtopicId, notes, resources } = req.body;
    if (!subtopicId)
      return error(res, "subtopicId is required", 400);

    const subtopic = await Subtopic.findByPk(subtopicId, {
      include: [{ model: Topic, as: 'topic' }]
    });
    if (!subtopic) return error(res, "Subtopic not found", 404);

    const sessionId = subtopic.topic?.sessionId;

    // Find or create study summary for this subtopic
    let summary = await StudySummary.findOne({
      where: { sessionId, subtopicId }
    });

    if (summary) {
      summary.userNotes = notes;
      summary.userResources = resources;
      summary.updatedAt = new Date();
      await summary.save();
    } else {
      summary = await StudySummary.create({
        sessionId,
        subtopicId,
        userNotes: notes,
        userResources: resources
      });
    }

    return success(res, { summary }, "Notes saved");
  } catch (err) {
    next(err);
  }
};

/**
 * Add a custom subtopic to a topic
 */
exports.addCustomSubtopic = async (req, res, next) => {
  try {
    const { topicId, name, description } = req.body;
    if (!topicId || !name)
      return error(res, "topicId and name are required", 400);

    const topic = await Topic.findByPk(topicId);
    if (!topic) return error(res, "Topic not found", 404);

    // Get the highest order number
    const maxOrder = await Subtopic.max('order', { where: { topicId } }) || 0;

    const subtopic = await Subtopic.create({
      topicId,
      name,
      description: description || "",
      order: maxOrder + 1,
      isCustom: true
    });

    return success(res, { subtopic }, "Custom subtopic added");
  } catch (err) {
    next(err);
  }
};

/**
 * Add a custom topic to a session
 */
exports.addCustomTopic = async (req, res, next) => {
  try {
    const { sessionId, name, description, subtopics } = req.body;
    if (!sessionId || !name)
      return error(res, "sessionId and name are required", 400);

    const topic = await Topic.create({
      sessionId,
      name,
      description: description || "",
      isCustom: true
    });

    // Create subtopics if provided
    if (subtopics && Array.isArray(subtopics)) {
      for (let i = 0; i < subtopics.length; i++) {
        await Subtopic.create({
          topicId: topic.id,
          name: subtopics[i].name,
          description: subtopics[i].description || "",
          order: i + 1,
          isCustom: true
        });
      }
    }

    const fullTopic = await Topic.findByPk(topic.id, {
      include: [{ model: Subtopic, as: 'subtopics' }]
    });

    return success(res, { topic: fullTopic }, "Custom topic added");
  } catch (err) {
    next(err);
  }
};

// Legacy aliases
exports.regenerateContent = exports.generateContent;

exports.getQuestion = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const question = await UserQuestion.findByPk(questionId);
    if (!question) return error(res, "Question not found", 404);
    return success(res, { question }, "Question fetched");
  } catch (err) {
    next(err);
  }
};

exports.provideFeedback = async (req, res, next) => {
  try {
    const { questionId, helpful } = req.body;
    const question = await UserQuestion.findByPk(questionId);
    if (!question) return error(res, "Question not found", 404);
    question.helpful = helpful;
    await question.save();
    return success(res, { question }, "Feedback recorded");
  } catch (err) {
    next(err);
  }
};
