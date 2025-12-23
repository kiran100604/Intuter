const { GoogleGenerativeAI } = require("@google/generative-ai");
const { AIGenerationError } = require("../../utils/errors");

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const TEACHING_STYLES = {
  first_principles: `
    Start from the most fundamental question: "What problem are we trying to solve?"
    Build up concept layer by layer, never introducing a term before its foundation.
    Use the Socratic method - ask questions that lead the student to discover the answer.
    Use analogies to everyday experiences before introducing formal terminology.
    Structure: WHY → INTUITION → FORMAL DEFINITION → APPLICATION
  `,
  example_driven: `
    Start with a concrete, relatable example before any theory.
    Show multiple variations of the same concept through different examples.
    Use "Notice how..." and "Observe that..." to highlight patterns.
    Let the student derive the rule from the examples.
    Structure: EXAMPLE 1 → OBSERVATION → EXAMPLE 2 → PATTERN → RULE
  `,
  step_by_step: `
    Present as a clear, numbered step-by-step process.
    Each step should be atomic and verifiable.
    Include checkpoints: "At this point, you should have..."
    Provide decision trees for when different approaches apply.
    Structure: GOAL → STEP 1 → VERIFY → STEP 2 → VERIFY → ... → RESULT
  `,
  visual: `
    Describe concepts in spatial/visual terms.
    Use metaphors like "Think of it as a tree where...", "Imagine a graph showing..."
    Reference diagrams, charts, and visual representations frequently.
    Describe what the student should "see" mentally.
    Structure: VISUAL METAPHOR → COMPONENTS → HOW THEY CONNECT → BIG PICTURE
  `,
  analogy_based: `
    Start with a familiar real-world analogy that maps closely to the concept.
    Explicitly map each part of the analogy to the formal concept.
    Point out where the analogy breaks down (limitations).
    Use the analogy as a memory anchor throughout.
    Structure: FAMILIAR SITUATION → MAPPING → FORMAL CONCEPT → LIMITATIONS
  `,
};

/**
 * Generate content to fill a gap based on user request
 */
exports.generateGapContent = async ({ request, existingContent, subtopic }) => {
  try {
    const style = TEACHING_STYLES[request.preferredStyle] || TEACHING_STYLES.first_principles;

    const prompt = `
You are an expert tutor helping a student who has requested additional content.

**Student's Request Type**: ${request.requestType}
**Student's Description**: ${request.description}

**Current Subtopic**: ${subtopic ? subtopic.name : "General Session"}
**Subtopic Description**: ${subtopic ? subtopic.description : "N/A"}

**Existing Content Summary**:
${existingContent ? existingContent.summary || existingContent.theory?.substring(0, 500) : "No existing content yet"}

**Teaching Style to Use**:
${style}

**Request Type Guidelines**:
${getRequestTypeGuidelines(request.requestType)}

**Your Task**:
Generate content that addresses the student's specific request. The content should:
1. Seamlessly integrate with existing material
2. Use the specified teaching style
3. Include relevant tags (#concept-xxx, #formula-xxx) for cross-referencing
4. Be comprehensive yet concise
5. Include examples where appropriate

**Output Format**:
Return valid JSON with this structure:
\`\`\`json
{
  "content": "The main content addressing the student's request (Markdown formatted, use $ for LaTeX with \\\\ for commands)",
  "summary": "A 1-2 sentence summary of what was added",
  "contentType": "${request.requestType}",
  "newConcepts": [
    {
      "tagId": "#concept-example",
      "type": "concept|formula|definition",
      "name": "Concept Name",
      "explanation": "Brief explanation"
    }
  ],
  "relatedExistingConcepts": ["#concept-a", "#formula-b"],
  "practiceQuestion": {
    "question": "A practice question to test the new content",
    "answer": "The answer with explanation"
  },
  "suggestedPrerequisites": ["List any concepts the student should know first"]
}
\`\`\`
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const jsonString = jsonMatch ? jsonMatch[1] : text;

    try {
      const content = JSON.parse(jsonString);
      return content;
    } catch (parseError) {
      console.error("Failed to parse gap content response:", text.substring(0, 500));
      throw new AIGenerationError(`Failed to parse AI response: ${parseError.message}`);
    }
  } catch (error) {
    console.error("Error in generateGapContent:", error);
    throw error;
  }
};

/**
 * Generate alternative explanation with different teaching style
 */
exports.generateAlternativeExplanation = async ({
  subtopic,
  existingContent,
  preferredStyle,
  section,
  specificFeedback,
}) => {
  try {
    const style = TEACHING_STYLES[preferredStyle] || TEACHING_STYLES.first_principles;
    const contentToReexplain = section === "theory"
      ? existingContent.theory
      : section === "story"
        ? existingContent.story
        : existingContent.summary;

    const prompt = `
You are an expert tutor. A student has requested a different explanation style for content they're struggling with.

**Topic**: ${subtopic.name}
**Description**: ${subtopic.description}

**Original Content**:
${contentToReexplain?.substring(0, 2000) || "No content available"}

**Student's Feedback**: ${specificFeedback || "The student wants a different approach"}

**New Teaching Style to Use**:
${style}

**Your Task**:
Re-explain the same concepts using the new teaching style. Do NOT just rephrase - fundamentally restructure the explanation according to the style guidelines.

**Requirements**:
1. Cover the same core concepts but from a fresh angle
2. Use the specified teaching style structure
3. Include new examples or analogies
4. Maintain mathematical accuracy
5. Use Markdown formatting with $ for inline LaTeX (use \\\\ for LaTeX commands)

**Output Format**:
Return valid JSON:
\`\`\`json
{
  "explanation": "The re-explained content using the new style (Markdown with LaTeX)",
  "approachUsed": "Brief description of how this approach differs",
  "keyInsights": ["Key insight 1", "Key insight 2"],
  "memorableAnalogy": "A memorable way to remember this concept"
}
\`\`\`
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.8, // Slightly higher for more creative re-explanations
        topP: 0.95,
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const jsonString = jsonMatch ? jsonMatch[1] : text;

    try {
      return JSON.parse(jsonString);
    } catch (parseError) {
      // Return raw text if JSON parsing fails
      return {
        explanation: text,
        approachUsed: preferredStyle,
        keyInsights: [],
        memorableAnalogy: "",
      };
    }
  } catch (error) {
    console.error("Error in generateAlternativeExplanation:", error);
    throw error;
  }
};

/**
 * Extract concepts from content and create KnowledgeNodes
 */
exports.extractConceptsFromContent = async (content, sessionId, subtopicId) => {
  try {
    const prompt = `
Analyze the following learning content and extract all key concepts, formulas, and definitions.

**Content**:
${content.theory?.substring(0, 3000) || ""}

**Task**:
Extract and categorize all important knowledge elements.

**Output Format**:
Return valid JSON:
\`\`\`json
{
  "concepts": [
    {
      "tagId": "#concept-example-name",
      "name": "Concept Name",
      "explanation": "Brief 1-2 sentence explanation",
      "importance": "core|supporting|advanced",
      "relatedTo": ["#other-concept-1"]
    }
  ],
  "formulas": [
    {
      "tagId": "#formula-example-name",
      "name": "Formula Name",
      "expression": "LaTeX expression",
      "explanation": "What this formula calculates",
      "relatedTo": ["#concept-1"]
    }
  ],
  "definitions": [
    {
      "tagId": "#def-example-term",
      "term": "Term Name",
      "definition": "Formal definition",
      "intuition": "Intuitive explanation"
    }
  ]
}
\`\`\`
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent extraction
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const jsonString = jsonMatch ? jsonMatch[1] : text;

    const extracted = JSON.parse(jsonString);

    // Transform to KnowledgeNode format
    const nodes = [];

    for (const concept of extracted.concepts || []) {
      nodes.push({
        sessionId,
        tagId: concept.tagId,
        nodeType: "concept",
        name: concept.name,
        explanation: concept.explanation,
        importance: concept.importance,
        relatedNodes: concept.relatedTo || [],
        sourceSubtopicId: subtopicId,
        sources: [{ type: "learning", subtopicId }],
      });
    }

    for (const formula of extracted.formulas || []) {
      nodes.push({
        sessionId,
        tagId: formula.tagId,
        nodeType: "formula",
        name: formula.name,
        expression: formula.expression,
        explanation: formula.explanation,
        relatedNodes: formula.relatedTo || [],
        sourceSubtopicId: subtopicId,
        sources: [{ type: "learning", subtopicId }],
      });
    }

    for (const def of extracted.definitions || []) {
      nodes.push({
        sessionId,
        tagId: def.tagId,
        nodeType: "definition",
        name: def.term,
        formalDefinition: def.definition,
        explanation: def.intuition,
        sourceSubtopicId: subtopicId,
        sources: [{ type: "learning", subtopicId }],
      });
    }

    return nodes;
  } catch (error) {
    console.error("Error extracting concepts:", error);
    return [];
  }
};

function getRequestTypeGuidelines(requestType) {
  const guidelines = {
    missing_concept: `
      The student feels something important is missing from the content.
      - Identify what concept or topic is being asked about
      - Explain it comprehensively with examples
      - Show how it connects to existing content
    `,
    need_example: `
      The student wants more practical examples.
      - Create 2-3 diverse examples that illustrate the concept
      - Start simple and increase complexity
      - Show the thinking process, not just the answer
    `,
    too_complex: `
      The student finds the current explanation too difficult.
      - Break down the concept into smaller, digestible parts
      - Use simpler language and more analogies
      - Build up understanding step by step
      - Avoid jargon until the intuition is established
    `,
    too_simple: `
      The student wants more depth and rigor.
      - Add mathematical formalism where appropriate
      - Discuss edge cases and nuances
      - Connect to advanced topics
      - Include challenging practice problems
    `,
    add_subtopic: `
      The student wants to add a new subtopic to the curriculum.
      - Create a comprehensive introduction to the new topic
      - Explain why it matters and where it fits
      - Include all necessary concepts and formulas
    `,
    different_style: `
      The student wants a different explanation approach.
      - Completely restructure the explanation
      - Use the specified teaching style
      - Create new analogies and examples
    `,
    add_diagram: `
      The student needs visual explanation.
      - Describe what a diagram would look like
      - Use spatial and visual language
      - Break down complex structures into visual components
      - Suggest what charts/graphs would help
    `,
    incorrect_content: `
      The student believes something is wrong.
      - Carefully review the student's concern
      - If the concern is valid, provide the correction
      - If the original is correct, explain why it's right
      - Clarify any potential sources of confusion
    `,
  };

  return guidelines[requestType] || guidelines.missing_concept;
}

/**
 * Handle AI actions on individual blocks (explain, simplify, expand, examples, regenerate)
 * Focused on being contextual, concise, and purpose-driven like a helpful friend teaching
 */
exports.handleBlockAction = async ({ action, content, blockType, context }) => {
  try {
    // Contextual prompts that are concise but COMPLETE - never cut off mid-thought
    const actionPrompts = {
      explain: `
You are a helpful friend explaining something to a student who didn't understand a part of what they're reading.

GUIDELINES:
- Give a clear, complete explanation (3-6 sentences is fine)
- Explain ONLY what's in the content, don't teach the entire topic
- Use simple, conversational language
- Focus on the "why" and intuition, not formal definitions
- ALWAYS complete your sentences and thoughts fully
      `,
      simplify: `
You are simplifying content for someone who finds the current explanation too complex.

GUIDELINES:
- Rewrite the ENTIRE content in simpler words
- Keep all the key information, just make it easier to understand
- Use everyday language, avoid or explain jargon
- Use analogies to familiar concepts when helpful
- The output should be roughly the same length, just clearer
- ALWAYS complete your sentences fully - never cut off mid-thought
      `,
      expand: `
You are adding more depth to content that the student wants to understand better.

GUIDELINES:
- Add 2-3 additional insights, details, or nuances
- Keep additions relevant to the original content
- Don't repeat what's already written
- Be thorough but focused
- ALWAYS complete your thoughts fully
      `,
      examples: `
You are providing practical examples for content the student is learning.

GUIDELINES:
- Provide 2-3 relevant, practical examples
- Keep examples clear and directly related to the content
- Show step-by-step when applicable
- Use realistic scenarios
- ALWAYS complete each example fully
      `,
      regenerate: `
You are rewriting content to make it clearer and better structured.

GUIDELINES:
- Keep the same length and level of detail
- Improve clarity, flow, and structure
- Fix any confusing phrasing
- Maintain all educational value
- ALWAYS output complete, well-formed content
      `,
    };

    const actionPrompt = actionPrompts[action] || actionPrompts.explain;

    // Build context-aware prompt
    const prompt = `
${actionPrompt}

${context ? `**Reading Context** (what the student was reading before this):
${context}

` : ""}**Content to ${action}**:
${content}

**Critical Requirements**:
- MUST output complete sentences - never truncate or cut off mid-thought
- Use Markdown for formatting
- Use $ for inline math, $$ for display equations
- No preamble or meta-commentary, just the result

Output ONLY the ${action === "explain" || action === "expand" || action === "examples" ? "new content to add" : "improved content"}:
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: action === "regenerate" ? 0.6 : 0.5,
        topP: 0.9,
        maxOutputTokens: 2048, // Generous limit to ensure complete responses
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error in handleBlockAction:", error);
    throw new AIGenerationError(`Failed to process AI action: ${error.message}`);
  }
};

/**
 * Generate content from user prompt
 */
exports.generateFromPrompt = async ({ prompt, style, context }) => {
  try {
    const teachingStyle = TEACHING_STYLES[style] || TEACHING_STYLES.first_principles;

    const fullPrompt = `
You are an expert educational content creator.

**Context**: ${context || "Educational content"}

**User Request**: ${prompt}

**Teaching Style to Use**:
${teachingStyle}

**Requirements**:
1. Create clear, educational content that addresses the request
2. Use Markdown formatting
3. Use $ for inline LaTeX math (with \\\\ for LaTeX commands)
4. Use $$ for display math equations
5. Include examples where appropriate
6. Structure the content logically
7. Be comprehensive but concise

Generate the educational content:
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
      },
    });

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error in generateFromPrompt:", error);
    throw new AIGenerationError(`Failed to generate content: ${error.message}`);
  }
};

/**
 * Explain an image using AI vision
 */
exports.explainImage = async ({ imageData, context }) => {
  try {
    // Extract base64 data if it includes the data URL prefix
    let base64Data = imageData;
    let mimeType = "image/png";

    if (imageData.startsWith("data:")) {
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    const prompt = `
You are an expert educational assistant analyzing an image for a student.

**Context**: ${context || "The student is learning and has uploaded an image for explanation."}

**Task**: Analyze this image and provide a comprehensive educational explanation.

**Requirements**:
1. Describe what the image shows
2. Explain any concepts, diagrams, graphs, or formulas visible
3. If it's a mathematical graph or chart, explain the relationships shown
4. If it contains formulas, explain what they mean and how they work
5. Provide context on why this is important for learning
6. Use Markdown formatting
7. Use $ for inline LaTeX math when referencing equations

Provide a clear, educational explanation of this image:
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.5,
      },
    });

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error in explainImage:", error);
    throw new AIGenerationError(`Failed to explain image: ${error.message}`);
  }
};
