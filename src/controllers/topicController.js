const { Topic, Subtopic } = require('../models');
const { success, error } = require('../utils/response');
const { generateIntuition } = require('../services/ai/intuitionGenerator');

// Topic management controller
exports.getTopics = async (req, res, next) => {
  // Get all topics for session
  try {
    const { sessionId } = req.query;
    if (!sessionId) return error(res, 'sessionId is required', 400);
    const topics = await Topic.findAll({
      where: { sessionId },
      order: [['order', 'ASC']],
      include: [{ model: Subtopic, as: 'subtopics' }]
    });
    return success(res, { topics }, 'Topics fetched');
  } catch (err) {
    next(err);
  }
};
exports.getTopicDetails = async (req, res, next) => {
  // Get topic with subtopics
  try {
    const { topicId } = req.params;
    const topic = await Topic.findByPk(topicId, {
      include: [{ model: Subtopic, as: 'subtopics' }]
    });
    if (!topic) return error(res, 'Topic not found', 404);
    return success(res, { topic }, 'Topic details fetched');
  } catch (err) {
    next(err);
  }
};
exports.generateIntuition = async (req, res, next) => {
  // Generate core intuition
  try {
    const { topicId } = req.params;
    const topic = await Topic.findByPk(topicId);
    if (!topic) return error(res, 'Topic not found', 404);
    if (!topic.description) return error(res, 'Topic description required', 400);
    const intuition = await generateIntuition({ topicName: topic.name, description: topic.description });
    topic.coreIntuition = intuition;
    topic.intuitionGenerated = true;
    await topic.save();
    return success(res, { intuition }, 'Core intuition generated');
  } catch (err) {
    next(err);
  }
};
exports.checkPrerequisites = async (req, res, next) => {
  // Check prerequisites status
  try {
    const { topicId } = req.params;
    const topic = await Topic.findByPk(topicId);
    if (!topic) return error(res, 'Topic not found', 404);
    // For now, just return the prerequisites field
    return success(res, { prerequisites: topic.prerequisites }, 'Prerequisites fetched');
  } catch (err) {
    next(err);
  }
};
