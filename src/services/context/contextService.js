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
    defaults: { sessionId: session.sessionId }
  }).then(result => result[0]);

  // Find previous subtopics in the same topic to understand local progression
  const previousSubtopics = await db.Subtopic.findAll({
    where: {
      topicId: topic.id,
      order: { [db.Sequelize.Op.lt]: subtopic.order },
    },
    order: [["order", "ASC"]],
  });

  // TODO: Implement logic to get all concepts learned so far in the session
  const conceptsLearned = [];

  return {
    currentSubtopic: subtopic.toJSON(),
    currentTopic: topic.toJSON(),
    session: session.toJSON(),
    contextMemory: contextMemory.toJSON(),
    previousSubtopics: previousSubtopics.map(st => st.toJSON()),
    conceptsLearned, // This will be populated later
  };
};

/**
 * Updates the context memory after content has been generated.
 * @param {string} sessionId - The ID of the current session.
 * @param {object} generatedData - The newly generated content and extracted metadata.
 * @returns {Promise<void>}
 */
exports.updateContextMemory = async (sessionId, generatedData) => {
  const { newNarrativeElements, newTerminology, newNotation, newRunningExamples } = generatedData;

  const contextMemory = await db.ContextMemory.findOne({ where: { sessionId } });

  if (!contextMemory) {
    throw new NotFoundError("ContextMemory not found for the session");
  }

  // TODO: Implement the logic to intelligently merge new data
  // For now, we'll just append to the narrative timeline as an example
  if (newNarrativeElements) {
    contextMemory.narrativeTimeline.push(...newNarrativeElements);
  }

  // Mark the JSON fields as modified to ensure they are saved
  contextMemory.changed('narrativeTimeline', true);

  await contextMemory.save();
};
