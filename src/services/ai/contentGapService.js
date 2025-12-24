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
 * Extended to support semantic block-specific actions
 * Focused on being contextual, concise, and purpose-driven like a helpful friend teaching
 */
exports.handleBlockAction = async ({ action, content, blockType, context }) => {
  try {
    // Normalize action to lowercase for matching
    const normalizedAction = action.toLowerCase().trim();

    // Comprehensive action prompts for all semantic block actions
    const actionPrompts = {
      // === GENERIC ACTIONS ===
      'explain': `
You are a helpful friend explaining something to a student who didn't understand a part of what they're reading.

GUIDELINES:
- Give a clear, complete explanation (3-6 sentences is fine)
- Explain ONLY what's in the content, don't teach the entire topic
- Use simple, conversational language
- Focus on the "why" and intuition, not formal definitions
- ALWAYS complete your sentences and thoughts fully
      `,
      'explain this': `
You are a helpful friend explaining something to a student who didn't understand a part of what they're reading.

GUIDELINES:
- Give a clear, complete explanation (3-6 sentences is fine)
- Explain ONLY what's in the content, don't teach the entire topic
- Use simple, conversational language
- Focus on the "why" and intuition, not formal definitions
- ALWAYS complete your sentences and thoughts fully
      `,
      'explain more': `
You are providing deeper explanation for content the student wants to understand better.

GUIDELINES:
- Add more depth and detail to the explanation
- Cover aspects that might not be immediately obvious
- Use examples to illustrate points
- Connect to related concepts
- ALWAYS complete your thoughts fully
      `,
      'simplify': `
You are simplifying content for someone who finds the current explanation too complex.

GUIDELINES:
- Rewrite the ENTIRE content in simpler words
- Keep all the key information, just make it easier to understand
- Use everyday language, avoid or explain jargon
- Use analogies to familiar concepts when helpful
- The output should be roughly the same length, just clearer
- ALWAYS complete your sentences fully - never cut off mid-thought
      `,
      'explain simpler': `
You are simplifying content for someone who finds the current explanation too complex.

GUIDELINES:
- Rewrite the ENTIRE content in simpler words
- Keep all the key information, just make it easier to understand
- Use everyday language, avoid or explain jargon
- Use analogies to familiar concepts when helpful
- ALWAYS complete your sentences fully
      `,
      'expand': `
You are adding more depth to content that the student wants to understand better.

GUIDELINES:
- Add 2-3 additional insights, details, or nuances
- Keep additions relevant to the original content
- Don't repeat what's already written
- Be thorough but focused
- ALWAYS complete your thoughts fully
      `,
      'add examples': `
You are providing practical examples for content the student is learning.

GUIDELINES:
- Provide 2-3 relevant, practical examples
- Keep examples clear and directly related to the content
- Show step-by-step when applicable
- Use realistic scenarios
- ALWAYS complete each example fully
      `,
      'examples': `
You are providing practical examples for content the student is learning.

GUIDELINES:
- Provide 2-3 relevant, practical examples
- Keep examples clear and directly related to the content
- Show step-by-step when applicable
- Use realistic scenarios
- ALWAYS complete each example fully
      `,
      'regenerate': `
You are rewriting content to make it clearer and better structured.

GUIDELINES:
- Keep the same length and level of detail
- Improve clarity, flow, and structure
- Fix any confusing phrasing
- Maintain all educational value
- ALWAYS output complete, well-formed content
      `,

      // === CONTEXT BLOCK ACTIONS ===
      'make it relevant to my field': `
You are adapting the context/motivation to be more relevant to the student's interests.

GUIDELINES:
- Keep the same core message but use examples from different fields
- Suggest applications in engineering, data science, physics, economics, or other common fields
- Make the "why this matters" more compelling and personal
- Show how this concept is used in real-world professional settings
- ALWAYS complete your thoughts fully
      `,

      // === INTUITION BLOCK ACTIONS ===
      'give me an analogy': `
You are creating a memorable analogy to help the student understand the concept.

GUIDELINES:
- Create 1-2 powerful analogies using familiar, everyday experiences
- Explicitly map parts of the analogy to the concept
- Note where the analogy breaks down (limitations)
- Make it memorable and vivid
- ALWAYS complete your analogy fully
      `,
      'show visual representation': `
You are describing a visual/spatial representation of the concept.

GUIDELINES:
- Describe what a diagram or visualization would look like
- Use spatial language ("imagine a graph where...", "picture a tree structure...")
- Break down complex structures into visual components
- Suggest what charts, graphs, or diagrams would help
- ALWAYS complete your descriptions fully
      `,

      // === DEFINITION BLOCK ACTIONS ===
      'add intuition': `
You are adding intuitive understanding to a formal definition.

GUIDELINES:
- Explain WHY the definition makes sense
- Use plain language to describe what the formal symbols mean
- Connect to something the student already knows
- Explain the "spirit" behind the formalism
- ALWAYS complete your explanation fully
      `,
      'show me an example': `
You are providing a concrete example for a definition or concept.

GUIDELINES:
- Give a clear, worked example that illustrates the definition
- Choose numbers or scenarios that are easy to follow
- Show how the definition applies step by step
- Verify that your example satisfies the definition
- ALWAYS complete the example fully
      `,
      'why is this true?': `
You are explaining the reasoning behind why something is true or defined this way.

GUIDELINES:
- Explain the underlying logic or motivation
- Connect to fundamental principles
- Show why this definition/statement makes sense
- Address common confusions about why it's true
- ALWAYS complete your reasoning fully
      `,
      'why is this useful?': `
You are explaining the practical usefulness of a concept or result.

GUIDELINES:
- Describe real applications where this is used
- Explain what problems it solves
- Show what would be difficult or impossible without it
- Connect to tools or technologies the student may know
- ALWAYS complete your explanation fully
      `,

      // === THEOREM BLOCK ACTIONS ===
      'prove this': `
You are providing a proof or rigorous justification for a theorem or property.

GUIDELINES:
- Give a clear, step-by-step proof
- State assumptions and conditions explicitly
- Explain the logic at each step
- Use proper mathematical notation with LaTeX
- ALWAYS complete the proof fully
      `,
      'explain intuitively': `
You are giving an intuitive explanation of why a theorem or property is true.

GUIDELINES:
- Explain the "why" in plain language, not formal proof
- Use geometric or visual intuition when possible
- Help the student "see" why it must be true
- Connect to things they already understand
- ALWAYS complete your intuitive explanation
      `,
      'when does this apply?': `
You are explaining the conditions and scope of when a theorem or rule applies.

GUIDELINES:
- List the conditions/assumptions required
- Give examples where it applies
- Give examples where it does NOT apply
- Explain edge cases and limitations
- ALWAYS complete your explanation fully
      `,
      'when to use this?': `
You are explaining when and how to use a formula, theorem, or technique.

GUIDELINES:
- Describe the situations where this tool is useful
- Explain the signs that suggest using this approach
- Compare to alternative approaches
- Give practical decision-making guidance
- ALWAYS complete your guidance fully
      `,
      'show counterexample': `
You are providing a counterexample to show limitations or edge cases.

GUIDELINES:
- Give a clear example where the naive assumption fails
- Explain why the counterexample works
- Clarify what conditions are violated
- Help the student understand the boundaries
- ALWAYS complete the counterexample fully
      `,

      // === EXAMPLE BLOCK ACTIONS ===
      'explain step by step': `
You are giving a detailed step-by-step walkthrough of the example.

GUIDELINES:
- Break down each step of the solution
- Explain the reasoning at each step (not just what, but why)
- Highlight common mistakes at tricky steps
- Make sure the logic flow is crystal clear
- ALWAYS complete all steps fully
      `,
      'show a simpler example': `
You are creating a simpler version of the example to build understanding.

GUIDELINES:
- Use smaller numbers or simpler scenarios
- Focus on the core concept without complications
- Make it easy to follow mentally
- Build confidence before tackling harder examples
- ALWAYS complete the simpler example fully
      `,
      'show a harder example': `
You are creating a more challenging example to deepen understanding.

GUIDELINES:
- Increase complexity (larger numbers, more steps, edge cases)
- Include scenarios that require deeper thinking
- Show how the concept extends to harder problems
- Challenge the student appropriately
- ALWAYS complete the harder example fully
      `,

      // === FORMULA BLOCK ACTIONS ===
      'derive this': `
You are deriving or proving where a formula comes from.

GUIDELINES:
- Show the step-by-step derivation
- Start from known principles or formulas
- Explain the mathematical reasoning at each step
- Use proper LaTeX notation
- ALWAYS complete the derivation fully
      `,
      'explain each term': `
You are explaining what each term in a formula represents.

GUIDELINES:
- Go through each symbol/variable in the formula
- Explain what it represents conceptually
- Describe typical values or units
- Connect to physical or intuitive meaning
- ALWAYS explain all terms completely
      `,
      'show example': `
You are showing how to use a formula with a concrete example.

GUIDELINES:
- Plug in specific values and solve
- Show all the arithmetic steps
- Interpret the result
- Verify the answer makes sense
- ALWAYS complete the example fully
      `,

      // === INSIGHT BLOCK ACTIONS ===
      'give an example': `
You are illustrating an insight with a concrete example.

GUIDELINES:
- Create an example that demonstrates the insight
- Make it practical and memorable
- Show how the insight helps in real situations
- Connect to the student's experience
- ALWAYS complete the example fully
      `,

      // === WARNING BLOCK ACTIONS ===
      'explain the mistake': `
You are explaining in detail why a common mistake is wrong.

GUIDELINES:
- Clearly describe what the mistake looks like
- Explain why it's wrong (the underlying error)
- Show what happens if you make this mistake
- Help the student recognize it in their own work
- ALWAYS complete your explanation fully
      `,
      'show correct approach': `
You are demonstrating the correct way to approach something that's often done wrong.

GUIDELINES:
- Show the correct method step by step
- Contrast with the wrong approach
- Explain why the correct approach works
- Give tips for remembering the right way
- ALWAYS complete the correct approach fully
      `,
      'give example of error': `
You are showing a concrete example of a common error.

GUIDELINES:
- Create a realistic scenario where the error occurs
- Show the incorrect reasoning or calculation
- Then show the correct version
- Help the student spot the difference
- ALWAYS complete both versions fully
      `,

      // === SUMMARY BLOCK ACTIONS ===
      'expand on a point': `
You are expanding on a specific point from a summary.

GUIDELINES:
- Add more detail and depth to key points
- Provide additional context or examples
- Connect to related ideas
- Maintain the summary style but with more substance
- ALWAYS complete your expansion fully
      `,
      'add more takeaways': `
You are adding additional key takeaways to a summary.

GUIDELINES:
- Add 2-3 more important points to remember
- Focus on practical, actionable insights
- Keep them concise but meaningful
- Complement existing takeaways
- ALWAYS complete each takeaway fully
      `,

      // === CONCEPT BLOCK ACTIONS ===
      'connect to other concepts': `
You are showing how this concept connects to other ideas the student knows.

GUIDELINES:
- Identify 2-3 related concepts
- Explain how they're connected or related
- Show how understanding one helps with others
- Create a mental map of relationships
- ALWAYS complete your connections fully
      `,
    };

    // Get the appropriate prompt, with fallback
    let actionPrompt = actionPrompts[normalizedAction];

    // If no exact match, try to find a similar action or use default
    if (!actionPrompt) {
      // Check for partial matches
      if (normalizedAction.includes('explain')) {
        actionPrompt = actionPrompts['explain'];
      } else if (normalizedAction.includes('simpl')) {
        actionPrompt = actionPrompts['simplify'];
      } else if (normalizedAction.includes('example')) {
        actionPrompt = actionPrompts['add examples'];
      } else if (normalizedAction.includes('expand') || normalizedAction.includes('detail') || normalizedAction.includes('more')) {
        actionPrompt = actionPrompts['expand'];
      } else if (normalizedAction.includes('prove') || normalizedAction.includes('deriv')) {
        actionPrompt = actionPrompts['prove this'];
      } else if (normalizedAction.includes('intuiti') || normalizedAction.includes('analog')) {
        actionPrompt = actionPrompts['explain intuitively'];
      } else {
        // Default fallback
        actionPrompt = actionPrompts['explain'];
      }
      console.log(`handleBlockAction: No exact match for "${action}", using fallback`);
    }

    // Build context-aware prompt with block type information
    const blockTypeContext = blockType ? `\n**Block Type**: ${blockType} (adjust tone and depth accordingly)\n` : '';

    const prompt = `
${actionPrompt}
${blockTypeContext}
${context ? `**Reading Context** (what the student was reading before this):
${context}

` : ''}**Content to work with**:
${content}

**Critical Requirements**:
- MUST output complete sentences - never truncate or cut off mid-thought
- Use Markdown for formatting
- Use $ for inline math, $$ for display equations
- No preamble or meta-commentary, just the result
- Be thorough and complete

Output ONLY the result:
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: normalizedAction.includes('regenerate') ? 0.6 : 0.5,
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
