const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../../models");
const { AIGenerationError } = require("../../utils/errors");

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Helper function to clean LaTeX in JSON strings
 * This properly escapes backslashes for LaTeX rendering
 */
function cleanLatexInJson(jsonString) {
  let cleanJson = jsonString.trim();

  // Step 1: Temporarily protect already-escaped sequences
  // Replace \\ with a placeholder to protect them
  const DOUBLE_BACKSLASH_PLACEHOLDER = '<<<DOUBLE_BACKSLASH>>>';
  cleanJson = cleanJson.replace(/\\\\/g, DOUBLE_BACKSLASH_PLACEHOLDER);

  // Step 2: Now fix single backslashes that aren't valid JSON escapes
  // Valid JSON escapes are: \" \\ \/ \b \f \n \r \t \uXXXX
  // Everything else should be doubled
  cleanJson = cleanJson.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');

  // Step 3: Restore the originally doubled backslashes (make them quadruple for LaTeX)
  cleanJson = cleanJson.replace(new RegExp(DOUBLE_BACKSLASH_PLACEHOLDER, 'g'), '\\\\\\\\');

  return cleanJson;
}

/**
 * Generates revision content for a specific subtopic with enhanced connectivity.
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

    // 2. Build Enhanced Prompt
    const prompt = `
You are an expert tutor creating a deeply connected, intuitive revision guide for a student.

**Context**:
- Subject: ${subtopic.topic.session.subjectName}
- Topic: ${subtopic.topic.name}
- Subtopic: ${subtopic.name}
- Description: ${subtopic.description}

${learningContent ? `**Source Material**: ${learningContent.summary}` : ""}

**CRITICAL INSTRUCTION - CREATE A COHESIVE LEARNING JOURNEY**:
Your revision guide must tell a coherent story where each section naturally flows into the next. The student should feel like they're climbing a mountain of understanding, not reading disconnected facts.

**Required Sections & Flow**:

1. **Core Intuition** (The "Why" - Foundation)
   - Start with a relatable real-world scenario or analogy
   - Explain the problem this concept solves
   - Build intuition BEFORE introducing terminology
   - Use phrases like "Imagine...", "Think of it as...", "The key insight is..."
   - End with a bridge: "Now that we understand WHY, let's see HOW..."

2. **Important Concepts** (The "What" - Building Blocks)
   - Each concept should reference back to the core intuition
   - Show how concepts connect to each other
   - Use transition phrases: "Building on this...", "This leads us to...", "Notice how..."
   - Include cross-references using tags: "This relates to #concept-xyz"
   - Progress from simple to complex
   - For each concept, briefly mention WHERE it's used

3. **Key Formulas** (The "Tools" - Mathematical Framework)
   - Don't just list formulas - explain the story behind each
   - Connect formulas to concepts: "Remember #concept-xyz? Here's its mathematical form..."
   - Show how formulas relate to each other (derivations, special cases)
   - Include intuitive meaning: "This term represents...", "When this equals zero, it means..."
   - Add "when to use" guidance

4. **Key Definitions** (The "Language" - Precision)
   - Definitions should feel like natural conclusions from concepts
   - Include both formal definition AND intuitive explanation
   - Reference where each term appears in formulas using tags
   - Show relationships between definitions

5. **Worked Example** (The "Bridge" - Theory to Practice) **[NEW SECTION]**
   - ONE complete example that ties everything together
   - Explicitly call out which concepts, formulas, and definitions are used
   - Use tags throughout: "Here we apply #formula-xyz because..."
   - Show common mistakes and how to avoid them
   - This is the CRITICAL CONNECTION between theory and practice

6. **Quick Quiz** (The "Test" - Self-Assessment)
   - Questions should progressively build on each other
   - Q1-2: Test core intuition (conceptual, no math)
   - Q3-4: Apply concepts and definitions
   - Q5-6: Use formulas in context
   - Q7: Integration question (combines multiple elements)
   - Each question should reference relevant tags in the answer

7. **Pro Tips** (The "Wisdom" - Practical Insights)
   - Each tip should connect to common mistakes in the example or quiz
   - Use specific references: "When solving problems like Q5..."
   - Include memory aids: "Remember: [mnemonic]"
   - Explain WHY the tip matters, not just WHAT to do

**Connectivity Requirements**:
- Use transition language throughout (50+ connecting phrases)
- Every section after Core Intuition must reference previous content
- Use tags as "hyperlinks" to show relationships
- Include forward references: "We'll use this in #formula-xyz"
- Include backward references: "Recall from #concept-abc"

**Tagging System**:
- Format: "#category-keyword" (e.g., "#concept-markov-property", "#formula-transition-matrix")
- Tag EVERYTHING that might be referenced
- Use tags liberally within explanations to show connections

**Tone & Style**:
- Conversational yet precise
- Use "you" to engage the student
- Ask rhetorical questions to maintain engagement
- Use analogies and metaphors
- Celebrate understanding: "Great! Now you see..."

**CRITICAL JSON ESCAPING RULES FOR LaTeX**:
You must properly escape LaTeX in JSON strings. Follow these rules:

1. For LaTeX commands that should display as single backslash (\\command):
   - Write them with DOUBLE backslashes in your JSON: \\\\command
   - Example: To display \\theta, write \\\\theta in the JSON
   - Example: To display \\frac{a}{b}, write \\\\frac{a}{b} in the JSON

2. For literal backslashes in math mode:
   - Use DOUBLE backslashes: \\\\
   
3. Common LaTeX examples (JSON → Display):
   - "\\\\theta" → \\theta
   - "\\\\frac{a}{b}" → \\frac{a}{b}
   - "P(X_i = x_i | \\\\theta)" → P(X_i = x_i | \\theta)
   - "\\\\prod_{i=1}^n" → \\prod_{i=1}^n
   - "\\\\mathbb{R}" → \\mathbb{R}
   - "\\\\times" → \\times
   - "\\\\dots" → \\dots

4. DO NOT use quadruple backslashes (\\\\\\\\) - they will result in double backslashes in output
5. DO NOT use single backslashes (\\) - they will cause JSON parsing errors

**CORRECT JSON EXAMPLES**:
✓ "$L(\\\\theta | x_1, \\\\dots, x_n)$"
✓ "$\\\\prod_{i=1}^{n} P(X_i = x_i | \\\\theta)$"
✓ "$\\\\hat{\\\\theta}_{MLE}$"
✓ "$(x_1, \\\\dots, x_n) \\\\in \\\\mathbb{R}^n$"

**INCORRECT (will break rendering)**:
✗ "$L(\\\\\\\\theta | x_1, \\\\\\\\dots, x_n)$" (too many backslashes)
✗ "$L(\\theta | x_1, \\dots, x_n)$" (too few backslashes - invalid JSON)

**Output Format**:
Return ONLY valid JSON. Use DOUBLE backslashes (\\\\) for ALL LaTeX commands.
Use single $ for inline math, double $$ for block math.

\`\`\`json
{
  "coreIntuition": "Multi-paragraph narrative starting with analogy, building to key insight, ending with transition...",
  "importantConcepts": [
    { 
      "id": "#concept-unique-id", 
      "concept": "Concept Name", 
      "explanation": "Full explanation with connections to other concepts, where it's used, and cross-references with tags. Include transition to next concept."
    }
  ],
  "formulas": [
    { 
      "id": "#formula-unique-id", 
      "name": "Formula Name", 
      "expression": "LaTeX with DOUBLE backslashes (\\\\command)", 
      "explanation": "What it means intuitively, when to use it, how it connects to #concept-xyz, what each term represents",
      "relatedConcepts": ["#concept-id1", "#concept-id2"]
    }
  ],
  "definitions": [
    { 
      "id": "#def-unique-id", 
      "term": "Term", 
      "formalDefinition": "Precise mathematical definition",
      "intuitiveExplanation": "Plain language meaning with analogy",
      "usedIn": ["#formula-id1", "#concept-id2"]
    }
  ],
  "workedExample": {
    "problemStatement": "Complete problem description",
    "solution": "Step-by-step solution with explicit tag references at each step",
    "keyTakeaways": ["Insight 1 with tags", "Insight 2 with tags"],
    "commonMistakes": ["Mistake 1 and how to avoid it", "Mistake 2"]
  },
  "quiz": [
    { 
      "question": "Question text with context", 
      "answer": "Detailed answer that references specific concepts/formulas using tags",
      "difficulty": "easy|medium|hard",
      "testsConcepts": ["#concept-id", "#formula-id"]
    }
  ],
  "tips": [
    { 
      "id": "#tip-unique-id", 
      "text": "Practical tip with specific example and WHY it matters",
      "relatesTo": ["#concept-id", "#formula-id"],
      "commonMistake": "What mistake this prevents"
    }
  ]
}
\`\`\`
`;

    // 3. Call AI with better model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      }
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 4. Parse Response with improved error handling
    let content;
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const jsonString = jsonMatch ? jsonMatch[1] : text;

      const cleanJson = cleanLatexInJson(jsonString);
      content = JSON.parse(cleanJson);

      // Validate required fields
      if (!content.coreIntuition || !Array.isArray(content.importantConcepts)) {
        throw new Error("Invalid content structure from AI");
      }

    } catch (e) {
      console.error("Failed to parse AI response. Raw text:", text.substring(0, 500));
      require('fs').writeFileSync(
        `ai_response_error_${Date.now()}.txt`,
        `Error: ${e.message}\n\nFull Response:\n${text}`
      );
      throw new AIGenerationError(`Failed to parse AI response for revision: ${e.message}`);
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

/**
 * Generates a contextual practice question based on revision content.
 * @param {object} params - { revisionContent, difficulty, focusArea }
 * @returns {Promise<object>} The generated question object.
 */
exports.generatePracticeQuestion = async ({
  revisionContent,
  difficulty = "medium",
  focusArea = null,
  userQuestion = null,
  userImage = null
}) => {
  try {
    let prompt;

    if (userQuestion || userImage) {
      // Prompt for User's Question
      prompt = `
You are an expert tutor helping a student solve their own question based on the revision material.

**Revision Content**:
${JSON.stringify(revisionContent, null, 2)}

**Student's Question**:
${userQuestion ? userQuestion : "The student has uploaded an image of their question. Please analyze the image and solve it."}
${userImage ? "[Image Attached]" : ""}

**Task**: Analyze the student's question (text and/or image) and provide a structured solution that connects back to the revision content.

**Requirements**:
1. Answer the specific question asked by the student.
2. If the user provided an image but no text, **EXTRACT the text from the image** and use it as the "question" field.
3. Use the same format as a practice question (hints, solution, answer, tags).
4. Explicitly reference concepts/formulas from the revision content using tags.
5. If the question is unrelated to the content, politely explain why but still try to answer it if possible, or guide them back to the topic.

**CRITICAL JSON ESCAPING FOR LaTeX**:
You must properly escape LaTeX in JSON strings. Follow these rules:
1. Use DOUBLE backslashes (\\\\) for ALL LaTeX commands in JSON
   - Example: To display \\theta, write \\\\theta in the JSON
2. DO NOT use quadruple backslashes (\\\\\\\\)
3. DO NOT use single backslashes (\\)

**Output Format**:
\`\`\`json
{
  "question": "${userQuestion ? userQuestion.replace(/"/g, '\\"') : "EXTRACTED_TEXT_FROM_IMAGE"}", 
  "hints": [
    "Hint 1 related to the user's question with #tag",
    "Hint 2 with #tag"
  ],
  "solution": "Step-by-step solution to the user's question. Format: 'Step 1: [Action]...'",
  "answer": "Final concise answer to the user's question",
  "relevantTags": ["#concept-id", "#formula-id"],
  "difficulty": "user-defined",
  "skillsTested": ["Analysis", "Application"],
  "commonMistakes": ["Potential pitfalls for this specific question"],
  "connectionToRevision": "How this question relates to the study material"
}
\`\`\`
`;
    } else {
      // Standard Practice Question Prompt
      prompt = `
You are an expert tutor creating a practice question that feels connected to the revision material.

**Revision Content**:
${JSON.stringify(revisionContent, null, 2)}

**Task**: Generate ONE practice question (difficulty: ${difficulty})
${focusArea ? `**Focus Area**: Emphasize ${focusArea}` : ""}

**Requirements**:
1. The question should feel like a natural extension of the worked example
2. Reference the same context/scenario if possible
3. Test understanding, not just memorization
4. Solution should explicitly show the thinking process
5. Call out which concepts/formulas are being used at each step

**Difficulty Guidelines**:
- easy: Direct application of one concept/formula
- medium: Combine 2-3 concepts, requires some reasoning
- hard: Multi-step problem requiring deep understanding and synthesis

**CRITICAL JSON ESCAPING FOR LaTeX**:
You must properly escape LaTeX in JSON strings. Follow these rules:

1. Use DOUBLE backslashes (\\\\) for ALL LaTeX commands in JSON
   - Example: To display \\theta, write \\\\theta in the JSON
   - Example: To display \\frac{a}{b}, write \\\\frac{a}{b} in the JSON

2. Common examples:
   - "$P^{(n)} = P_1 \\\\times P_2 \\\\times \\\\dots \\\\times P_n$"
   - "$\\\\hat{\\\\theta}_{MLE} = \\\\arg\\\\max_{\\\\theta} L(\\\\theta)$"
   - "$(x_1, \\\\dots, x_n) \\\\in \\\\mathbb{R}^n$"

3. DO NOT use quadruple backslashes (\\\\\\\\)
4. DO NOT use single backslashes (\\)

**Output Format**:
\`\`\`json
{
  "question": "Problem statement with context (use $ for math with \\\\ for LaTeX commands)",
  "hints": [
    "Progressive hint 1 with #tag reference",
    "Progressive hint 2 with #tag reference"
  ],
  "solution": "Step-by-step solution with explicit reasoning and tag references at each step. Format: 'Step 1: [Action] because [reason referencing #concept-xyz]...'",
  "answer": "Final concise answer",
  "relevantTags": ["#concept-id", "#formula-id", "#tip-id"],
  "difficulty": "${difficulty}",
  "skillsTested": ["Skill 1", "Skill 2"],
  "commonMistakes": ["What students often get wrong here"],
  "connectionToRevision": "How this question builds on the worked example or quiz"
}
\`\`\`
`;
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      }
    });

    // Construct parts array
    const parts = [prompt];
    if (userImage) {
      parts.push({
        inlineData: {
          data: userImage,
          mimeType: "image/jpeg" // Assuming jpeg for simplicity, or detect if passed
        }
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();

    let questionData;
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const jsonString = jsonMatch ? jsonMatch[1] : text;

      const cleanJson = cleanLatexInJson(jsonString);
      questionData = JSON.parse(cleanJson);

      // Validate required fields
      if (!questionData.question || !questionData.solution) {
        throw new Error("Invalid question structure from AI");
      }

    } catch (e) {
      console.error("Failed to parse AI response for practice question.");
      require('fs').writeFileSync(
        `ai_practice_error_${Date.now()}.txt`,
        `Error: ${e.message}\n\nFull Response:\n${text}`
      );
      throw new AIGenerationError(`Failed to parse practice question: ${e.message}`);
    }

    return questionData;
  } catch (err) {
    console.error("Error in generatePracticeQuestion:", err);
    throw err;
  }
};          