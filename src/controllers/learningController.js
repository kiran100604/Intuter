const { Subtopic, LearningContent, SubtopicProgress } = require("../models");
const { success, error } = require("../utils/response");
const { generateContent } = require("../services/ai/contentGenerator");

// Learning content and progress controller
exports.generateLearningContent = async (req, res, next) => {
  try {
    const { subtopicId, sessionId } = req.body;
    if (!subtopicId || !sessionId)
      return error(res, "subtopicId and sessionId are required", 400);

    const subtopic = await Subtopic.findByPk(subtopicId, {
      include: [
        {
          model: require("../models").Topic,
          as: "topic",
          where: { sessionId },
        },
      ],
    });

    if (!subtopic) return error(res, "Subtopic not found", 404);

    // Initialize or get progress tracking
    const [progress] = await SubtopicProgress.findOrCreate({
      where: { subtopicId },
      defaults: {
        subtopicId,
        currentStep: "generating",
        lastAccessed: new Date(),
      },
    });

    if (progress.currentStep !== "generating") {
      progress.currentStep = "generating";
      progress.error = null; // Clear previous errors
      await progress.save();
    }

    // Start content generation in background
    setImmediate(async () => {
      try {
        console.log(
          `Generating narrative content for subtopicId: ${subtopicId}`,
        );
        await generateContent({ subtopicId });

        // Mark as completed
        progress.currentStep = "completed";
        await progress.save();
      } catch (e) {
        console.error("Error during background content generation:", e);
        progress.currentStep = "error";
        progress.error = e.message;
        await progress.save();
      }
    });

    // Return immediate response
    return success(
      res,
      {
        status: "generating",
        subtopicId,
        message: "Narrative content generation started",
      },
      "Learning content generation initiated",
    );
  } catch (err) {
    next(err);
  }
};

exports.getContentGenerationProgress = async (req, res, next) => {
  try {
    const { subtopicId } = req.params;
    if (!subtopicId) return error(res, "subtopicId is required", 400);

    const progress = await SubtopicProgress.findOne({ where: { subtopicId } });
    if (!progress) return error(res, "Progress not found", 404);

    // Get the single generated content record
    const content = await LearningContent.findOne({ where: { subtopicId } });

    const status = progress.currentStep;
    let percentage = 0;
    if (status === "completed") {
      percentage = 100;
    } else if (status === "generating") {
      percentage = 50; // In-progress
    }

    const response = {
      currentStep: status,
      status:
        status === "completed"
          ? "completed"
          : status === "error"
            ? "error"
            : "generating",
      error: progress.error,
      content: content ? content.toJSON() : null,
      progress: percentage,
    };

    res.setHeader("Cache-Control", "no-cache");
    return success(res, response, "Content generation progress fetched");
  } catch (err) {
    next(err);
  }
};

exports.getContent = async (req, res, next) => {
  try {
    const { subtopicId } = req.query;
    if (!subtopicId) return error(res, "subtopicId is required", 400);

    const content = await LearningContent.findOne({ where: { subtopicId } });

    if (!content) return error(res, "Content not found", 404);
    return success(res, { content }, "Learning content fetched");
  } catch (err) {
    next(err);
  }
};

exports.regenerateContent = async (req, res, next) => {
  // This is now an alias for the primary generation function.
  // The same body is sent, so we can just call it directly.
  return exports.generateLearningContent(req, res, next);
};

exports.getSessionProgress = async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return error(res, "sessionId is required", 400);
    // Get all subtopics for session
    const subtopics = await Subtopic.findAll({
      include: [
        {
          model: require("../models").Topic,
          as: "topic",
          where: { sessionId },
        },
      ],
    });
    const subtopicIds = subtopics.map((s) => s.id);
    const progresses = await SubtopicProgress.findAll({
      where: { subtopicId: subtopicIds },
    });
    return success(res, { progresses }, "Session progress fetched");
  } catch (err) {
    next(err);
  }
};

exports.askQuestion = async (req, res, next) => {
  // Placeholder: Not implemented in learningController. Use questionController for full logic.
  return success(res, { message: "askQuestion endpoint placeholder" });
};

exports.getQuestion = async (req, res, next) => {
  // Placeholder: Not implemented in learningController. Use questionController for full logic.
  return success(res, { message: "getQuestion endpoint placeholder" });
};

exports.provideFeedback = async (req, res, next) => {
  // Placeholder: Not implemented in learningController. Use questionController for full logic.
  return success(res, { message: "provideFeedback endpoint placeholder" });
};
