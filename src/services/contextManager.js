/**
 * Smart Context Manager
 *
 * Manages learning context across all modes while optimizing token usage.
 * Uses hierarchical summarization and concept linking to maintain coherent
 * context without sending all content to the LLM.
 */

const { ConceptMap, LearningContent, SubtopicProgress, StudySummary, Topic, Subtopic, UserQuestion } = require('../models');
const { Op } = require('sequelize');

/**
 * Context priority levels for different content types
 */
const CONTEXT_PRIORITY = {
  CURRENT_SUBTOPIC: 10,      // What user is currently learning
  CORE_INTUITION: 9,         // Topic's fundamental understanding
  PREREQUISITE: 8,           // Required prior knowledge
  RELATED_CONCEPT: 7,        // Connected concepts
  RECENT_QA: 6,              // Recent questions/answers
  LEARNED_SUMMARY: 5,        // Completed subtopic summaries
  GENERAL_CONTEXT: 3         // General session context
};

/**
 * Maximum context sizes (in approximate tokens)
 */
const MAX_CONTEXT_TOKENS = {
  CHAT: 2000,                // For Q&A responses
  CONTENT_GENERATION: 3000,  // For generating learning content
  SUMMARY: 1000              // For generating summaries
};

class ContextManager {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.contextCache = new Map();
    this.conceptGraph = new Map(); // concept -> related concepts
  }

  /**
   * Build context for answering a question
   * Prioritizes: current topic > recent Q&A > learned concepts
   */
  async buildQuestionContext(subtopicId, question) {
    const contextParts = [];
    let tokenEstimate = 0;
    const maxTokens = MAX_CONTEXT_TOKENS.CHAT;

    // 1. Get current subtopic and topic context
    if (subtopicId) {
      const subtopic = await Subtopic.findByPk(subtopicId, {
        include: [{ model: Topic, as: 'topic' }]
      });

      if (subtopic) {
        // Add core intuition (highest priority)
        if (subtopic.topic?.coreIntuition) {
          const intuitionContext = {
            type: 'core_intuition',
            priority: CONTEXT_PRIORITY.CORE_INTUITION,
            content: `Core Understanding of ${subtopic.topic.name}: ${subtopic.topic.coreIntuition}`,
            tokens: this.estimateTokens(subtopic.topic.coreIntuition)
          };
          contextParts.push(intuitionContext);
          tokenEstimate += intuitionContext.tokens;
        }

        // Add current subtopic summary if learned
        const progress = await SubtopicProgress.findOne({ where: { subtopicId } });
        if (progress?.learningSummary) {
          const summaryContext = {
            type: 'current_summary',
            priority: CONTEXT_PRIORITY.CURRENT_SUBTOPIC,
            content: `Current Topic (${subtopic.name}): ${progress.learningSummary}`,
            tokens: this.estimateTokens(progress.learningSummary)
          };
          contextParts.push(summaryContext);
          tokenEstimate += summaryContext.tokens;
        }

        // Add key concepts from current subtopic
        if (progress?.keyConcepts?.length > 0) {
          const conceptsStr = progress.keyConcepts.join(', ');
          contextParts.push({
            type: 'key_concepts',
            priority: CONTEXT_PRIORITY.CURRENT_SUBTOPIC - 1,
            content: `Key Concepts Learned: ${conceptsStr}`,
            tokens: this.estimateTokens(conceptsStr)
          });
        }
      }
    }

    // 2. Get recent Q&A for conversation continuity (last 5 exchanges)
    const recentQA = await UserQuestion.findAll({
      where: { sessionId: this.sessionId },
      order: [['askedAt', 'DESC']],
      limit: 5
    });

    if (recentQA.length > 0) {
      // Only include Q&A pairs, not full answers (to save tokens)
      const qaContext = recentQA.reverse().map(qa =>
        `Q: ${qa.question}\nA: ${this.truncateText(qa.answer, 150)}`
      ).join('\n\n');

      if (tokenEstimate + this.estimateTokens(qaContext) < maxTokens) {
        contextParts.push({
          type: 'recent_qa',
          priority: CONTEXT_PRIORITY.RECENT_QA,
          content: `Recent Conversation:\n${qaContext}`,
          tokens: this.estimateTokens(qaContext)
        });
      }
    }

    // 3. Get related concepts from the knowledge graph
    const relatedConcepts = await this.getRelatedConcepts(question, subtopicId);
    if (relatedConcepts.length > 0) {
      const conceptsStr = relatedConcepts.map(c =>
        `- ${c.conceptName}: ${this.truncateText(c.conceptExplanation, 100)}`
      ).join('\n');

      contextParts.push({
        type: 'related_concepts',
        priority: CONTEXT_PRIORITY.RELATED_CONCEPT,
        content: `Related Concepts:\n${conceptsStr}`,
        tokens: this.estimateTokens(conceptsStr)
      });
    }

    // Sort by priority and build final context
    contextParts.sort((a, b) => b.priority - a.priority);

    let finalContext = '';
    let usedTokens = 0;

    for (const part of contextParts) {
      if (usedTokens + part.tokens <= maxTokens) {
        finalContext += `\n---\n${part.content}`;
        usedTokens += part.tokens;
      }
    }

    return {
      context: finalContext.trim(),
      tokenEstimate: usedTokens,
      contextParts: contextParts.map(p => ({ type: p.type, priority: p.priority }))
    };
  }

  /**
   * Build context for generating learning content
   * Uses first-principles approach with progressive complexity
   */
  async buildContentContext(subtopicId, step, options = {}) {
    const contextParts = [];
    const { teachingStyle = 'first_principles', includePrerequisites = true } = options;

    const subtopic = await Subtopic.findByPk(subtopicId, {
      include: [{ model: Topic, as: 'topic' }]
    });

    if (!subtopic) return { context: '', teachingInstructions: '' };

    // 1. Core intuition as foundation
    if (subtopic.topic?.coreIntuition) {
      contextParts.push({
        type: 'foundation',
        content: `Foundational Understanding: ${subtopic.topic.coreIntuition}`
      });
    }

    // 2. Prerequisites if needed
    if (includePrerequisites) {
      const prerequisites = await this.getPrerequisiteKnowledge(subtopic.topic);
      if (prerequisites.length > 0) {
        contextParts.push({
          type: 'prerequisites',
          content: `Prerequisites (student has learned):\n${prerequisites.join('\n')}`
        });
      }
    }

    // 3. Previous steps content (for continuity)
    if (step !== 'introduction') {
      const previousContent = await this.getPreviousStepsSummary(subtopicId, step);
      if (previousContent) {
        contextParts.push({
          type: 'previous_learning',
          content: `Already Covered:\n${previousContent}`
        });
      }
    }

    // 4. User's custom additions (if any)
    const customContent = await this.getUserCustomContent(subtopicId);
    if (customContent) {
      contextParts.push({
        type: 'user_additions',
        content: `User's Additional Notes/Requirements:\n${customContent}`
      });
    }

    // Build teaching instructions based on style and step
    const teachingInstructions = this.buildTeachingInstructions(step, teachingStyle, subtopic);

    return {
      context: contextParts.map(p => p.content).join('\n\n'),
      teachingInstructions,
      stepGuidance: this.getStepGuidance(step, teachingStyle)
    };
  }

  /**
   * Build teaching instructions for adaptive style
   */
  buildTeachingInstructions(step, style, subtopic) {
    const baseInstructions = {
      first_principles: `
TEACHING APPROACH: First Principles
1. Start with the absolute fundamentals - what is this concept at its core?
2. Build up understanding layer by layer
3. Use analogies to connect to concepts the student already knows
4. Don't assume any prior knowledge of this specific topic
5. Make abstract concepts concrete with real examples`,

      practical: `
TEACHING APPROACH: Practical Application
1. Start with a real-world problem this concept solves
2. Show the concept in action first, then explain the theory
3. Include plenty of examples and code/diagrams
4. Focus on "how to use" before "why it works"`,

      academic: `
TEACHING APPROACH: Academic/Rigorous
1. Define terms precisely and formally
2. Present theorems, proofs, or derivations where applicable
3. Connect to broader theoretical frameworks
4. Include edge cases and formal constraints`,

      intuitive: `
TEACHING APPROACH: Intuitive Understanding
1. Use metaphors and visual thinking
2. Focus on building mental models
3. Explain "why" things work the way they do
4. Help student develop intuition for when to apply concepts`
    };

    const stepModifiers = {
      introduction: `
FOR THIS INTRODUCTION:
- Hook the student's interest - why should they care?
- Provide a high-level overview (the "30,000 foot view")
- Set expectations for what they'll learn
- Connect to what they might already know`,

      understanding: `
FOR DEEP UNDERSTANDING:
- Now dive into the details
- Explain mechanisms, processes, or algorithms
- Include diagrams/visualizations (describe in markdown)
- Address common misconceptions
- Build the complete mental model`,

      mastering: `
FOR MASTERY:
- Apply concepts to challenging problems
- Show variations and edge cases
- Connect to other topics in the course
- Include practice problems with solutions
- Prepare for exam-style questions`
    };

    return baseInstructions[style] + '\n' + stepModifiers[step];
  }

  /**
   * Get step-specific guidance
   */
  getStepGuidance(step, style) {
    const complexity = {
      introduction: { depth: 'surface', jargon: 'minimal', examples: 'simple' },
      understanding: { depth: 'moderate', jargon: 'introduce-and-explain', examples: 'varied' },
      mastering: { depth: 'full', jargon: 'use-freely', examples: 'complex-and-edge-cases' }
    };

    return {
      ...complexity[step],
      transitionNote: step === 'introduction'
        ? 'End by hinting at deeper concepts to come'
        : step === 'understanding'
        ? 'Connect back to introduction concepts while preparing for advanced applications'
        : 'Tie everything together and connect to exam preparation'
    };
  }

  /**
   * Get prerequisite knowledge summaries
   */
  async getPrerequisiteKnowledge(topic) {
    const prerequisites = [];

    if (topic.prerequisites && Array.isArray(topic.prerequisites)) {
      for (const prereqName of topic.prerequisites) {
        const prereqTopic = await Topic.findOne({
          where: {
            name: { [Op.iLike]: `%${prereqName}%` },
            sessionId: topic.sessionId
          }
        });

        if (prereqTopic?.coreIntuition) {
          prerequisites.push(`- ${prereqTopic.name}: ${prereqTopic.coreIntuition}`);
        }
      }
    }

    return prerequisites;
  }

  /**
   * Get summary of previous steps
   */
  async getPreviousStepsSummary(subtopicId, currentStep) {
    const stepOrder = ['introduction', 'understanding', 'mastering'];
    const currentIndex = stepOrder.indexOf(currentStep);

    const previousSteps = stepOrder.slice(0, currentIndex);
    const summaries = [];

    for (const step of previousSteps) {
      const content = await LearningContent.findOne({
        where: { subtopicId, step }
      });

      if (content) {
        // Get just the first 200 chars as summary
        summaries.push(`${step}: ${this.truncateText(content.content, 200)}`);
      }
    }

    return summaries.join('\n');
  }

  /**
   * Get user's custom content additions
   */
  async getUserCustomContent(subtopicId) {
    const summary = await StudySummary.findOne({
      where: { subtopicId },
      order: [['updatedAt', 'DESC']]
    });

    if (summary?.userNotes) {
      return summary.userNotes;
    }
    return null;
  }

  /**
   * Find concepts related to a question
   */
  async getRelatedConcepts(question, subtopicId) {
    // Extract keywords from question (simple approach)
    const keywords = question.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

    if (keywords.length === 0) return [];

    // Search for concepts matching keywords
    const concepts = await ConceptMap.findAll({
      where: {
        sessionId: this.sessionId,
        [Op.or]: keywords.map(kw => ({
          conceptName: { [Op.iLike]: `%${kw}%` }
        }))
      },
      limit: 5,
      order: [['importance', 'DESC'], ['learnedAt', 'DESC']]
    });

    return concepts;
  }

  /**
   * Create a summary of the current chat for token optimization
   */
  async summarizeChat(chatHistory) {
    // Group by topics discussed
    const topicMentions = {};
    const keyPoints = [];

    for (const msg of chatHistory) {
      // Simple extraction - in production, use NLP
      if (msg.question && msg.answer) {
        keyPoints.push({
          q: this.truncateText(msg.question, 50),
          a: this.truncateText(msg.answer, 100)
        });
      }
    }

    return {
      summary: `Previous discussion covered ${keyPoints.length} topics.`,
      keyPoints: keyPoints.slice(-5) // Keep last 5
    };
  }

  /**
   * Link concepts across modes (reading, learning, revision)
   */
  async linkConcept(conceptData) {
    const { conceptName, sourceMode, subtopicId, explanation, sourceReference } = conceptData;

    // Check if concept already exists
    let concept = await ConceptMap.findOne({
      where: {
        sessionId: this.sessionId,
        conceptName: { [Op.iLike]: conceptName }
      }
    });

    if (concept) {
      // Update with new source reference
      const sources = concept.sources || [];
      sources.push({ mode: sourceMode, reference: sourceReference, timestamp: new Date() });
      concept.sources = sources;
      await concept.save();
    } else {
      // Create new concept
      concept = await ConceptMap.create({
        sessionId: this.sessionId,
        subtopicId,
        conceptName,
        conceptExplanation: explanation,
        importance: 'medium',
        sources: [{ mode: sourceMode, reference: sourceReference, timestamp: new Date() }]
      });
    }

    return concept;
  }

  /**
   * Utility: Estimate token count (rough approximation)
   */
  estimateTokens(text) {
    if (!text) return 0;
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Utility: Truncate text to approximate token limit
   */
  truncateText(text, maxTokens) {
    if (!text) return '';
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars - 3) + '...';
  }
}

module.exports = ContextManager;
