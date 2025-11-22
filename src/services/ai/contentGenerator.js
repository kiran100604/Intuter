const { GoogleGenerativeAI } = require("@google/generative-ai");
const { AIGenerationError } = require("../../utils/errors");

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateContent = async ({ subtopicName, step, description }) => {
  let prompt;
  if (step === "introduction") {
    prompt = `Write a clear, engaging introduction for the subtopic "${subtopicName}".\nDescription: ${description}`;
  } else if (step === "understanding") {
    prompt = `Explain the subtopic "${subtopicName}" in detail for deep understanding.\nDescription: ${description}`;
  } else if (step === "mastering") {
    prompt = `Provide advanced insights, examples, and exercises for mastering the subtopic "${subtopicName}".\nDescription: ${description}`;
  } else {
    throw new AIGenerationError("Invalid step for content generation");
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new AIGenerationError("No content generated");
    return text.trim();
  } catch (err) {
    throw new AIGenerationError(err.message);
  }
};
