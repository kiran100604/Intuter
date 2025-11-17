const { StudySession, User, Topic, Subtopic } = require("../models");
const { success, error } = require("../utils/response");
const { ValidationError } = require("../utils/errors");
const { extractTextFromPDF } = require("../services/file/pdfExtractor");
const { extractTextFromDOCX } = require("../services/file/docxExtractor");
const { generateBlueprint } = require("../services/ai/blueprintGenerator");
const path = require("path");

// Session management controller skeleton
exports.createSession = async (req, res, next) => {
  try {
    const { subjectName, goal } = req.body;
    if (!subjectName || !goal)
      throw new ValidationError("Subject name and goal are required");

    let courseOutlineFile = null;
    let courseOutlineText = "";

    // Handle file upload if provided
    if (req.file) {
      courseOutlineFile = req.file.path;

      if (req.file.mimetype === "application/pdf") {
        courseOutlineText = await extractTextFromPDF(req.file.path);
      } else if (
        req.file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        courseOutlineText = await extractTextFromDOCX(req.file.path);
      } else {
        return error(res, "Unsupported file type. Use PDF or DOCX", 400);
      }
    }

    const session = await StudySession.create({
      userId: req.user.id,
      sessionId: `sess_${Math.random().toString(36).substr(2, 8)}`,
      subjectName,
      goal,
      courseOutlineFile,
      courseOutlineText,
      status: courseOutlineText ? "generating_blueprint" : "setup",
      blueprintGenerated: false,
      createdDate: new Date(),
      lastAccessed: new Date(),
    });

    // Auto-generate blueprint if PDF content is available
    if (courseOutlineText) {
      try {
        const blueprint = await generateBlueprint({
          subjectName: session.subjectName,
          goal: session.goal,
          outlineText: session.courseOutlineText,
        });

        // Save topics and subtopics
        for (const topicData of blueprint.topics) {
          const topic = await Topic.create({
            sessionId: session.id,
            name: topicData.name,
            description: topicData.description,
            prerequisites: topicData.prerequisites,
            difficultyLevel: topicData.difficultyLevel,
          });
          for (const subtopicData of topicData.subtopics) {
            await Subtopic.create({
              topicId: topic.id,
              name: subtopicData.name,
              description: subtopicData.description,
              estimatedDuration: subtopicData.estimatedDuration,
            });
          }
        }

        session.blueprintGenerated = true;
        session.status = "ready";
        await session.save();

        return success(res, {
          session: {
            ...session.toJSON(),
            topicCount: blueprint.topics.length,
            subtopicCount: blueprint.topics.reduce((sum, topic) => sum + topic.subtopics.length, 0)
          }
        }, "Session created and topics generated successfully", 201);
      } catch (blueprintError) {
        console.error('Blueprint generation failed:', blueprintError);
        session.status = "outline_ready";
        await session.save();
        return success(res, { session, error: "Topic generation failed, you can try again later" }, "Session created with outline uploaded", 201);
      }
    }

    return success(res, { session }, "Session created", 201);
  } catch (err) {
    next(err);
  }
};
exports.getSessions = async (req, res, next) => {
  try {
    const sessions = await StudySession.findAll({
      where: { userId: req.user.id },
      order: [["lastAccessed", "DESC"]],
    });
    return success(res, { sessions }, "Sessions fetched");
  } catch (err) {
    next(err);
  }
};

exports.getSessionDetails = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await StudySession.findOne({
      where: { sessionId, userId: req.user.id },
      include: [
        {
          model: require("../models").Topic,
          as: "topics",
          include: [{ model: require("../models").Subtopic, as: "subtopics" }],
        },
      ],
    });
    if (!session) return error(res, "Session not found", 404);
    return success(res, { session }, "Session details fetched");
  } catch (err) {
    next(err);
  }
};

exports.updateSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { goal, currentTopicId, currentSubtopicId, status } = req.body;
    const session = await StudySession.findOne({
      where: { sessionId, userId: req.user.id },
    });
    if (!session) return error(res, "Session not found", 404);
    if (goal) session.goal = goal;
    if (currentTopicId !== undefined) session.currentTopicId = currentTopicId;
    if (currentSubtopicId !== undefined)
      session.currentSubtopicId = currentSubtopicId;
    if (status) session.status = status;
    session.lastAccessed = new Date();
    await session.save();
    return success(res, { session }, "Session updated");
  } catch (err) {
    next(err);
  }
};

exports.deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await StudySession.findOne({
      where: { sessionId, userId: req.user.id },
    });
    if (!session) return error(res, "Session not found", 404);
    await session.destroy();
    return success(res, {}, "Session deleted");
  } catch (err) {
    next(err);
  }
};

exports.uploadOutline = async (req, res, next) => {
  try {
    if (!req.file) throw new ValidationError("No file uploaded");

    const { sessionId } = req.params;
    const session = await StudySession.findOne({
      where: { sessionId, userId: req.user.id },
    });
    if (!session) return error(res, "Session not found", 404);

    let text = "";
    if (req.file.mimetype === "application/pdf") {
      text = await extractTextFromPDF(req.file.path);
    } else if (
      req.file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      text = await extractTextFromDOCX(req.file.path);
    } else {
      return error(res, "Unsupported file type", 400);
    }

    session.courseOutlineFile = req.file.path;
    session.courseOutlineText = text;
    await session.save();

    return success(
      res,
      { message: "Outline uploaded and text extracted successfully.", text },
      "Outline processed",
    );
  } catch (err) {
    next(err);
  }
};

exports.generateBlueprint = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await StudySession.findOne({
      where: { sessionId, userId: req.user.id },
    });
    if (!session) return error(res, "Session not found", 404);
    if (!session.courseOutlineText)
      return error(res, "No outline text found for this session", 400);
    const blueprint = await generateBlueprint({
      subjectName: session.subjectName,
      goal: session.goal,
      outlineText: session.courseOutlineText,
    });
    // Save topics and subtopics
    for (const topicData of blueprint.topics) {
      const topic = await Topic.create({
        sessionId: session.id,
        name: topicData.name,
        description: topicData.description,
        prerequisites: topicData.prerequisites,
        difficultyLevel: topicData.difficultyLevel,
      });
      for (const subtopicData of topicData.subtopics) {
        await Subtopic.create({
          topicId: topic.id,
          name: subtopicData.name,
          description: subtopicData.description,
          estimatedDuration: subtopicData.estimatedDuration,
        });
      }
    }
    session.blueprintGenerated = true;
    await session.save();
    return success(res, { blueprint }, "Blueprint generated and saved");
  } catch (err) {
    next(err);
  }
};

exports.getSessionStats = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await StudySession.findOne({
      where: { sessionId, userId: req.user.id },
    });
    if (!session) return error(res, "Session not found", 404);
    const topicCount = await Topic.count({ where: { sessionId: session.id } });
    const subtopicCount = await Subtopic.count({
      where: {
        topicId: (
          await Topic.findAll({
            where: { sessionId: session.id },
            attributes: ["id"],
          })
        ).map((t) => t.id),
      },
    });
    return success(res, { topicCount, subtopicCount }, "Session stats fetched");
  } catch (err) {
    next(err);
  }
};

exports.getSessionGenerationStatus = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await StudySession.findOne({
      where: { sessionId, userId: req.user.id },
    });
    if (!session) return error(res, "Session not found", 404);

    let topicCount = 0;
    let subtopicCount = 0;
    let estimatedTimeRemaining = null;

    if (session.blueprintGenerated) {
      topicCount = await Topic.count({ where: { sessionId: session.id } });
      subtopicCount = await Subtopic.count({
        where: {
          topicId: (
            await Topic.findAll({
              where: { sessionId: session.id },
              attributes: ["id"],
            })
          ).map((t) => t.id),
        },
      });
    } else if (session.status === "generating_blueprint") {
      // Estimate time remaining for blueprint generation
      estimatedTimeRemaining = "30-60 seconds";
    }

    const response = {
      sessionId: session.sessionId,
      status: session.status,
      blueprintGenerated: session.blueprintGenerated,
      topicCount,
      subtopicCount,
      estimatedTimeRemaining,
      progress: session.blueprintGenerated ? 100 : (session.status === "generating_blueprint" ? 50 : 0)
    };

    return success(res, response, "Session generation status fetched");
  } catch (err) {
    next(err);
  }
};
