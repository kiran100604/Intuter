const { StudySession, User, Topic, Subtopic } = require("../models");
const { success, error } = require("../utils/response");
const { ValidationError } = require("../utils/errors");
const { extractTextFromPDF } = require("../services/file/pdfExtractor");
const { extractTextFromDOCX } = require("../services/file/docxExtractor");
const { generateBlueprint } = require("../services/ai/blueprintGenerator");
const path = require("path");

const generateBlueprintForSession = async (session) => {
  const blueprint = await generateBlueprint({
    subjectName: session.subjectName,
    goal: session.goal,
    outlineText: session.courseOutlineText,
  });

  // Save topics and subtopics
  for (const topicData of blueprint.topics) {
    const topic = await Topic.create({
      sessionId: session.sessionId,
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
  return blueprint;
};

const generateBlueprintInBackground = async (sessionId) => {
  console.log("=== Starting background blueprint generation ===");
  console.log("Session ID received:", sessionId, "Type:", typeof sessionId);

  // Add validation
  if (!sessionId) {
    console.error("ERROR: sessionId is undefined or null!");
    return;
  }

  try {
    // Fetch a fresh session instance from database
    console.log("Attempting to fetch session...");
    const session = await StudySession.findOne({ where: { sessionId } });

    if (!session) {
      console.error(
        `Session with sessionId ${sessionId} not found in database`,
      );
      return;
    }
    console.log("Session found successfully");
    console.log("Session data:", {
      id: session.id,
      sessionId: session.sessionId,
      status: session.status,
      subjectName: session.subjectName,
    });

    console.log("Starting blueprint generation...");
    await generateBlueprintForSession(session);
    console.log("Blueprint generation completed successfully");

    // Refetch to get latest state
    console.log("Refetching session to update status...");
    const updatedSession = await StudySession.findOne({ where: { sessionId } });

    if (!updatedSession) {
      console.error("Could not refetch session after blueprint generation");
      return;
    }

    console.log("Setting status to ready...");
    updatedSession.status = "ready";
    await updatedSession.save();
    console.log("Status updated to ready successfully");
  } catch (blueprintError) {
    console.error("=== Blueprint generation error ===");
    console.error("Error name:", blueprintError.name);
    console.error("Error message:", blueprintError.message);
    console.error("Error stack:", blueprintError.stack);

    // Try to update session status to failed
    try {
      console.log("Attempting to set status to generation_failed...");
      const session = await StudySession.findOne({ where: { sessionId } });

      if (session) {
        session.status = "generation_failed";
        await session.save();
        console.log("Status set to generation_failed");
      } else {
        console.error("Could not find session to set error status");
      }
    } catch (saveError) {
      console.error("Failed to save error status:", saveError.message);
      console.error("Save error stack:", saveError.stack);
    }
  }

  console.log("=== Background blueprint generation ended ===");
};

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
      status: "generating_blueprint",
      blueprintGenerated: false,
      createdDate: new Date(),
      lastAccessed: new Date(),
    });

    console.log(
      "Session created with ID:",
      session.id,
      "SessionId:",
      session.sessionId,
    );

    // Pass the numeric ID to background function
    setImmediate(() => {
      generateBlueprintInBackground(session.sessionId).catch((err) => {
        console.error("Uncaught error in background generation:", err);
      });
    });

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

    const blueprint = await generateBlueprintForSession(session);
    session.status = "ready";
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
    const topicCount = await Topic.count({
      where: { sessionId: session.sessionId },
    });
    const subtopicCount = await Subtopic.count({
      where: {
        topicId: (
          await Topic.findAll({
            where: { sessionId: session.sessionId },
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
      topicCount = await Topic.count({
        where: { sessionId: session.sessionId },
      });
      subtopicCount = await Subtopic.count({
        where: {
          topicId: (
            await Topic.findAll({
              where: { sessionId: session.sessionId },
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
      progress: session.blueprintGenerated
        ? 100
        : session.status === "generating_blueprint"
          ? 50
          : 0,
    };

    res.setHeader("Cache-Control", "no-cache");
    return success(res, response, "Session generation status fetched");
  } catch (err) {
    next(err);
  }
};
