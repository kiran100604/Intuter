const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../../models");
const { AIGenerationError } = require("../../utils/errors");

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generates revision content for a specific subtopic.
 * @param {object} params - { subtopicId }
 * @returns {Promise<object>} The newly created RevisionContent object.
 */
exports.generateRevision = async ({ subtopicId }) => {
    try {
        // 1. Fetch Context (Subtopic & LearningContent)
        const subtopic = await db.Subtopic.findByPk(subtopicId, {
            include: [
                {
                    model: db.Topic,
                    as: "topic",
                    include: [{ model: db.StudySession, as: "session" }],
                },
            ],
        });

        if (!subtopic) {
            throw new Error("Subtopic not found");
        }

        const learningContent = await db.LearningContent.findOne({
            where: { subtopicId },
        });

        // 2. Build Prompt
        const prompt = `
      You are an expert tutor creating a revision sheet for a student.
      
      **Subject**: ${subtopic.topic.session.subjectName}
      **Topic**: ${subtopic.topic.name}
      **Subtopic**: ${subtopic.name}
      **Description**: ${subtopic.description}
      
      ${learningContent
                ? `**Source Material (Summary)**: ${learningContent.summary}`
                : ""
            }
      
      Your task is to generate a structured revision guide with the following sections:
      1. **Key Formulas**: A list of All important mathematical formulas or key relationships.
      2. **Key Definitions**: A list of All crucial terms and their precise definitions.
      3. **Quick Quiz**: 5-7 conceptual questions to test understanding. Provide the question and the answer separately.
      4. **Pro Tips**: 3-4 practical tips or common pitfalls to avoid.

      **Output Format**:
      Return ONLY a valid JSON object with the following structure.
      IMPORTANT: 
      1. For any LaTeX math expressions, you MUST use double backslashes (e.g., \\\\mathbb{R} instead of \\mathbb{R}) because this is a JSON string.
      2. You MUST wrap ALL math expressions in single dollar signs ($...$) for inline math or double dollar signs ($$...$$) for block math. This applies to ALL sections, including "tips" and "quiz".
      
      \`\`\`json
      {
        "formulas": [
          { "name": "Formula Name", "expression": "LaTeX or text representation", "explanation": "Brief explanation" }
        ],
        "definitions": [
          { "term": "Term", "definition": "Definition text" }
        ],
        "quiz": [
          { "question": "Question text?", "answer": "Answer text" }
        ],
        "tips": [
          "Tip 1 text",
          "Tip 2 text"
        ]
      }
      \`\`\`
    `;

        // 3. Call AI
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // 4. Parse Response
        let content;
        try {
            // Try to find JSON in code blocks first
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            const jsonString = jsonMatch ? jsonMatch[1] : text;

            // Clean up any potential markdown or whitespace
            let cleanJson = jsonString.trim();

            // Sanitize backslashes for LaTeX if they are not already escaped
            // This regex looks for a backslash that is NOT preceded by a backslash AND NOT followed by a valid JSON escape character
            cleanJson = cleanJson.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\");

            content = JSON.parse(cleanJson);
        } catch (e) {
            console.error("Failed to parse AI response. Raw text:", text);
            require('fs').writeFileSync('ai_response.txt', text);
            console.error("Parse error:", e);
            throw new AIGenerationError("Failed to parse AI response for revision.");
        }

        // 5. Save to DB
        const [revisionContent] = await db.RevisionContent.upsert(
            {
                subtopicId,
                content,
                generatedAt: new Date(),
            },
            { returning: true }
        );

        return revisionContent.toJSON();
    } catch (err) {
        console.error("Error in generateRevision:", err);
        throw err;
    }
};
