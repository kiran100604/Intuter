const { GoogleGenerativeAI } = require("@google/generative-ai");
const { AIGenerationError } = require("../../utils/errors");

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateBlueprint = async ({ subjectName, goal, outlineText }) => {
  const prompt = `You are an expert curriculum designer.\n\nSubject: ${subjectName}\nGoal: ${goal}\n\nCourse Outline:\n${outlineText}\n\nGenerate a structured curriculum with:\n1. Main topics (5-10 topics covering the subject)\n2. Subtopics under each topic (3-7 subtopics per topic)\n3. Prerequisites for each topic (topic names that must be completed first)\n4. Difficulty level (beginner/intermediate/advanced)\n5. Estimated duration in minutes for each subtopic\n\nReturn ONLY valid JSON in this exact format:\n{\n  "topics": [\n    {\n      "name": "Topic Name",\n      "description": "Brief description",\n      "difficultyLevel": "beginner",\n      "prerequisites": ["Previous Topic Name"],
      "subtopics": [\n        {\n          "name": "Subtopic Name",\n          "description": "Brief description",\n          "estimatedDuration": 30\n        }\n      ]\n    }\n  ]\n}\n\nRules:\n- First topic should have no prerequisites\n- Prerequisites must reference existing topic names\n- Each topic should have 3-7 subtopics\n- Subtopics should be ordered logically\n- Duration should be realistic (20-60 minutes)`;
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { maxOutputTokens: 4000 },
    });

    let result;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        result = await model.generateContent(prompt);
        break; // Success, exit loop
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw err; // Max attempts reached, re-throw the last error
        }
        // Log the retry attempt and wait before trying again
        console.log(
          `AI generation failed, attempt ${attempts}. Retrying in 2 seconds...`,
          err.message,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!result) {
      throw new AIGenerationError(
        "AI generation failed after multiple attempts",
      );
    }

    const response = await result.response;
    const text = response.text();

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1)
      throw new AIGenerationError("AI did not return valid JSON");
    const json = text.slice(jsonStart, jsonEnd + 1);
    const blueprint = JSON.parse(json);
    if (!blueprint.topics || !Array.isArray(blueprint.topics))
      throw new AIGenerationError("Invalid blueprint structure");
    console.log("=== AI GENERATED BLUEPRINT ===");
    console.log("Subject:", subjectName);
    console.log("Goal:", goal);
    console.log("Number of topics:", blueprint.topics?.length);
    console.log("\nFull Blueprint:");
    console.log(JSON.stringify(blueprint, null, 2));
    console.log("=== END BLUEPRINT ===");
    return blueprint;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new AIGenerationError(errorMessage);
  }
};
