const { GoogleGenerativeAI } = require("@google/generative-ai");
const { AIGenerationError } = require("../../utils/errors");

if (process.env.NODE_ENV !== "test" && !process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const defaultGenAI =
  process.env.NODE_ENV === "test"
    ? null
    : new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateBlueprint = async (
  { subjectName, goal, outlineText },
  genAI = defaultGenAI,
) => {
  const prompt = `
    You are a curriculum design expert. Generate a structured curriculum based on the following details:
    - Subject: ${subjectName}
    - Goal: ${goal}
    - Outline: ${outlineText}

    The curriculum should have 5-10 main topics, each with 3-7 subtopics.
    For each topic, provide: name, description (max 100 chars), difficulty (beginner, intermediate, or advanced), and prerequisites (a list of topic names).
    For each subtopic, provide: name, description (max 80 chars), and estimatedDuration (in minutes).

    **IMPORTANT**:
    1. You MUST respond with ONLY a valid JSON object. No other text, formatting, or markdown.
    2. Keep descriptions concise to ensure the response fits within token limits.
    3. The JSON must be complete and properly closed.
    4. Schema:
    {
      "topics": [
        {
          "name": "Topic Name",
          "description": "Brief description",
          "difficultyLevel": "beginner",
          "prerequisites": [],
          "subtopics": [
            {
              "name": "Subtopic Name",
              "description": "Brief description",
              "estimatedDuration": 30
            }
          ]
        }
      ]
    }
  `;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 16000, // Increased token limit
      },
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

    const text = result.response.text();

    // Check if response was truncated
    if (!text.trim().endsWith("}")) {
      console.error("Response appears truncated:", text.slice(-200));
      throw new AIGenerationError(
        "AI response was truncated. The curriculum may be too large. Try reducing the outline or requesting fewer topics.",
      );
    }

    let cleanedJson = text
      .replace(/^```json\s*/, "")
      .replace(/\s*```$/, "")
      .replace(/,\s*([}\]])/g, "$1")
      .trim();

    try {
      // First attempt to parse the cleaned JSON
      const blueprint = JSON.parse(cleanedJson);

      // Validate structure
      if (!blueprint.topics || !Array.isArray(blueprint.topics)) {
        throw new AIGenerationError(
          "Invalid blueprint structure: missing topics array",
        );
      }

      if (blueprint.topics.length === 0) {
        throw new AIGenerationError(
          "Invalid blueprint structure: topics array is empty",
        );
      }

      // Validate each topic has required fields
      for (const topic of blueprint.topics) {
        if (
          !topic.name ||
          !topic.subtopics ||
          !Array.isArray(topic.subtopics)
        ) {
          throw new AIGenerationError(
            `Invalid topic structure: ${topic.name || "unnamed"} is missing required fields`,
          );
        }
      }

      console.log("=== AI GENERATED BLUEPRINT ===");
      console.log("Subject:", subjectName);
      console.log("Goal:", goal);
      console.log("Number of topics:", blueprint.topics?.length);
      console.log(
        "Total subtopics:",
        blueprint.topics.reduce((sum, t) => sum + t.subtopics.length, 0),
      );
      console.log("\nFull Blueprint:");
      console.log(JSON.stringify(blueprint, null, 2));
      console.log("=== END BLUEPRINT ===");

      return blueprint;
    } catch (parseErr) {
      console.error("Failed to parse blueprint JSON:", parseErr.message);
      console.error("Response length:", text.length);
      console.error("Last 500 chars:", text.slice(-500));

      // Try to extract partial valid JSON (last resort)
      try {
        const jsonMatch = text.match(/\{[\s\S]*"topics"[\s\S]*\}/);
        if (jsonMatch) {
          const extractedJson = jsonMatch[0];
          const blueprint = JSON.parse(extractedJson);

          if (
            blueprint.topics &&
            Array.isArray(blueprint.topics) &&
            blueprint.topics.length > 0
          ) {
            console.log("=== AI GENERATED BLUEPRINT (RECOVERED) ===");
            console.log("Warning: Partial recovery attempted");
            console.log("Number of topics:", blueprint.topics?.length);
            console.log("=== END BLUEPRINT ===");
            return blueprint;
          }
        }
      } catch (recoveryErr) {
        // Recovery failed, throw original error
      }

      throw new AIGenerationError(
        `Failed to parse AI response: ${parseErr.message}. Response may be truncated or malformed.`,
      );
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Blueprint generation error:", errorMessage);
    throw new AIGenerationError(errorMessage);
  }
};
