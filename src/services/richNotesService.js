/**
 * Rich Notes Service
 *
 * Handles rich content in notes including:
 * - Images and diagrams
 * - YouTube videos and external links
 * - User annotations
 * - Content organization
 */

const { StudySummary, Subtopic, Topic } = require('../models');
const { Op } = require('sequelize');

class RichNotesService {
  constructor(sessionId) {
    this.sessionId = sessionId;
  }

  /**
   * Save or update user notes with rich content
   */
  async saveNotes({
    subtopicId,
    topicId,
    userNotes,
    resources = []
  }) {
    // Validate resources
    const validatedResources = resources.map(r => this.validateResource(r)).filter(Boolean);

    // Find or create summary
    let summary = await StudySummary.findOne({
      where: {
        sessionId: this.sessionId,
        ...(subtopicId ? { subtopicId } : {}),
        ...(topicId && !subtopicId ? { topicId } : {})
      }
    });

    if (summary) {
      summary.userNotes = userNotes;
      summary.userResources = validatedResources;
      summary.updatedAt = new Date();
      await summary.save();
    } else {
      summary = await StudySummary.create({
        sessionId: this.sessionId,
        subtopicId,
        topicId,
        userNotes,
        userResources: validatedResources,
        summaryType: 'custom'
      });
    }

    return summary;
  }

  /**
   * Add a resource to existing notes
   */
  async addResource(summaryId, resource) {
    const summary = await StudySummary.findByPk(summaryId);
    if (!summary) return null;

    const validatedResource = this.validateResource(resource);
    if (!validatedResource) return null;

    const resources = summary.userResources || [];
    resources.push({
      ...validatedResource,
      addedAt: new Date()
    });

    summary.userResources = resources;
    await summary.save();

    return summary;
  }

  /**
   * Remove a resource from notes
   */
  async removeResource(summaryId, resourceIndex) {
    const summary = await StudySummary.findByPk(summaryId);
    if (!summary) return null;

    const resources = summary.userResources || [];
    if (resourceIndex >= 0 && resourceIndex < resources.length) {
      resources.splice(resourceIndex, 1);
      summary.userResources = resources;
      await summary.save();
    }

    return summary;
  }

  /**
   * Validate a resource object
   */
  validateResource(resource) {
    const validTypes = ['image', 'video', 'link', 'diagram', 'file'];

    if (!resource.type || !validTypes.includes(resource.type)) {
      return null;
    }

    // Validate URL if present
    if (resource.url) {
      try {
        new URL(resource.url);
      } catch {
        return null;
      }
    }

    return {
      type: resource.type,
      url: resource.url || null,
      title: resource.title || 'Untitled',
      description: resource.description || '',
      localPath: resource.localPath || null, // For uploaded files
      embedCode: resource.embedCode || null, // For YouTube embeds
      position: resource.position || 'inline', // inline, sidebar, bottom
      timestamp: resource.timestamp || null // For video timestamps
    };
  }

  /**
   * Parse YouTube URL and extract embed info
   */
  parseYouTubeUrl(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
      /youtube\.com\/watch\?.*v=([^&\s]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const videoId = match[1];
        return {
          videoId,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        };
      }
    }

    return null;
  }

  /**
   * Create a YouTube video resource
   */
  createYouTubeResource(url, title, timestamp = null) {
    const parsed = this.parseYouTubeUrl(url);
    if (!parsed) return null;

    let embedUrl = parsed.embedUrl;
    if (timestamp) {
      // Convert timestamp (e.g., "1:30" or "90") to seconds
      const seconds = this.parseTimestamp(timestamp);
      embedUrl += `?start=${seconds}`;
    }

    return {
      type: 'video',
      url: url,
      title,
      description: '',
      embedCode: `<iframe width="560" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`,
      thumbnail: parsed.thumbnailUrl,
      timestamp
    };
  }

  /**
   * Parse timestamp string to seconds
   */
  parseTimestamp(timestamp) {
    if (typeof timestamp === 'number') return timestamp;

    const parts = timestamp.split(':').reverse();
    let seconds = 0;
    for (let i = 0; i < parts.length; i++) {
      seconds += parseInt(parts[i]) * Math.pow(60, i);
    }
    return seconds;
  }

  /**
   * Get all notes for a topic with its subtopics
   */
  async getTopicNotes(topicId) {
    const topic = await Topic.findByPk(topicId, {
      include: [{
        model: Subtopic,
        as: 'subtopics',
        include: [{
          model: StudySummary,
          as: 'summary'
        }]
      }]
    });

    if (!topic) return null;

    // Also get topic-level notes
    const topicNotes = await StudySummary.findOne({
      where: {
        sessionId: this.sessionId,
        topicId,
        subtopicId: null
      }
    });

    return {
      topic: {
        id: topic.id,
        name: topic.name,
        notes: topicNotes
      },
      subtopics: topic.subtopics.map(st => ({
        id: st.id,
        name: st.name,
        notes: st.summary?.[0] || null
      }))
    };
  }

  /**
   * Export notes to markdown format
   */
  async exportToMarkdown(subtopicId) {
    const summary = await StudySummary.findOne({
      where: { sessionId: this.sessionId, subtopicId },
      include: [{
        model: Subtopic,
        as: 'subtopic',
        include: [{ model: Topic, as: 'topic' }]
      }]
    });

    if (!summary) return null;

    let markdown = `# ${summary.subtopic?.topic?.name || 'Notes'}\n\n`;
    markdown += `## ${summary.subtopic?.name || 'Subtopic'}\n\n`;

    // AI-generated summary
    if (summary.summaryText) {
      markdown += `### Summary\n\n${summary.summaryText}\n\n`;
    }

    // Key points
    if (summary.keyPoints?.length > 0) {
      markdown += `### Key Points\n\n`;
      for (const point of summary.keyPoints) {
        markdown += `- ${point}\n`;
      }
      markdown += '\n';
    }

    // User notes
    if (summary.userNotes) {
      markdown += `### My Notes\n\n${summary.userNotes}\n\n`;
    }

    // Resources
    if (summary.userResources?.length > 0) {
      markdown += `### Resources\n\n`;
      for (const resource of summary.userResources) {
        if (resource.type === 'link') {
          markdown += `- [${resource.title}](${resource.url})\n`;
        } else if (resource.type === 'video') {
          markdown += `- Video: [${resource.title}](${resource.url})`;
          if (resource.timestamp) {
            markdown += ` (at ${resource.timestamp})`;
          }
          markdown += '\n';
        } else if (resource.type === 'image') {
          markdown += `- ![${resource.title}](${resource.url})\n`;
        }
      }
    }

    return markdown;
  }

  /**
   * Create a diagram placeholder that can be filled later
   */
  async createDiagramPlaceholder({
    subtopicId,
    description,
    diagramType = 'diagram',
    suggestedContent = null
  }) {
    const summary = await StudySummary.findOne({
      where: { sessionId: this.sessionId, subtopicId }
    });

    const placeholder = {
      id: `diagram_${Date.now()}`,
      type: diagramType, // 'flowchart', 'graph', 'diagram', 'mindmap'
      description,
      suggestedContent, // AI-suggested diagram structure
      createdAt: new Date(),
      filled: false
    };

    if (summary) {
      const resources = summary.userResources || [];
      resources.push({
        type: 'diagram',
        title: description,
        ...placeholder
      });
      summary.userResources = resources;
      await summary.save();
    }

    return placeholder;
  }

  /**
   * Fill a diagram placeholder with actual content
   */
  async fillDiagramPlaceholder(summaryId, placeholderId, diagramUrl) {
    const summary = await StudySummary.findByPk(summaryId);
    if (!summary) return null;

    const resources = summary.userResources || [];
    const index = resources.findIndex(r => r.id === placeholderId);

    if (index !== -1) {
      resources[index] = {
        ...resources[index],
        url: diagramUrl,
        filled: true,
        filledAt: new Date()
      };
      summary.userResources = resources;
      await summary.save();
    }

    return summary;
  }

  /**
   * Search across all notes
   */
  async searchNotes(query) {
    const results = await StudySummary.findAll({
      where: {
        sessionId: this.sessionId,
        [Op.or]: [
          { userNotes: { [Op.iLike]: `%${query}%` } },
          { summaryText: { [Op.iLike]: `%${query}%` } }
        ]
      },
      include: [{
        model: Subtopic,
        as: 'subtopic',
        include: [{ model: Topic, as: 'topic' }]
      }]
    });

    return results.map(r => ({
      id: r.id,
      subtopic: r.subtopic?.name,
      topic: r.subtopic?.topic?.name,
      preview: this.extractPreview(r.userNotes || r.summaryText, query)
    }));
  }

  /**
   * Extract a preview around the search match
   */
  extractPreview(text, query, contextLength = 50) {
    if (!text) return '';

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text.substring(0, 100) + '...';

    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + query.length + contextLength);

    let preview = '';
    if (start > 0) preview += '...';
    preview += text.substring(start, end);
    if (end < text.length) preview += '...';

    return preview;
  }
}

module.exports = RichNotesService;
