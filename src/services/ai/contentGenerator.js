const Anthropic = require('@anthropic-ai/sdk');
const { AIGenerationError } = require('../../utils/errors');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

exports.generateContent = async ({ subtopicName, step, description }) => {
  let prompt;
  if (step === 'introduction') {
    prompt = `Write a clear, engaging introduction for the subtopic "${subtopicName}".\nDescription: ${description}`;
  } else if (step === 'understanding') {
    prompt = `Explain the subtopic "${subtopicName}" in detail for deep understanding.\nDescription: ${description}`;
  } else if (step === 'mastering') {
    prompt = `Provide advanced insights, examples, and exercises for mastering the subtopic "${subtopicName}".\nDescription: ${description}`;
  } else {
    throw new AIGenerationError('Invalid step for content generation');
  }
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    const text = message.content[0].text.trim();
    if (!text) throw new AIGenerationError('No content generated');
    return text;
  } catch (err) {
    throw new AIGenerationError(err.message);
  }
};
