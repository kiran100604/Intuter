const { GoogleGenerativeAI } = require("@google/generative-ai");
const { AIGenerationError } = require("../../utils/errors");

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.answerQuestion = async ({ question, context, attachments }) => {
  if (!question || question.trim() === "") {
    throw new AIGenerationError("Question cannot be empty");
  }

  let textPrompt;
  if (context && context.trim() !== "") {
    textPrompt = `You are a learning assistant helping a student who is studying this topic:

  LEARNING CONTEXT:
  ${context}

  STUDENT'S DOUBT:
  ${question}

  INSTRUCTIONS:
  - Give a concise, focused answer that directly addresses their doubt
  - Relate your explanation to the concepts they've already studied (shown in the context above)
  - Use clear, simple language - avoid overexplaining
  - If relevant, point out connections to what they've learned
  - Keep it brief but complete - aim for 2-4 short paragraphs maximum
  - Use examples only if they help clarify the specific doubt
  - Use Markdown formatting (bold, lists, code blocks) to improve readability`;

  } else {
    textPrompt = `You are a learning assistant helping a student clarify a doubt:

  STUDENT'S DOUBT:
  ${question}

  INSTRUCTIONS:
  - Give a concise, focused answer that directly addresses their question
  - Use clear, simple language without overexplaining
  - Provide just enough context to understand the answer
  - Keep it brief - aim for 2-3 short paragraphs
  - Include a practical example only if it helps clarify the concept
  - Use Markdown formatting (bold, lists, code blocks) to improve readability`;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { maxOutputTokens: 1500 },
    });

    // Construct parts array for Gemini
    const parts = [textPrompt];

    // Add attachments if present
    if (attachments && Array.isArray(attachments)) {
      attachments.forEach(att => {
        if (att.data && att.mimeType) {
          parts.push({
            inlineData: {
              data: att.data,
              mimeType: att.mimeType
            }
          });
        }
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new AIGenerationError("No answer generated");
    return text.trim();
  } catch (err) {
    throw new AIGenerationError(err.message);
  }
};
