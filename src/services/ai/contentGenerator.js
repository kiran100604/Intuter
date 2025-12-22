/**
 * Enhanced Content Generator with Adaptive Teaching Styles
 *
 * Generates learning content using first-principles approach,
 * progressive complexity, and context-aware explanations.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { AIGenerationError } = require('../../utils/errors');
const ContextManager = require('../contextManager');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Teaching styles available for content generation
 */
const TEACHING_STYLES = {
  FIRST_PRINCIPLES: 'first_principles',
  PRACTICAL: 'practical',
  ACADEMIC: 'academic',
  INTUITIVE: 'intuitive'
};

/**
 * Detect optimal teaching style based on topic characteristics
 */
function detectTeachingStyle(subtopicName, description) {
  const name = (subtopicName + ' ' + description).toLowerCase();

  // Mathematical/theoretical topics benefit from first principles
  if (/theorem|proof|algorithm|mathematical|formula|equation|calculus|algebra/.test(name)) {
    return TEACHING_STYLES.FIRST_PRINCIPLES;
  }

  // Programming/technical topics benefit from practical approach
  if (/implementation|coding|programming|build|create|develop|api|database/.test(name)) {
    return TEACHING_STYLES.PRACTICAL;
  }

  // Conceptual/abstract topics benefit from intuitive approach
  if (/concept|theory|principle|philosophy|design|pattern|architecture/.test(name)) {
    return TEACHING_STYLES.INTUITIVE;
  }

  // Default to first principles for most educational content
  return TEACHING_STYLES.FIRST_PRINCIPLES;
}

/**
 * Generate learning content with context and adaptive style
 */
exports.generateContent = async ({
  subtopicName,
  step,
  description,
  sessionId,
  subtopicId,
  teachingStyle,
  userInstructions,
  includeVisuals = true
}) => {
  // Auto-detect teaching style if not specified
  const style = teachingStyle || detectTeachingStyle(subtopicName, description);

  // Build context using context manager
  let contextData = { context: '', teachingInstructions: '', stepGuidance: {} };
  if (sessionId && subtopicId) {
    const contextManager = new ContextManager(sessionId);
    contextData = await contextManager.buildContentContext(subtopicId, step, {
      teachingStyle: style,
      includePrerequisites: true
    });
  }

  // Build the system prompt
  const systemPrompt = buildSystemPrompt(style, step, includeVisuals);

  // Build the user prompt
  const userPrompt = buildUserPrompt({
    subtopicName,
    step,
    description,
    context: contextData.context,
    teachingInstructions: contextData.teachingInstructions,
    stepGuidance: contextData.stepGuidance,
    userInstructions
  });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const text = message.content[0].text.trim();
    if (!text) throw new AIGenerationError('No content generated');

    return {
      content: text,
      teachingStyle: style,
      metadata: {
        step,
        tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens,
        contextUsed: contextData.contextParts || []
      }
    };
  } catch (err) {
    throw new AIGenerationError(err.message);
  }
};

/**
 * Generate content with explicit concept extraction
 * Returns both content and extracted key concepts
 */
exports.generateContentWithConcepts = async (params) => {
  const result = await exports.generateContent(params);

  // Extract concepts from the generated content
  const concepts = await extractConcepts(result.content, params.subtopicName);

  return {
    ...result,
    extractedConcepts: concepts
  };
};

/**
 * Regenerate specific section with user feedback
 */
exports.regenerateWithFeedback = async ({
  subtopicName,
  step,
  description,
  originalContent,
  userFeedback,
  sessionId,
  subtopicId
}) => {
  const systemPrompt = `You are an expert educator improving learning content based on student feedback.
The student found issues with the original explanation and wants it improved.

Key principles:
1. Address the specific feedback directly
2. Maintain consistency with what was already taught
3. Use clearer explanations or different approaches
4. Don't oversimplify - maintain academic rigor while being clear`;

  const userPrompt = `
TOPIC: ${subtopicName}
STEP: ${step}
DESCRIPTION: ${description}

ORIGINAL CONTENT:
${originalContent}

STUDENT FEEDBACK:
${userFeedback}

Please regenerate this content addressing the student's feedback. Make the improvements they requested while maintaining the quality and completeness of the explanation.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const text = message.content[0].text.trim();
    if (!text) throw new AIGenerationError('No content generated');

    return {
      content: text,
      regeneratedFrom: 'user_feedback',
      feedbackAddressed: userFeedback
    };
  } catch (err) {
    throw new AIGenerationError(err.message);
  }
};

/**
 * Add missing content to existing explanation
 */
exports.addMissingContent = async ({
  subtopicName,
  step,
  existingContent,
  missingTopic,
  sessionId,
  subtopicId
}) => {
  const systemPrompt = `You are an expert educator adding supplementary content to an existing lesson.
The student has identified a gap in the current content that needs to be filled.

Key principles:
1. Seamlessly integrate with existing content
2. Maintain consistent terminology and style
3. Connect new content to what's already explained
4. Mark where the new content should be inserted with clear transitions`;

  const userPrompt = `
CURRENT SUBTOPIC: ${subtopicName}
STEP: ${step}

EXISTING CONTENT:
${existingContent}

MISSING TOPIC TO ADD:
${missingTopic}

Please create additional content that covers this missing topic and integrates well with the existing content. Indicate where this content should be inserted and provide smooth transitions.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const text = message.content[0].text.trim();
    if (!text) throw new AIGenerationError('No content generated');

    return {
      additionalContent: text,
      addedTopic: missingTopic,
      action: 'supplement'
    };
  } catch (err) {
    throw new AIGenerationError(err.message);
  }
};

/**
 * Build system prompt based on teaching style
 */
function buildSystemPrompt(style, step, includeVisuals) {
  let basePrompt = `You are an expert educator creating high-quality learning content for university students.

CORE PRINCIPLES:
1. **Clarity without Oversimplification**: Explain complex concepts clearly, but don't water them down. Students need to understand the actual mechanics, not just analogies.

2. **First Principles Foundation**: Start from fundamental truths and build up. Don't assume knowledge of this specific topic.

3. **Progressive Complexity**: Start simple, then gradually introduce nuance and edge cases.

4. **Connection Building**: Always connect new concepts to:
   - What students already know (prerequisites)
   - Why this matters (real-world applications)
   - How it relates to other topics in the course

5. **Exam Readiness**: Content should prepare students for rigorous examination. Include:
   - Key definitions they might need to recall
   - Common variations of problems
   - Typical mistakes to avoid`;

  if (includeVisuals) {
    basePrompt += `

6. **Visual Learning**: When concepts benefit from visualization:
   - Describe diagrams in detail using markdown (you can suggest ASCII diagrams)
   - Indicate where graphs/charts would help with [DIAGRAM: description]
   - Use tables for comparisons
   - Format code blocks properly with language tags`;
  }

  // Add step-specific guidance
  const stepGuidance = {
    introduction: `

FOR THIS INTRODUCTION:
- Hook: Why should students care about this?
- Overview: What is this topic at its core?
- Preview: What will they learn?
- Connection: How does this fit in the bigger picture?
- Keep it engaging and accessible`,

    understanding: `

FOR DEEP UNDERSTANDING:
- Explain the mechanics/processes/algorithms in detail
- Use worked examples with step-by-step reasoning
- Address common misconceptions explicitly
- Include formal definitions alongside intuitive explanations
- Build complete mental models`,

    mastering: `

FOR MASTERY:
- Apply concepts to challenging, exam-style problems
- Cover edge cases and special situations
- Show how concepts connect across the course
- Include practice problems (with hints, not full solutions initially)
- Prepare for potential exam questions`
  };

  return basePrompt + (stepGuidance[step] || '');
}

/**
 * Build user prompt with all context
 */
function buildUserPrompt({
  subtopicName,
  step,
  description,
  context,
  teachingInstructions,
  stepGuidance,
  userInstructions
}) {
  let prompt = `
SUBTOPIC: ${subtopicName}
STEP: ${step.toUpperCase()}
DESCRIPTION: ${description || 'No additional description provided'}`;

  if (context) {
    prompt += `

CONTEXT (what the student has already learned):
${context}`;
  }

  if (teachingInstructions) {
    prompt += `

TEACHING APPROACH:
${teachingInstructions}`;
  }

  if (userInstructions) {
    prompt += `

SPECIAL INSTRUCTIONS FROM STUDENT:
${userInstructions}`;
  }

  prompt += `

Please create comprehensive ${step} content for this subtopic. Format using markdown with clear headings, bullet points, and code blocks where appropriate.`;

  return prompt;
}

/**
 * Extract key concepts from generated content
 */
async function extractConcepts(content, subtopicName) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Extract 3-5 key concepts from this learning content. For each concept, provide:
1. concept_name: A short name (2-4 words)
2. importance: high/medium/low
3. brief_explanation: One sentence explanation

Content about "${subtopicName}":
${content}

Respond in JSON format:
{ "concepts": [{ "concept_name": "...", "importance": "...", "brief_explanation": "..." }] }`
      }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]).concepts;
    }
    return [];
  } catch (err) {
    console.error('Error extracting concepts:', err);
    return [];
  }
}

// Export teaching styles for external use
exports.TEACHING_STYLES = TEACHING_STYLES;
exports.detectTeachingStyle = detectTeachingStyle;
