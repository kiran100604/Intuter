/**
 * Knowledge Graph Service
 *
 * Manages the unified knowledge graph that connects concepts
 * across all modes (reading, learning, revision).
 *
 * This service enables:
 * - Cross-mode concept linking
 * - Related concept discovery
 * - Learning path recommendations
 * - Spaced repetition scheduling
 */

const { ConceptMap, Topic, Subtopic, LearningContent, StudySummary } = require('../models');
const { Op } = require('sequelize');

class KnowledgeGraph {
  constructor(sessionId) {
    this.sessionId = sessionId;
  }

  /**
   * Add or update a concept in the knowledge graph
   */
  async addConcept({
    conceptName,
    explanation,
    subtopicId,
    sourceMode,
    sourceReference,
    importance = 'medium',
    tags = [],
    relatedConcepts = []
  }) {
    // Check if concept already exists
    let concept = await ConceptMap.findOne({
      where: {
        sessionId: this.sessionId,
        conceptName: { [Op.iLike]: conceptName }
      }
    });

    if (concept) {
      // Update existing concept with new source
      const sources = concept.sources || [];
      sources.push({
        mode: sourceMode,
        reference: sourceReference,
        timestamp: new Date()
      });

      // Merge tags
      const existingTags = concept.tags || [];
      const mergedTags = [...new Set([...existingTags, ...tags])];

      // Merge related concepts
      const existingRelated = concept.relatedConcepts || [];
      const mergedRelated = [...new Set([...existingRelated, ...relatedConcepts])];

      concept.sources = sources;
      concept.tags = mergedTags;
      concept.relatedConcepts = mergedRelated;
      if (explanation && explanation.length > (concept.conceptExplanation?.length || 0)) {
        concept.conceptExplanation = explanation;
      }
      await concept.save();
    } else {
      // Create new concept
      concept = await ConceptMap.create({
        sessionId: this.sessionId,
        subtopicId,
        conceptName,
        conceptExplanation: explanation,
        importance,
        sources: [{
          mode: sourceMode,
          reference: sourceReference,
          timestamp: new Date()
        }],
        tags,
        relatedConcepts,
        learnedAt: new Date()
      });
    }

    // Auto-link related concepts bidirectionally
    await this.linkRelatedConcepts(conceptName, relatedConcepts);

    return concept;
  }

  /**
   * Link concepts bidirectionally in the graph
   */
  async linkRelatedConcepts(conceptName, relatedConceptNames) {
    for (const relatedName of relatedConceptNames) {
      const relatedConcept = await ConceptMap.findOne({
        where: {
          sessionId: this.sessionId,
          conceptName: { [Op.iLike]: relatedName }
        }
      });

      if (relatedConcept) {
        const existingRelated = relatedConcept.relatedConcepts || [];
        if (!existingRelated.some(c => c.toLowerCase() === conceptName.toLowerCase())) {
          existingRelated.push(conceptName);
          relatedConcept.relatedConcepts = existingRelated;
          await relatedConcept.save();
        }
      }
    }
  }

  /**
   * Find concepts related to a query (for answering questions)
   */
  async findRelatedConcepts(query, limit = 5) {
    // Extract keywords from query
    const keywords = query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

    if (keywords.length === 0) return [];

    // Search by keyword match
    const concepts = await ConceptMap.findAll({
      where: {
        sessionId: this.sessionId,
        [Op.or]: [
          ...keywords.map(kw => ({
            conceptName: { [Op.iLike]: `%${kw}%` }
          })),
          ...keywords.map(kw => ({
            conceptExplanation: { [Op.iLike]: `%${kw}%` }
          })),
          ...keywords.map(kw => ({
            tags: { [Op.contains]: [kw] }
          }))
        ]
      },
      order: [
        ['importance', 'DESC'],
        ['reviewCount', 'DESC'],
        ['learnedAt', 'DESC']
      ],
      limit
    });

    return concepts;
  }

  /**
   * Get the concept graph for a topic (for visualization)
   */
  async getTopicGraph(topicId) {
    const subtopics = await Subtopic.findAll({
      where: { topicId },
      include: [{
        model: ConceptMap,
        as: 'concepts'
      }]
    });

    const nodes = [];
    const edges = [];
    const conceptMap = new Map();

    // Build nodes
    for (const subtopic of subtopics) {
      for (const concept of (subtopic.concepts || [])) {
        if (!conceptMap.has(concept.conceptName.toLowerCase())) {
          conceptMap.set(concept.conceptName.toLowerCase(), concept.id);
          nodes.push({
            id: concept.id,
            name: concept.conceptName,
            importance: concept.importance,
            mastered: concept.mastered,
            subtopic: subtopic.name
          });
        }
      }
    }

    // Build edges from relatedConcepts
    for (const subtopic of subtopics) {
      for (const concept of (subtopic.concepts || [])) {
        const sourceId = conceptMap.get(concept.conceptName.toLowerCase());
        for (const related of (concept.relatedConcepts || [])) {
          const targetId = conceptMap.get(related.toLowerCase());
          if (targetId && sourceId !== targetId) {
            edges.push({
              source: sourceId,
              target: targetId
            });
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Get concepts due for review (spaced repetition)
   */
  async getConceptsForReview(limit = 10) {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Priority: high importance, not mastered, not reviewed recently
    const concepts = await ConceptMap.findAll({
      where: {
        sessionId: this.sessionId,
        mastered: false,
        [Op.or]: [
          { lastReviewed: null },
          {
            lastReviewed: { [Op.lt]: oneDayAgo },
            importance: 'high'
          },
          {
            lastReviewed: { [Op.lt]: oneWeekAgo },
            importance: { [Op.in]: ['high', 'medium'] }
          }
        ]
      },
      order: [
        ['importance', 'DESC'],
        ['lastReviewed', 'ASC NULLS FIRST'],
        ['reviewCount', 'ASC']
      ],
      limit
    });

    return concepts;
  }

  /**
   * Mark concept as reviewed
   */
  async markReviewed(conceptId, understood = true) {
    const concept = await ConceptMap.findByPk(conceptId);
    if (!concept) return null;

    concept.lastReviewed = new Date();
    concept.reviewCount += 1;

    // Mark as mastered after successful reviews
    if (understood && concept.reviewCount >= 3 && concept.importance !== 'high') {
      concept.mastered = true;
    }

    await concept.save();
    return concept;
  }

  /**
   * Link a concept extracted from reading mode to learning content
   */
  async linkReadingToLearning(readingExtract, subtopicId) {
    const { conceptName, pageReference, extractedText } = readingExtract;

    // Find or create the concept
    const concept = await this.addConcept({
      conceptName,
      explanation: extractedText,
      subtopicId,
      sourceMode: 'reading',
      sourceReference: pageReference
    });

    // Check if there's learning content that mentions this concept
    const learningContent = await LearningContent.findAll({
      where: {
        subtopicId,
        content: { [Op.iLike]: `%${conceptName}%` }
      }
    });

    if (learningContent.length > 0) {
      // Update concept with learning mode reference
      const sources = concept.sources || [];
      sources.push({
        mode: 'learning',
        reference: `Found in ${learningContent.length} learning content sections`,
        timestamp: new Date()
      });
      concept.sources = sources;
      await concept.save();
    }

    return concept;
  }

  /**
   * Get learning path based on concept dependencies
   */
  async getLearningPath(targetConceptName) {
    const visited = new Set();
    const path = [];

    const traverse = async (conceptName) => {
      if (visited.has(conceptName.toLowerCase())) return;
      visited.add(conceptName.toLowerCase());

      const concept = await ConceptMap.findOne({
        where: {
          sessionId: this.sessionId,
          conceptName: { [Op.iLike]: conceptName }
        },
        include: [{
          model: Subtopic,
          as: 'subtopic',
          include: [{ model: Topic, as: 'topic' }]
        }]
      });

      if (!concept) return;

      // First traverse prerequisites (related concepts with lower order)
      for (const related of (concept.relatedConcepts || [])) {
        await traverse(related);
      }

      path.push({
        concept: concept.conceptName,
        subtopic: concept.subtopic?.name,
        topic: concept.subtopic?.topic?.name,
        mastered: concept.mastered
      });
    };

    await traverse(targetConceptName);
    return path;
  }

  /**
   * Get session-wide concept statistics
   */
  async getConceptStats() {
    const allConcepts = await ConceptMap.findAll({
      where: { sessionId: this.sessionId }
    });

    const stats = {
      total: allConcepts.length,
      mastered: allConcepts.filter(c => c.mastered).length,
      highImportance: allConcepts.filter(c => c.importance === 'high').length,
      needsReview: allConcepts.filter(c => !c.mastered && c.importance === 'high').length,
      bySource: {
        learning: 0,
        reading: 0,
        revision: 0
      }
    };

    // Count by source mode
    for (const concept of allConcepts) {
      for (const source of (concept.sources || [])) {
        if (stats.bySource[source.mode] !== undefined) {
          stats.bySource[source.mode]++;
        }
      }
    }

    return stats;
  }

  /**
   * Suggest related concepts when solving a problem
   */
  async suggestForProblem(problemDescription) {
    // Extract potential concept names from problem
    const concepts = await this.findRelatedConcepts(problemDescription, 10);

    // Group by subtopic for better organization
    const bySubtopic = {};
    for (const concept of concepts) {
      const subtopic = await Subtopic.findByPk(concept.subtopicId);
      const key = subtopic?.name || 'General';
      if (!bySubtopic[key]) {
        bySubtopic[key] = [];
      }
      bySubtopic[key].push({
        name: concept.conceptName,
        explanation: concept.conceptExplanation,
        importance: concept.importance
      });
    }

    return {
      concepts,
      organized: bySubtopic,
      suggestion: concepts.length > 0
        ? `Consider these concepts: ${concepts.slice(0, 3).map(c => c.conceptName).join(', ')}`
        : 'No directly related concepts found. Try breaking down the problem.'
    };
  }
}

module.exports = KnowledgeGraph;
