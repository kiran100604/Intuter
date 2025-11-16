const { GoogleGenerativeAI } = require('@google/generative-ai');
const { AIGenerationError } = require('../../utils/errors');

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateBlueprint = async ({ subjectName, goal, outlineText }) => {
  const prompt = `You are an expert curriculum designer.\n\nSubject: ${subjectName}\nGoal: ${goal}\n\nCourse Outline:\n${outlineText}\n\nGenerate a structured curriculum with:\n1. Main topics (5-10 topics covering the subject)\n2. Subtopics under each topic (3-7 subtopics per topic)\n3. Prerequisites for each topic (topic names that must be completed first)\n4. Difficulty level (beginner/intermediate/advanced)\n5. Estimated duration in minutes for each subtopic\n\nReturn ONLY valid JSON in this exact format:\n{\n  "topics": [\n    {\n      "name": "Topic Name",\n      "description": "Brief description",\n      "difficultyLevel": "beginner",\n      "prerequisites": ["Previous Topic Name"],\n      "subtopics": [\n        {\n          "name": "Subtopic Name",\n          "description": "Brief description",\n          "estimatedDuration": 30\n        }\n      ]\n    }\n  ]\n}\n\nRules:\n- First topic should have no prerequisites\n- Prerequisites must reference existing topic names\n- Each topic should have 3-7 subtopics\n- Subtopics should be ordered logically\n- Duration should be realistic (20-60 minutes)`;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    const text = message.content[0].text;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new AIGenerationError('AI did not return valid JSON');
    const json = text.slice(jsonStart, jsonEnd + 1);
    const blueprint = JSON.parse(json);
    if (!blueprint.topics || !Array.isArray(blueprint.topics)) throw new AIGenerationError('Invalid blueprint structure');
    return blueprint;
  } catch (err) {
    throw new AIGenerationError(err.message);
  }
};
