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

  const previouslyCovered =
    previousSubtopics.map((st) => st.name).join(", ") || "None";

  const buildContinuityContext = () => {
    if (narrativeHistory.length === 0) {
      return "This is the first subtopic. Establish foundational context that connects to the student's prior knowledge.";
    }
    return narrativeHistory
      .slice(-3)
      .map((h, i) => `${i + 1}. ${h.storyElement}`)
      .join("\n");
  };

  const prompt = `You are a world-class educator creating a complete, self-contained learning module. Your content must be so comprehensive and clear that students can master "${currentSubtopic.name}" without any supplementary materials.

 # COURSE CONTEXT
 **Subject**: ${session.subjectName}
 **Learning Goal**: ${session.narrativeContext?.mainTheme || session.goal}
 **Current Topic**: ${currentTopic.name}
 **Current Subtopic**: ${currentSubtopic.name}
 **Description**: ${currentSubtopic.description}
 **Previously Covered**: ${previouslyCovered}
 **Concepts Already Learned**: ${conceptsLearned.join(", ") || "None yet"}

 # NARRATIVE CONTINUITY
 ${buildContinuityContext()}

 ---

 # YOUR MISSION
 Create a complete learning resource that:
 ✓ Answers "Why does this matter?" with authentic real-world applications
 ✓ Provides ALL theoretical foundation needed for mastery
 ✓ Includes sufficient worked examples to internalize concepts
 ✓ Leaves no critical gaps in understanding
 ✓ Feels like learning from an exceptional professor

 # ABSOLUTE REQUIREMENTS
 🚫 NEVER use fictional scenarios (made-up exams, imaginary characters, contrived situations)
 ✅ ALWAYS use real applications (industry problems, research questions, practical tools)
 ✅ MUST include complete formulas, proofs, and derivations
 ✅ MUST provide step-by-step examples with full explanations
 ✅ MUST connect to prior knowledge and preview future connections

 ---

 # CONTENT STRUCTURE

 ## 1. Real-World Context & Motivation (5-10% of content)

 **Purpose**: Answer "Why should anyone care about this?" with genuine conviction.

 **What to include**:
 - Start with a concrete, real problem from: engineering, data science, physics, computer graphics, economics, or research
 - Explain what's impossible or inefficient WITHOUT this concept
 - Show what becomes possible WITH this concept
 - Connect to tools/technologies students may have heard of
 - Bridge from familiar ideas they already understand

 **Quality standards**:
 - Specific enough to be believable (name real applications, not generic "it's useful")
 - Compelling enough to create genuine curiosity
 - Honest about where this fits in the bigger picture
 - 4-5 substantial paragraphs

 **Example opening**: Instead of "Imagine a student taking an exam...", use "When engineers at Pixar need to calculate how light bounces off surfaces in a 3D scene, they're essentially computing millions of dot products per frame. Without an efficient way to measure how aligned two directions are..."

 ---

 ## 2. Intuitive Foundation (5-10% of content)

 **Purpose**: Build mental models BEFORE formal definitions.

 **What to include**:
 - Explain the core idea in plain language first
 - Use 1-2 powerful analogies or visual descriptions
 - Preview the key components without jargon
 - Address the most common initial confusion
 - Set up what's coming in the theory section

 **Quality standards**:
 - Accessible to someone who knows the prerequisites but not this topic
 - Creates "aha!" moments that make formal definitions feel natural
 - 3-4 paragraphs that progressively build intuition

 ---

 ## 3. Complete Theory (75-80% of content)

 **Purpose**: Provide COMPREHENSIVE technical instruction. This is the core.

 **Mandatory structure** (use ### headings):

 ### 3.1 Precise Definitions
 - State formal mathematical/technical definitions
 - Define EVERY symbol, term, and variable
 - Specify all conditions, constraints, domains
 - Clarify notation conventions you're using
 - Compare to related definitions students know

 ### 3.2 Fundamental Concepts
 - Explain the underlying principles in depth
 - Show how components relate and interact
 - Discuss the logic or intuition behind the math
 - Address misconceptions explicitly
 - Build from simple to complex progressively

 ### 3.3 Mathematical Framework
 For EACH major formula:
 - State the formula clearly (use LaTeX)
 - Explain what each component represents
 - Show derivation or justify why it's true
 - Discuss when it applies (and when it doesn't)
 - Provide geometric/visual interpretation if possible

 ### 3.4 Worked Examples (CRITICAL)
 Include 3-5 examples that:
 - Progress from basic to advanced
 - Show EVERY computational step
 - Explain the reasoning at each decision point
 - Highlight where students commonly make errors
 - Demonstrate different scenarios/edge cases

 **Example template**:
 > **Example 1: Basic Application**
 > Problem: [State clearly]
 > Given: [List what we know]
 > Find: [What we're solving for]
 >
 > Solution:
 > Step 1: [Action]
 > [Show calculation]
 > [Explain why we do this]
 >
 > Step 2: [Action]
 > [Show calculation]
 > [Explain reasoning]
 >
 > Result: [Final answer with units/interpretation]
 > Key insight: [What this demonstrates]

 ### 3.5 Properties & Theorems
 - State important properties with formal notation
 - Provide proofs or justifications
 - Explain practical implications
 - Show how these properties enable applications

 ### 3.6 Computational Aspects
 - Discuss how to calculate efficiently
 - Mention numerical considerations
 - Address common implementation issues
 - Connect to algorithms if relevant

 ### 3.7 Connections & Extensions
 - Link to previously learned concepts
 - Preview how this enables future topics
 - Mention advanced generalizations
 - Discuss limitations and edge cases

 **Use these pedagogical markers**:

 > **🔑 Key Definition**: [For crucial formal definitions]

 > **💡 Intuition**: [For conceptual insights that aid understanding]

 > **⚠️ Common Pitfall**: [For mistakes students frequently make]

 > **🔬 Example**: [For worked demonstrations]

 > **✨ Pro Tip**: [For expert insights and shortcuts]

 **Quality standards for theory section**:
 - Complete enough to solve homework problems
 - Detailed enough that steps are reproducible
 - Clear enough for self-study
 - Rigorous enough for university level
 - Approximately 8-12 substantial subsections with examples

 ---

 ## 4. Synthesis & Reinforcement (10-15% of content)

 **Purpose**: Consolidate learning and show the bigger picture.

 **What to include**:
 1. Circle back to the original motivation - how does this concept solve it?
 2. Summarize the 3-5 most critical takeaways
 3. List essential formulas/definitions to memorize
 4. Explain where this fits in ${session.subjectName} overall
 5. Preview what becomes possible now that they know this
 6. Provide 2-3 directions for further exploration

 **Quality standards**:
 - Feels like a satisfying conclusion
 - Reinforces confidence in understanding
 - Creates excitement for what's next
 - 4-5 paragraphs

 ---

 ## 5. Metadata (Required)

 \`\`\`json
 {
   "conceptsIntroduced": ["list of 3-7 key concepts taught"],
   "newTerminology": {
     "term1": "precise technical definition",
     "term2": "precise technical definition"
   },
   "newNotation": {
     "symbol1": "what it represents and how to read it",
     "symbol2": "what it represents and how to read it"
   },
   "prerequisitesCited": ["concepts referenced from prior learning"],
   "realWorldApplications": ["specific applications mentioned"],
   "formulasIntroduced": ["key equations taught"]
 }
 \`\`\`

 ---

 # STYLE REQUIREMENTS

 **Notation consistency**: ${Object.keys(notationMap).length > 0 ? `Use established notation: ${JSON.stringify(notationMap)}` : "Establish clear notation and use it consistently"}

 **Terminology**: ${Object.keys(terminologyMap).length > 0 ? `Use consistent terms: ${JSON.stringify(terminologyMap)}` : "Use standard technical terminology"}

 **Tone**:
 - Authoritative but encouraging
 - Precise but not pedantic
 - Enthusiastic but not gimmicky
 - Like the best professor you ever had

 **Mathematical formatting**:
 - Inline math: $...$
 - Display equations: $$...$$
 - Number important equations: (1), (2), etc.
 - Define variables immediately after introducing them

 **Depth calibration**:
 - Assume students have completed prerequisites
 - Don't over-explain basics, but don't skip steps
 - Balance rigor with accessibility
 - Aim for "just right" challenge level

 ---

 # QUALITY CHECKLIST

 Before submitting, verify your content:
 - [ ] Could a motivated student learn this WITHOUT textbooks/videos?
 - [ ] Are there at least 3 substantial worked examples?
 - [ ] Is every formula explained with all variables defined?
 - [ ] Does the motivation use REAL applications (not fictional)?
 - [ ] Are common misconceptions addressed?
 - [ ] Is the progression logical (simple → complex)?
 - [ ] Would YOU feel confident after reading this?

 ---

 # CONTENT EXPECTATIONS BY SECTION LENGTH

 Approximate token allocation:
 - Real-World Context: 400-600 tokens
 - Intuitive Foundation: 300-400 tokens
 - Complete Theory: 2000-3000 tokens (the bulk!)
 - Synthesis: 400-500 tokens
 - Total target: ~3500-4500 tokens of dense, valuable content

 Remember: This is NOT a blog post or tutorial. This is a comprehensive learning module that replaces a textbook chapter. Every sentence should teach something essential.

 Generate complete, publication-quality educational content now.`;

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
      .split(/## 1\. Real-World Context & Motivation/i)[1]
      ?.split(/## 2\. Intuitive Foundation/i)[0]
      ?.trim() || "";
  const introduction =
    text
      .split(/## 2\. Intuitive Foundation/i)[1]
      ?.split(/## 3\. Complete Theory/i)[0]
      ?.trim() || "";
  const theory =
    text
      .split(/## 3\. Complete Theory/i)[1]
      ?.split(/## 4\. Synthesis & Reinforcement/i)[0]
      ?.trim() || "";
  const summary =
    text
      .split(/## 4\. Synthesis & Reinforcement/i)[1]
      ?.split(/## 5\. Metadata/i)[0]
      ?.trim() || "";
  const metadataText = text.split(/## 5\. Metadata/i)[1]?.trim();

  let metadata = {};
  if (metadataText) {
    // Extract JSON from markdown code block
    const jsonMatch = metadataText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        metadata = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error("Failed to parse metadata JSON:", e);
      }
    }
  }

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
    metadata,
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
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
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

    // 6. Update Context Memory
    const newNarrativeElement = {
      subtopicId,
      storyElement: parsedContent.story.substring(0, 200) + "...",
    };
    await contextService.updateContextMemory(context.session.sessionId, {
      newNarrativeElements: [newNarrativeElement],
      newTerminology: parsedContent.metadata.newTerminology,
      newNotation: parsedContent.metadata.newNotation,
      conceptsIntroduced: parsedContent.metadata.conceptsIntroduced,
    });

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
