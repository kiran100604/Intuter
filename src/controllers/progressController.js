const { Subtopic, SubtopicProgress, Topic } = require('../models');
const { success, error } = require('../utils/response');

// Progress tracking controller skeleton
exports.getSessionProgress = async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return error(res, 'sessionId is required', 400);
    // Get all topics for session
    const topics = await Topic.findAll({ where: { sessionId } });
    const topicIds = topics.map(t => t.id);
    // Get all subtopics for these topics
    const subtopics = await Subtopic.findAll({ where: { topicId: topicIds } });
    const subtopicIds = subtopics.map(s => s.id);
    // Get all progress records for these subtopics
    const progresses = await SubtopicProgress.findAll({ where: { subtopicId: subtopicIds } });
    return success(res, { progresses }, 'Session progress fetched');
  } catch (err) {
    next(err);
  }
};

exports.getTopicProgress = async (req, res, next) => {
  try {
    const { topicId } = req.query;
    if (!topicId) return error(res, 'topicId is required', 400);
    const subtopics = await Subtopic.findAll({ where: { topicId } });
    const subtopicIds = subtopics.map(s => s.id);
    const progresses = await SubtopicProgress.findAll({ where: { subtopicId: subtopicIds } });
    return success(res, { progresses }, 'Topic progress fetched');
  } catch (err) {
    next(err);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    // Placeholder: return counts for now
    const { sessionId } = req.query;
    if (!sessionId) return error(res, 'sessionId is required', 400);
    const topics = await Topic.findAll({ where: { sessionId } });
    const topicIds = topics.map(t => t.id);
    const subtopics = await Subtopic.findAll({ where: { topicId: topicIds } });
    const subtopicIds = subtopics.map(s => s.id);
    const progresses = await SubtopicProgress.findAll({ where: { subtopicId: subtopicIds } });
    const completed = progresses.filter(p => p.currentStep === 'completed').length;
    const total = progresses.length;
    return success(res, { completed, total, percent: total ? (completed / total) * 100 : 0 }, 'Analytics fetched');
  } catch (err) {
    next(err);
  }
};
