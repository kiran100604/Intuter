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
      include: [{
        model: require("../models").Topic,
        as: "topic",
        where: { sessionId }
      }]
    });

    if (!subtopic) return error(res, "Subtopic not found", 404);

    const steps = ["introduction", "understanding", "mastering"];
    const generatedContent = {};

    // Initialize or get progress tracking
    let progress = await SubtopicProgress.findOne({ where: { subtopicId } });
    if (!progress) {
      progress = await SubtopicProgress.create({
        subtopicId,
        currentStep: "introduction",
        lastAccessed: new Date()
      });
    }

    // Generate content for each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      progress.currentStep = step;
      await progress.save();

      // Return intermediate progress
      if (i === 0) {
        res.json({
          success: true,
          data: {
            status: "generating",
            currentStep: step,
            progress: 33,
            content: generatedContent
          }
        });
      }

      const contentText = await generateContent({
        subtopicName: subtopic.name,
        step,
        description: subtopic.description || "",
      });

      // Store in database
      let content = await LearningContent.findOne({
        where: { subtopicId, step },
      });
      if (content) {
        content.content = contentText;
        content.regeneratedCount += 1;
        content.generatedAt = new Date();
        await content.save();
      } else {
        content = await LearningContent.create({
          subtopicId,
          step,
          content: contentText,
        });
      }

      generatedContent[step] = contentText;

      // Send progress update
      setTimeout(() => {
        res.json({
          success: true,
          data: {
            status: "generating",
            currentStep: steps[i + 1] || step,
            progress: i === 2 ? 100 : ((i + 1) * 33),
            content: generatedContent
          }
        });
      }, 1000);
    }

    // Mark as completed
    progress.currentStep = "completed";
    await progress.save();

    return success(res, {
      status: "completed",
      content: generatedContent,
      progress: 100
    }, "Learning content generated successfully");

  } catch (err) {
    next(err);
  }
};

exports.generateContent = async (req, res, next) => {
  try {
    const { subtopicId, step } = req.body;
    if (!subtopicId || !step)
      return error(res, "subtopicId and step are required", 400);
    const subtopic = await Subtopic.findByPk(subtopicId);
    if (!subtopic) return error(res, "Subtopic not found", 404);
    const description = subtopic.description || "";
    const contentText = await generateContent({
      subtopicName: subtopic.name,
      step,
      description,
    });
    let content = await LearningContent.findOne({
      where: { subtopicId, step },
    });
    if (content) {
      content.content = contentText;
      content.regeneratedCount += 1;
      content.generatedAt = new Date();
      await content.save();
    } else {
      content = await LearningContent.create({
        subtopicId,
        step,
        content: contentText,
      });
    }
    return success(res, { content }, "Learning content generated");
  } catch (err) {
    next(err);
  }
};

exports.getContent = async (req, res, next) => {
  try {
    const { subtopicId, step } = req.query;
    if (!subtopicId || !step)
      return error(res, "subtopicId and step are required", 400);
    const content = await LearningContent.findOne({
      where: { subtopicId, step },
    });
    if (!content) return error(res, "Content not found", 404);
    return success(res, { content }, "Learning content fetched");
  } catch (err) {
    next(err);
  }
};

exports.regenerateContent = async (req, res, next) => {
  // Alias for generateContent
  return exports.generateContent(req, res, next);
};

exports.markStepComplete = async (req, res, next) => {
  try {
    const { subtopicId, step } = req.body;
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
    }
    progress.lastAccessed = now;
    await progress.save();
    return success(res, { progress }, "Step marked as complete");
  } catch (err) {
    next(err);
  }
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
