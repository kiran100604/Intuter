/**
 * Enhanced Question Answerer with Context Management
 *
 * Answers student questions with full awareness of:
 * - What they've learned so far
 * - Recent conversation history
 * - Related concepts across the course
 * - Connected concepts from all modes (reading, learning, revision)
 */

const Anthropic = require('@anthropic-ai/sdk');
const ContextManager = require('../contextManager');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Answer a student question with full context awareness
 */
exports.answerQuestion = async ({
  question,
  sessionId,
  subtopicId,
  conversationHistory = []
}) => {
  // Build context using context manager
  const contextManager = new ContextManager(sessionId);
  const contextData = await contextManager.buildQuestionContext(subtopicId, question);

  // Build conversation context from history (last 3 exchanges max for tokens)
  const recentHistory = conversationHistory.slice(-3);
  const historyContext = recentHistory.map(h =>
    `Student: ${h.question}\nTutor: ${h.answer}`
  ).join('\n\n');

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(question, contextData.context, historyContext);

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const answer = message.content[0].text.trim();

    // Extract any concepts mentioned in the answer for linking
    const mentionedConcepts = await extractMentionedConcepts(question, answer);

    return {
      answer,
      contextUsed: contextData.contextParts,
      tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens,
      mentionedConcepts,
      shouldSummarize: conversationHistory.length >= 10 // Suggest summarization
    };
  } catch (err) {
    console.error('Error answering question:', err);
    return {
      answer: `I encountered an error while processing your question. Please try again.`,
      error: err.message
    };
  }
};

/**
 * Generate a summary of chat history for token optimization
 */
exports.summarizeConversation = async (conversationHistory, sessionId) => {
  if (conversationHistory.length < 5) {
    return null; // Not enough to summarize
  }

  const historyText = conversationHistory.map(h =>
    `Q: ${h.question}\nA: ${h.answer?.substring(0, 200)}`
  ).join('\n\n');

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Summarize this tutoring conversation. Focus on:
1. Key topics discussed
2. Main concepts explained
3. Questions that were clarified
4. Any remaining confusion points

Conversation:
${historyText}

Provide a concise summary (max 200 words) that captures the essential learning context.`
      }]
    });

    return {
      summary: message.content[0].text.trim(),
      originalCount: conversationHistory.length,
      summarizedAt: new Date()
    };
  } catch (err) {
    console.error('Error summarizing conversation:', err);
    return null;
  }
};

/**
 * Answer with explicit connection to learned concepts
 */
exports.answerWithConceptLinks = async ({
  question,
  sessionId,
  subtopicId,
  conversationHistory = []
}) => {
  const response = await exports.answerQuestion({
    question,
    sessionId,
    subtopicId,
    conversationHistory
  });

  // Get related concepts that might help
  const contextManager = new ContextManager(sessionId);
  const relatedConcepts = await contextManager.getRelatedConcepts(question, subtopicId);

  // Format concept links
  const conceptLinks = relatedConcepts.map(c => ({
    name: c.conceptName,
    importance: c.importance,
    fromSubtopic: c.subtopicId
  }));

  return {
    ...response,
    relatedConcepts: conceptLinks,
    studyRecommendations: generateStudyRecommendations(relatedConcepts)
  };
};

/**
 * Build system prompt for question answering
 */
function buildSystemPrompt() {
  return `You are a knowledgeable and patient tutor helping a university student.

KEY PRINCIPLES:
1. **Use Context**: Reference what the student has already learned. Don't re-explain basics they know.

2. **Be Precise**: Give accurate, technically correct answers. Don't oversimplify to the point of inaccuracy.

3. **Connect Concepts**: Show how the current question relates to other topics they're studying.

4. **Guide, Don't Just Tell**: For problem-solving questions, guide them through the thinking process. Help them learn how to approach similar problems.

5. **Acknowledge Limits**: If a question is outside what they've learned, acknowledge this and provide context they might need.

6. **Be Concise**: Answer the question directly. Add depth only where it genuinely helps understanding.

7. **Exam Awareness**: When relevant, mention if something is "commonly tested" or "important to remember."

RESPONSE FORMAT:
- Use clear structure with headings for complex answers
- Use bullet points for lists
- Use code blocks for code/formulas
- Keep answers focused and relevant`;
}

/**
 * Build user prompt with context
 */
function buildUserPrompt(question, context, historyContext) {
  let prompt = '';

  if (context) {
    prompt += `LEARNING CONTEXT:
${context}

`;
  }

  if (historyContext) {
    prompt += `RECENT CONVERSATION:
${historyContext}

`;
  }

  prompt += `STUDENT'S QUESTION:
${question}

Please provide a helpful, accurate answer based on the context provided.`;

  return prompt;
}

/**
 * Extract concepts mentioned in Q&A for linking
 */
async function extractMentionedConcepts(question, answer) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `From this Q&A, extract any key technical concepts mentioned. Return as JSON array of strings.
Only include important concepts, not common words.

Q: ${question}
A: ${answer}

Return format: { "concepts": ["concept1", "concept2"] }`
      }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]).concepts;
    }
    return [];
  } catch (err) {
    return [];
  }
}

/**
 * Generate study recommendations based on related concepts
 */
function generateStudyRecommendations(relatedConcepts) {
  if (!relatedConcepts || relatedConcepts.length === 0) {
    return [];
  }

  const recommendations = [];

  // High importance concepts should be reviewed
  const highImportance = relatedConcepts.filter(c => c.importance === 'high');
  if (highImportance.length > 0) {
    recommendations.push({
      type: 'review',
      message: `Consider reviewing: ${highImportance.map(c => c.conceptName).join(', ')}`,
      concepts: highImportance.map(c => c.conceptName)
    });
  }

  return recommendations;
}

/**
 * Check if conversation needs summarization (token optimization)
 */
exports.shouldSummarizeConversation = (conversationHistory, tokenThreshold = 2000) => {
  if (!conversationHistory || conversationHistory.length < 8) {
    return false;
  }

  // Rough token estimate
  const totalChars = conversationHistory.reduce((sum, h) =>
    sum + (h.question?.length || 0) + (h.answer?.length || 0), 0
  );
  const estimatedTokens = totalChars / 4;

  return estimatedTokens > tokenThreshold;
};
