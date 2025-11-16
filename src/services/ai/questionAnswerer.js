const { GoogleGenerativeAI } = require('@google/generative-ai');
const { AIGenerationError } = require('../../utils/errors');

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.answerQuestion = async ({ question, context }) => {
  if (!question || question.trim() === '') {
    throw new AIGenerationError('Question cannot be empty');
  }

  let prompt;
  if (context && context.trim() !== '') {
    prompt = `Based on this learning context: ${context}\n\nAnswer this question: ${question}\n\nProvide a helpful, educational answer that supports learning and references the context when relevant.`;
  } else {
    prompt = `Answer this learning question clearly and thoroughly: ${question}\n\nProvide educational explanations and be helpful for someone trying to understand this topic.`;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { maxOutputTokens: 1500 }
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new AIGenerationError('No answer generated');
    return text.trim();
  } catch (err) {
    throw new AIGenerationError(err.message);
  }
};
