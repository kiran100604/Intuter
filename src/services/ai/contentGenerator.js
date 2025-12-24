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

 # CONTENT STRUCTURE: INTERACTIVE BLOCKS

 Your content will be displayed in interactive blocks that users can act on
 (explain further, simplify, add examples, etc.). Structure your output with
 clear block boundaries using this marker format:

 <!-- BLOCK: type="..." title="..." -->
 [Your content here]
 <!-- END BLOCK -->

 ## Block Types (use the most appropriate):

 - \`context\` — Real-world motivation, why this matters
 - \`intuition\` — Conceptual explanation, mental models
 - \`definition\` — Formal definition with explanation (keep formula + explanation together)
 - \`theorem\` — Mathematical property or theorem with proof/justification
 - \`example\` — Complete worked example (problem through solution)
 - \`insight\` — Key takeaway, "aha moment", or pro tip
 - \`warning\` — Common mistake or misconception
 - \`summary\` — Recap or synthesis
 - \`concept\` — Core concept explanation
 - \`formula\` — Mathematical formula with explanation

 ## Critical Block Rules:

 1. **NEVER separate an equation from its explanation** — they must be in the same block
 2. **Examples are single blocks** — all steps of an example stay together
 3. **Each block should be self-contained enough that "explain this" makes sense**
 4. **Minimum block size: 2-3 sentences or 1 equation + explanation**
 5. **Maximum block size: ~300 words** (break larger content into logical sub-blocks)
 6. **Every piece of content MUST be inside a block** — no content outside blocks

 ---

 ## 1. Real-World Context & Motivation (5-10% of content)

 **Purpose**: Answer "Why should anyone care about this?" with genuine conviction.

 <!-- BLOCK: type="context" title="Why This Matters" -->
 Start with a concrete, real problem from: engineering, data science, physics,
 computer graphics, economics, or research. Explain what's impossible or
 inefficient WITHOUT this concept, and show what becomes possible WITH it.
 Connect to tools/technologies students may have heard of.
 <!-- END BLOCK -->

 **Quality standards**:
 - Specific enough to be believable (name real applications, not generic "it's useful")
 - Compelling enough to create genuine curiosity
 - Honest about where this fits in the bigger picture
 - 4-5 substantial paragraphs

 **Example opening**: Instead of "Imagine a student taking an exam...", use "When engineers at Pixar need to calculate how light bounces off surfaces in a 3D scene, they're essentially computing millions of dot products per frame. Without an efficient way to measure how aligned two directions are..."

 ---

 ## 2. Intuitive Foundation (5-10% of content)

 **Purpose**: Build mental models BEFORE formal definitions.

 <!-- BLOCK: type="intuition" title="The Core Idea" -->
 Explain the core idea in plain language first. Use 1-2 powerful analogies
 or visual descriptions. Preview the key components without jargon.
 <!-- END BLOCK -->

 **Quality standards**:
 - Accessible to someone who knows the prerequisites but not this topic
 - Creates "aha!" moments that make formal definitions feel natural
 - 3-4 paragraphs that progressively build intuition

 ---

 ## 3. Complete Theory (75-80% of content)

 **Purpose**: Provide COMPREHENSIVE technical instruction. This is the core.

 ### 3.1 Precise Definitions
 <!-- BLOCK: type="definition" title="[Term Name]" -->
 State formal mathematical/technical definition with ALL symbols defined.
 Include the formula AND its explanation in the same block.

 **Example format**:
 **🔑 Key Definition**: An eigenvalue λ of a matrix A is a scalar such that:
 $$A\\vec{v} = \\lambda\\vec{v}$$
 where $\\vec{v}$ is a non-zero vector called the eigenvector.
 <!-- END BLOCK -->

 ### 3.2 Fundamental Concepts
 <!-- BLOCK: type="concept" title="[Concept Name]" -->
 Explain the underlying principles in depth. Show how components relate
 and interact. Discuss the logic or intuition behind the math.
 <!-- END BLOCK -->

 ### 3.3 Mathematical Framework
 For EACH major formula, create a formula block:
 <!-- BLOCK: type="formula" title="[Formula Name]" -->
 State the formula clearly (use LaTeX), explain what each component represents,
 show derivation or justify why it's true, and provide geometric interpretation.
 <!-- END BLOCK -->

 ### 3.4 Worked Examples (CRITICAL)
 Include 3-5 examples that progress from basic to advanced.
 **IMPORTANT**: Each complete example is ONE block with all steps together:

 <!-- BLOCK: type="example" title="Finding Eigenvalues of a 2×2 Matrix" -->
 **Problem**: Find the eigenvalues of $A = \\begin{pmatrix} 4 & 1 \\\\ 2 & 3 \\end{pmatrix}$

 **Step 1**: Set up the characteristic equation
 $$\\det(A - \\lambda I) = 0$$

 **Step 2**: Compute the determinant
 $$\\det\\begin{pmatrix} 4-\\lambda & 1 \\\\ 2 & 3-\\lambda \\end{pmatrix} = (4-\\lambda)(3-\\lambda) - 2$$

 **Step 3**: Solve the quadratic
 $$\\lambda^2 - 7\\lambda + 10 = 0$$
 $$(\\lambda - 5)(\\lambda - 2) = 0$$

 **Result**: $\\lambda_1 = 5$ and $\\lambda_2 = 2$
 <!-- END BLOCK -->

 ### 3.5 Properties & Theorems
 <!-- BLOCK: type="theorem" title="[Theorem Name]" -->
 State important properties with formal notation. Provide proofs or
 justifications. Explain practical implications.
 <!-- END BLOCK -->

 ### 3.6 Key Insights & Pro Tips
 <!-- BLOCK: type="insight" title="[Insight Title]" -->
 💡 **Pro Tip**: Share expert insights, shortcuts, or verification methods.
 Example: For 2×2 matrices, eigenvalues satisfy λ₁ + λ₂ = trace(A) and λ₁ · λ₂ = det(A)
 <!-- END BLOCK -->

 ### 3.7 Common Mistakes to Avoid
 <!-- BLOCK: type="warning" title="[Warning Title]" -->
 ⚠️ **Common Pitfall**: Describe the mistake students frequently make,
 why it happens, and how to avoid it.
 <!-- END BLOCK -->

 ### 3.8 Connections & Extensions
 <!-- BLOCK: type="concept" title="Connections to Other Topics" -->
 Link to previously learned concepts. Preview how this enables future topics.
 Mention advanced generalizations. Discuss limitations and edge cases.
 <!-- END BLOCK -->

 **Quality standards for theory section**:
 - Complete enough to solve homework problems
 - Detailed enough that steps are reproducible
 - Clear enough for self-study
 - Rigorous enough for university level
 - Approximately 8-12 substantial blocks with examples

 ---

 ## 4. Synthesis & Reinforcement (10-15% of content)

 **Purpose**: Consolidate learning and show the bigger picture.

 <!-- BLOCK: type="summary" title="Key Takeaways" -->
 1. Circle back to the original motivation - how does this concept solve it?
 2. Summarize the 3-5 most critical takeaways
 3. List essential formulas/definitions to memorize
 4. Explain where this fits in ${session.subjectName} overall
 5. Preview what becomes possible now that they know this
 <!-- END BLOCK -->

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
  // Helper to extract content between two regex patterns
  const extractSection = (startPattern, endPattern) => {
    const parts = text.split(startPattern);
    if (parts.length < 2) return "";
    const content = parts[1].split(endPattern)[0];
    return content ? content.trim() : "";
  };

  // More flexible patterns that match the section number and key words
  const story = extractSection(
    /##\s*1\.\s*Real-World.*/i,
    /##\s*2\.\s*Intuitive.*/i
  );

  const introduction = extractSection(
    /##\s*2\.\s*Intuitive.*/i,
    /##\s*3\.\s*(?:Complete|Theory).*/i
  );

  const theoryBody = extractSection(
    /##\s*3\.\s*(?:Complete|Theory).*/i,
    /##\s*4\.\s*Synthesis.*/i
  );

  const summary = extractSection(
    /##\s*4\.\s*Synthesis.*/i,
    /##\s*5\.\s*Metadata.*/i
  );

  const metadataText = text.split(/##\s*5\.\s*Metadata.*/i)[1]?.trim();

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
    keyConcepts: theoryBody.match(/> \*\*Key Concept\*\*:/g)?.length || 0,
    examples: theoryBody.match(/> \*\*Example\*\*:/g)?.length || 0,
    proTips: theoryBody.match(/> \*\*Pro Tip\*\*:/g)?.length || 0,
  };

  return {
    story,
    theory: `${introduction}\n\n${theoryBody}`, // Combine intro and theory
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
      console.error("AI Response Parsing Failed. Raw Text Length:", text.length);
      console.error("Raw Text Preview:", text.substring(0, 500) + "...");
      console.error("Parsed Content:", JSON.stringify(parsedContent, null, 2));
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
