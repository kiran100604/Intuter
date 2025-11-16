const { UserQuestion, StudySession, Subtopic } = require('../models');
const { success, error } = require('../utils/response');
const { answerQuestion } = require('../services/ai/questionAnswerer');

// User question controller skeleton
exports.askQuestion = async (req, res, next) => {
  try {
    const { sessionId, subtopicId, question } = req.body;
    if (!sessionId || !question) return error(res, 'sessionId and question are required', 400);
    const session = await StudySession.findByPk(sessionId);
    if (!session) return error(res, 'Session not found', 404);
    let context = '';
    if (subtopicId) {
      const subtopic = await Subtopic.findByPk(subtopicId);
      if (subtopic) context = subtopic.description || '';
    }
    const answer = await answerQuestion({ question, context });
    const userQuestion = await UserQuestion.create({
      sessionId: session.id,
      subtopicId,
      question,
      answer,
      askedAt: new Date()
    });
    return success(res, { userQuestion }, 'Question answered');
  } catch (err) {
    next(err);
  }
};

exports.getQuestion = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const userQuestion = await UserQuestion.findByPk(questionId);
    if (!userQuestion) return error(res, 'Question not found', 404);
    return success(res, { userQuestion }, 'Question fetched');
  } catch (err) {
    next(err);
  }
};

exports.provideFeedback = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const { helpful } = req.body;
    const userQuestion = await UserQuestion.findByPk(questionId);
    if (!userQuestion) return error(res, 'Question not found', 404);
    userQuestion.helpful = !!helpful;
    await userQuestion.save();
    return success(res, { userQuestion }, 'Feedback recorded');
  } catch (err) {
    next(err);
  }
};
