const db = require("../../models");
const { NotFoundError } = require("../../utils/errors");

/**
 * Gathers all necessary context for generating the next piece of learning content.
 * This function is the core of maintaining narrative and conceptual continuity.
 * @param {number} subtopicId - The ID of the subtopic for which content is being generated.
 * @returns {Promise<object>} - A comprehensive context object.
 */
exports.gatherContext = async (subtopicId) => {
  const subtopic = await db.Subtopic.findByPk(subtopicId, {
    include: [{ model: db.Topic, as: "topic" }],
  });

  if (!subtopic) {
    throw new NotFoundError("Subtopic not found");
  }

  const topic = subtopic.topic;
  const session = await db.StudySession.findOne({
    where: { sessionId: topic.sessionId },
  });

  if (!session) {
    throw new NotFoundError("Session not found");
  }

  // Get the full context memory for the session
  const contextMemory = await db.ContextMemory.findOrCreate({
    where: { sessionId: session.sessionId },
    defaults: { sessionId: session.sessionId },
  }).then((result) => result[0]);

  // Find previous subtopics in the same topic to understand local progression
  const previousSubtopics = await db.Subtopic.findAll({
    where: {
      topicId: topic.id,
      order: { [db.Sequelize.Op.lt]: subtopic.order },
    },
    order: [["order", "ASC"]],
  });

  const conceptsLearned = contextMemory.get("conceptsLearned") || [];

  return {
    currentSubtopic: subtopic.toJSON(),
    currentTopic: topic.toJSON(),
    session: session.toJSON(),
    contextMemory: contextMemory.toJSON(),
    previousSubtopics: previousSubtopics.map((st) => st.toJSON()),
    conceptsLearned, // Now populated from context memory
  };
};

/**
 * Updates the context memory after content has been generated.
 * @param {string} sessionId - The ID of the current session.
 * @param {object} generatedData - The newly generated content and extracted metadata.
 * @returns {Promise<void>}
 */
exports.updateContextMemory = async (sessionId, generatedData) => {
  const {
    newNarrativeElements,
    newTerminology,
    newNotation,
    conceptsIntroduced,
  } = generatedData;

  const contextMemory = await db.ContextMemory.findOne({
    where: { sessionId },
  });

  if (!contextMemory) {
    throw new NotFoundError("ContextMemory not found for the session");
  }

  let changed = false;

  // 1. Update narrative timeline
  if (newNarrativeElements && newNarrativeElements.length > 0) {
    const currentTimeline = contextMemory.get("narrativeTimeline") || [];
    contextMemory.set("narrativeTimeline", [
      ...currentTimeline,
      ...newNarrativeElements,
    ]);
    changed = true;
  }

  // 2. Update terminology map
  if (newTerminology && Object.keys(newTerminology).length > 0) {
    const currentTerminology = contextMemory.get("terminologyMap") || {};
    contextMemory.set("terminologyMap", {
      ...currentTerminology,
      ...newTerminology,
    });
    changed = true;
  }

  // 3. Update notation map
  if (newNotation && Object.keys(newNotation).length > 0) {
    const currentNotation = contextMemory.get("notationMap") || {};
    contextMemory.set("notationMap", { ...currentNotation, ...newNotation });
    changed = true;
  }

  // 4. Update concepts learned
  if (conceptsIntroduced && conceptsIntroduced.length > 0) {
    const currentConcepts = contextMemory.get("conceptsLearned") || [];
    const uniqueNewConcepts = [
      ...new Set([...currentConcepts, ...conceptsIntroduced]),
    ];
    contextMemory.set("conceptsLearned", uniqueNewConcepts);
    changed = true;
  }

  if (changed) {
    // The 'changed' method is not needed when using .set() followed by .save() for JSON fields in recent Sequelize versions.
    // However, explicitly marking fields as changed can prevent issues in some edge cases or older versions.
    // We'll rely on .save() to detect changes made by .set().
    await contextMemory.save();
  }
};
