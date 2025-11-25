const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../../models");
const contextService = require("../context/contextService");
const { AIGenerationError, NotFoundError } = require("../../utils/errors");

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Builds the master prompt for content generation based on the gathered context.
 * @param {object} context - The context object from contextService.
 * @returns {string} The fully constructed prompt.
 */
const buildMasterPrompt = (context) => {
  const {
    currentSubtopic,
    currentTopic,
    session,
    contextMemory,
    previousSubtopics,
    conceptsLearned,
  } = context;

  const narrativeHistory = contextMemory.narrativeTimeline || [];
  const notationMap = contextMemory.notationMap || {};
  const terminologyMap = contextMemory.terminologyMap || {};

  // Example of creating a string of previously covered concepts
  const previouslyCovered =
    previousSubtopics.map((st) => st.name).join(", ") || "None";
  const narrativeContinuity =
    narrativeHistory
      .slice(-2)
      .map((h) => `- ${h.storyElement}`)
      .join("\\n") || "This is the first subtopic, so start a fresh narrative.";

  const prompt = `
You are an expert educator and storyteller creating learning content for a structured course. Your goal is to weave a continuous narrative while teaching complex topics.

### COURSE CONTEXT
- **Subject**: ${session.subjectName}
- **Main Problem We're Solving**: ${session.narrativeContext?.mainTheme || session.goal}
- **Current Topic**: ${currentTopic.name}
- **Current Subtopic**: ${currentSubtopic.name}
- **Subtopic Description**: ${currentSubtopic.description}
- **Previously Covered Subtopics in this Topic**: ${previouslyCovered}

### NARRATIVE CONTINUITY
${narrativeContinuity}

### YOUR TASK
Create content for the subtopic "${currentSubtopic.name}". The content must:
1. Continue the narrative thread naturally from the previous subtopics.
2. Teach the core concepts of the subtopic clearly.
3. Be engaging, intuitive, and build curiosity.

### REQUIRED STRUCTURE
You MUST format your response using the following markdown structure. Do not add any other headers.

## Story/Motivation
[Start with a relatable scenario or a continuation of the previous story. Pose a problem that this concept will solve. This section should be about 15-20% of the total content.]

## Concept Introduction
[Provide a gentle, intuitive explanation of the concept before diving into formal theory. This section should be brief, around 10-15%.]

## Theory
[Provide a detailed, rigorous explanation of the concept. Use clear headings for sub-sections within the theory. Insert pedagogical elements naturally within this section. This is the main part of the content, around 40-50%.]

## Summary
[Summarize the key takeaways from the subtopic and connect them back to the initial story/problem.]

### PEDAGOGICAL ELEMENTS (to be included within the ## Theory section)
- Use markdown blockquotes for these elements.
- **Key Concept**: For fundamental ideas. Start the blockquote with "> **Key Concept**:"
- **Example**: For concrete applications. Start the blockquote with "> **Example**:"
- **Pro Tip**: For expert insights. Start the blockquote with "> **Pro Tip**:"

### STYLE GUIDE
- Use consistent notation: ${JSON.stringify(notationMap)}
- Use consistent terminology: ${JSON.stringify(terminologyMap)}
- Write in a clear, encouraging, and expert tone.
- Use Markdown for formatting (bold, italics, lists, etc.).
`;

  return prompt;
};

/**
 * Parses the raw markdown response from the AI into a structured object.
 * @param {string} text - The AI's response.
 * @returns {object} - An object with keys like 'story', 'theory', etc.
 */
const parseAIResponse = (text) => {
  const story =
    text
      .split("## Story/Motivation")[1]
      ?.split("## Concept Introduction")[0]
      ?.trim() || "";
  const introduction =
    text.split("## Concept Introduction")[1]?.split("## Theory")[0]?.trim() ||
    "";
  const theory =
    text.split("## Theory")[1]?.split("## Summary")[0]?.trim() || "";
  const summary = text.split("## Summary")[1]?.trim() || "";

  // Simple extraction of pedagogical elements for now
  const pedagogicalElements = {
    keyConcepts: theory.match(/> \*\*Key Concept\*\*:/g)?.length || 0,
    examples: theory.match(/> \*\*Example\*\*:/g)?.length || 0,
    proTips: theory.match(/> \*\*Pro Tip\*\*:/g)?.length || 0,
  };

  return {
    story,
    theory: `${introduction}\n\n${theory}`, // Combine intro and theory
    summary,
    pedagogicalElements,
  };
};

/**
 * Generates learning content for a specific subtopic using a context-aware, narrative-driven approach.
 * @param {number} subtopicId - The ID of the subtopic to generate content for.
 * @returns {Promise<object>} The newly created LearningContent object.
 */
exports.generateContent = async ({ subtopicId }) => {
  // 1. Gather Context
  const context = await contextService.gatherContext(subtopicId);

  // 2. Build the Enhanced Prompt
  const prompt = buildMasterPrompt(context);

  try {
    // 3. Call the AI Model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Using a more powerful model for this complex task
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new AIGenerationError("No content generated from AI");
    }

    // 4. Parse the AI's response
    const parsedContent = parseAIResponse(text);

    if (!parsedContent.story || !parsedContent.theory) {
      throw new AIGenerationError(
        "Failed to parse the AI response into the required structure.",
      );
    }

    // 5. Save Structured Content
    const [learningContent] = await db.LearningContent.upsert(
      {
        subtopicId: subtopicId,
        story: parsedContent.story,
        theory: parsedContent.theory,
        summary: parsedContent.summary,
        pedagogicalElements: parsedContent.pedagogicalElements,
        practice: {}, // Placeholder for now
        contextUsed: context, // Save the context for debugging and future reference
        generatedAt: new Date(),
      },
      {
        returning: true,
      },
    );

    // 6. Update Context Memory (future implementation)
    // const newNarrativeElement = { subtopicId, storyElement: "A summary of the story beat goes here" };
    // await contextService.updateContextMemory(context.session.sessionId, {
    //   newNarrativeElements: [newNarrativeElement]
    // });

    return learningContent.toJSON();
  } catch (err) {
    console.error("Error in generateContent:", err);
    if (err instanceof AIGenerationError) {
      throw err;
    }
    throw new AIGenerationError(
      `An error occurred during content generation: ${err.message}`,
    );
  }
};
