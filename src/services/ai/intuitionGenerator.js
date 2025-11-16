const { GoogleGenerativeAI } = require('@google/generative-ai');
const { AIGenerationError } = require('../../utils/errors');

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateIntuition = async ({ topicName, description }) => {
  const prompt = `You are an expert educator. Given the topic "${topicName}" and its description: "${description}", generate a concise core intuition (1-2 sentences) that helps a learner grasp the essence of this topic.`;
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { maxOutputTokens: 512 }
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new AIGenerationError('No intuition generated');
    return text.trim();
  } catch (err) {
    throw new AIGenerationError(err.message);
  }
};
