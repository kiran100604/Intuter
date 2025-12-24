/**
 * BlockEditor - A Notion-like block-based content editor
 * Enhanced UX with inline block insertion, clear edit states, and contextual AI
 */

export class BlockEditor {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = null;
    this.blocks = [];
    this.subtopicId = null;
    this.sessionId = localStorage.getItem("sessionId");
    this.onContentChange = options.onContentChange || (() => {});
    this.autoSaveTimeout = null;
    this.editingBlockId = null; // Track which block is in edit mode

    // Block types configuration - includes semantic types for AI-generated content
    this.blockTypes = {
      // Basic block types
      text: { icon: "T", label: "Text", color: "#3b82f6" },
      heading: { icon: "H", label: "Heading", color: "#8b5cf6" },
      ai_content: { icon: "AI", label: "AI Generated", color: "#f97316" },
      image: { icon: "IMG", label: "Image", color: "#10b981" },
      video: { icon: "VID", label: "Video", color: "#ef4444" },
      latex: { icon: "fn", label: "Math/LaTeX", color: "#ec4899" },
      code: { icon: "</>", label: "Code", color: "#06b6d4" },
      callout: { icon: "!", label: "Callout", color: "#f59e0b" },
      divider: { icon: "—", label: "Divider", color: "#71717a" },
      // Semantic block types for structured educational content
      context: { icon: "🌍", label: "Context", color: "#06b6d4" },
      intuition: { icon: "💡", label: "Intuition", color: "#8b5cf6" },
      definition: { icon: "🔑", label: "Definition", color: "#f59e0b" },
      theorem: { icon: "📐", label: "Theorem", color: "#6366f1" },
      example: { icon: "🔬", label: "Example", color: "#10b981" },
      insight: { icon: "✨", label: "Insight", color: "#f97316" },
      warning: { icon: "⚠️", label: "Warning", color: "#ef4444" },
      summary: { icon: "📝", label: "Summary", color: "#3b82f6" },
      concept: { icon: "🧠", label: "Concept", color: "#8b5cf6" },
      formula: { icon: "∑", label: "Formula", color: "#ec4899" }
    };

    // Context-aware actions per semantic block type
    this.semanticActions = {
      context: ['simplify', 'add examples', 'make it relevant to my field'],
      intuition: ['explain more', 'give me an analogy', 'show visual representation'],
      definition: ['explain this', 'add intuition', 'show me an example', 'why is this true?'],
      theorem: ['prove this', 'explain intuitively', 'when does this apply?', 'show counterexample'],
      example: ['explain step by step', 'show a simpler example', 'show a harder example'],
      formula: ['derive this', 'explain each term', 'when to use this?', 'show example'],
      insight: ['explain more', 'give an example', 'why is this useful?'],
      warning: ['explain the mistake', 'show correct approach', 'give example of error'],
      summary: ['expand on a point', 'add more takeaways', 'simplify'],
      concept: ['explain simpler', 'add examples', 'connect to other concepts'],
      // Fallback for non-semantic types
      text: ['explain', 'simplify', 'expand', 'add examples'],
      callout: ['explain', 'simplify', 'add examples'],
      ai_content: ['explain', 'simplify', 'expand', 'add examples']
    };
  }

  /**
   * Initialize the editor with a subtopic
   */
  async init(subtopicId, existingContent = null) {
    this.subtopicId = subtopicId;
    this.container = document.getElementById(this.containerId);

    if (!this.container) {
      console.error("BlockEditor: Container not found:", this.containerId);
      return;
    }

    // ALWAYS try to load saved blocks first (preserves user edits and AI modifications)
    const savedBlocks = await this.loadBlocks();
    if (savedBlocks && savedBlocks.length > 0) {
      this.blocks = savedBlocks;
    } else if (existingContent && Object.keys(existingContent).length > 0) {
      // Only use existing content if no saved blocks (first time viewing)
      this.blocks = this.convertContentToBlocks(existingContent);
      // Save immediately so future loads will use saved blocks
      await this.saveBlocks();
    } else {
      // Start with an empty text block
      this.blocks = [this.createBlock("text", "")];
    }

    this.render();
  }

  /**
   * Convert traditional content format to blocks
   */
  convertContentToBlocks(content) {
    const blocks = [];

    // Add story as intro callout
    if (content.story) {
      blocks.push(this.createBlock("callout", content.story, {
        calloutType: "info",
        title: "Basic Intro",
        isAiGenerated: true
      }));
    }

    // Add theory section - parse it into multiple blocks
    if (content.theory) {
      const theoryBlocks = this.parseContentIntoBlocks(content.theory, true);
      blocks.push(...theoryBlocks);
    }

    // Add summary as tip callout
    if (content.summary) {
      blocks.push(this.createBlock("callout", content.summary, {
        calloutType: "tip",
        title: "Summary",
        isAiGenerated: true
      }));
    }

    return blocks;
  }

  /**
   * Parse semantic blocks from AI-generated content with <!-- BLOCK --> markers
   * Returns null if no semantic blocks found (falls back to markdown parsing)
   */
  parseSemanticBlocks(content, isAiGenerated = false) {
    const blockRegex = /<!-- BLOCK: type="(\w+)" title="([^"]*)" -->([\s\S]*?)<!-- END BLOCK -->/g;
    const blocks = [];
    let match;

    while ((match = blockRegex.exec(content)) !== null) {
      const blockType = match[1];
      const blockTitle = match[2];
      const blockContent = match[3].trim();

      // Skip empty blocks
      if (!blockContent) continue;

      // Create block with semantic type
      blocks.push(this.createBlock(blockType, blockContent, {
        isAiGenerated,
        semanticType: blockType,
        title: blockTitle,
        isSemanticBlock: true
      }));
    }

    // Return null if no semantic blocks found (will fall back to markdown parsing)
    return blocks.length > 0 ? blocks : null;
  }

  /**
   * Parse markdown-like content into blocks
   * First tries semantic block parsing, then falls back to markdown
   */
  parseContentIntoBlocks(content, isAiGenerated = false) {
    // First, try to parse semantic blocks
    const semanticBlocks = this.parseSemanticBlocks(content, isAiGenerated);
    if (semanticBlocks && semanticBlocks.length > 0) {
      return semanticBlocks;
    }

    // Fall back to markdown-based parsing
    const blocks = [];
    const lines = content.split("\n");
    let currentText = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Heading detection
      if (trimmed.startsWith("### ")) {
        if (currentText.length > 0) {
          blocks.push(this.createBlock("text", currentText.join("\n"), { isAiGenerated }));
          currentText = [];
        }
        blocks.push(this.createBlock("heading", trimmed.replace("### ", ""), { level: 3, isAiGenerated }));
        continue;
      }

      if (trimmed.startsWith("## ")) {
        if (currentText.length > 0) {
          blocks.push(this.createBlock("text", currentText.join("\n"), { isAiGenerated }));
          currentText = [];
        }
        blocks.push(this.createBlock("heading", trimmed.replace("## ", ""), { level: 2, isAiGenerated }));
        continue;
      }

      // Code block detection
      if (trimmed.startsWith("```")) {
        if (currentText.length > 0) {
          blocks.push(this.createBlock("text", currentText.join("\n"), { isAiGenerated }));
          currentText = [];
        }

        const lang = trimmed.replace("```", "").trim() || "text";
        let codeContent = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeContent.push(lines[i]);
          i++;
        }
        blocks.push(this.createBlock("code", codeContent.join("\n"), { language: lang, isAiGenerated }));
        continue;
      }

      // LaTeX block detection
      if (trimmed.startsWith("$$")) {
        if (currentText.length > 0) {
          blocks.push(this.createBlock("text", currentText.join("\n"), { isAiGenerated }));
          currentText = [];
        }

        let latexContent = [trimmed.replace("$$", "")];
        if (!trimmed.endsWith("$$") || trimmed === "$$") {
          i++;
          while (i < lines.length && !lines[i].trim().endsWith("$$")) {
            latexContent.push(lines[i]);
            i++;
          }
          if (i < lines.length) {
            latexContent.push(lines[i].replace("$$", ""));
          }
        }
        blocks.push(this.createBlock("latex", latexContent.join("\n").trim(), { isAiGenerated }));
        continue;
      }

      // Callout detection
      const calloutMatch = trimmed.match(/^(?:>?\s*)?([\u{1F300}-\u{1F9FF}]|[^\w\s])\s*\*\*([^:*]+)(?:\*\*)?:\*?\*?/u);
      if (calloutMatch) {
        if (currentText.length > 0) {
          blocks.push(this.createBlock("text", currentText.join("\n"), { isAiGenerated }));
          currentText = [];
        }

        const title = calloutMatch[2].trim();
        let calloutType = "info";
        if (title.toLowerCase().includes("definition")) calloutType = "definition";
        else if (title.toLowerCase().includes("tip") || title.toLowerCase().includes("pro")) calloutType = "tip";
        else if (title.toLowerCase().includes("warning") || title.toLowerCase().includes("pitfall")) calloutType = "warning";
        else if (title.toLowerCase().includes("example")) calloutType = "example";

        // Collect callout content
        let calloutContent = [trimmed.replace(calloutMatch[0], "").trim()];
        i++;
        while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#")) {
          if (lines[i].trim().match(/^(?:>?\s*)?([\u{1F300}-\u{1F9FF}]|[^\w\s])\s*\*\*[^:*]+/u)) {
            i--;
            break;
          }
          calloutContent.push(lines[i].replace(/^>\s*/, ""));
          i++;
        }

        blocks.push(this.createBlock("callout", calloutContent.join("\n").trim(), {
          calloutType,
          title,
          isAiGenerated
        }));
        continue;
      }

      // Divider
      if (trimmed === "---" || trimmed === "***") {
        if (currentText.length > 0) {
          blocks.push(this.createBlock("text", currentText.join("\n"), { isAiGenerated }));
          currentText = [];
        }
        blocks.push(this.createBlock("divider", "", { isAiGenerated }));
        continue;
      }

      // Regular text
      currentText.push(line);
    }

    // Add remaining text
    if (currentText.length > 0) {
      const text = currentText.join("\n").trim();
      if (text) {
        blocks.push(this.createBlock("text", text, { isAiGenerated }));
      }
    }

    return blocks;
  }

  /**
   * Create a new block
   */
  createBlock(type, content = "", metadata = {}) {
    return {
      id: this.generateId(),
      type,
      content,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAiGenerated: false,
        ...metadata
      }
    };
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Render the entire editor
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="block-editor">
        ${this.renderInlineAddBlock(0)}
        <div class="blocks-container" id="blocks-container">
          ${this.blocks.map((block, index) => this.renderBlock(block, index)).join("")}
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.renderMathInBlocks();
  }

  /**
   * Render inline add block divider (appears between blocks on hover)
   */
  renderInlineAddBlock(afterIndex) {
    return `
      <div class="add-block-divider" data-after-index="${afterIndex}">
        <div class="add-block-line"></div>
        <button class="add-block-trigger" title="Add block here">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span class="add-block-label">Add Block</span>
        </button>
        <div class="add-block-line"></div>
      </div>
    `;
  }

  /**
   * Render a single block
   */
  renderBlock(block, index) {
    const typeConfig = this.blockTypes[block.type] || this.blockTypes.text;
    const isAi = block.metadata.isAiGenerated;
    const isEditing = this.editingBlockId === block.id;
    const aiActionLabel = block.metadata.aiActionLabel;

    let contentHtml = "";

    // Check if this is a semantic block type
    const semanticTypes = ['context', 'intuition', 'definition', 'theorem', 'example', 'insight', 'warning', 'summary', 'concept', 'formula'];

    if (semanticTypes.includes(block.type)) {
      contentHtml = this.renderSemanticBlock(block, isEditing);
    } else {
      switch (block.type) {
        case "text":
          contentHtml = this.renderTextBlock(block, isEditing);
          break;
        case "heading":
          contentHtml = this.renderHeadingBlock(block, isEditing);
          break;
        case "ai_content":
          contentHtml = this.renderAiContentBlock(block, isEditing);
          break;
        case "image":
          contentHtml = this.renderImageBlock(block);
          break;
        case "video":
          contentHtml = this.renderVideoBlock(block);
          break;
        case "latex":
          contentHtml = this.renderLatexBlock(block, isEditing);
          break;
        case "code":
          contentHtml = this.renderCodeBlock(block, isEditing);
          break;
        case "callout":
          contentHtml = this.renderCalloutBlock(block, isEditing);
          break;
        case "divider":
          contentHtml = this.renderDividerBlock(block);
          break;
        default:
          contentHtml = this.renderTextBlock(block, isEditing);
      }
    }

    return `
      <div class="block-wrapper ${isEditing ? 'editing' : ''}" data-block-id="${block.id}" data-block-index="${index}">
        <div class="block-handle" draggable="true" title="Drag to reorder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="2"></circle>
            <circle cx="15" cy="6" r="2"></circle>
            <circle cx="9" cy="12" r="2"></circle>
            <circle cx="15" cy="12" r="2"></circle>
            <circle cx="9" cy="18" r="2"></circle>
            <circle cx="15" cy="18" r="2"></circle>
          </svg>
        </div>
        <div class="block ${block.type}-block ${isAi ? "ai-generated" : ""} ${isEditing ? 'is-editing' : ''}" data-type="${block.type}">
          ${aiActionLabel ? `
            <div class="ai-action-label">
              <span class="ai-label-icon">AI</span>
              <span class="ai-label-text">${aiActionLabel}</span>
            </div>
          ` : ''}
          <div class="block-content">
            ${contentHtml}
          </div>
          <div class="block-actions ${isEditing ? 'editing-actions' : ''}">
            ${isEditing ? `
              <button class="block-action-btn done-action" data-action="done" title="Done editing">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Done</span>
              </button>
              <button class="block-action-btn cancel-action" data-action="cancel" title="Cancel editing">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>Cancel</span>
              </button>
            ` : `
              <button class="block-action-btn ai-action" data-action="ai" title="AI Actions">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
                </svg>
              </button>
              <button class="block-action-btn edit-action" data-action="edit" title="Edit block">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="block-action-btn delete-action" data-action="delete" title="Delete block">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            `}
          </div>
        </div>
      </div>
      ${this.renderInlineAddBlock(index + 1)}
    `;
  }

  renderTextBlock(block, isEditing) {
    return `
      <div class="text-content ${isEditing ? 'editable-active' : ''}"
           contenteditable="${isEditing ? 'true' : 'false'}"
           data-placeholder="Type something..."
           data-block-id="${block.id}">${this.formatMarkdown(block.content)}</div>
    `;
  }

  renderHeadingBlock(block, isEditing) {
    const level = block.metadata.level || 2;
    return `
      <h${level} class="heading-content ${isEditing ? 'editable-active' : ''}"
          contenteditable="${isEditing ? 'true' : 'false'}"
          data-placeholder="Heading..."
          data-block-id="${block.id}">${block.content}</h${level}>
    `;
  }

  renderAiContentBlock(block, isEditing) {
    const actionLabel = block.metadata.aiActionLabel || "Generated";
    return `
      <div class="ai-content-wrapper">
        <div class="ai-content-text ${isEditing ? 'editable-active' : ''}"
             contenteditable="${isEditing ? 'true' : 'false'}"
             data-block-id="${block.id}">${this.formatMarkdown(block.content)}</div>
      </div>
    `;
  }

  renderImageBlock(block) {
    if (block.content) {
      return `
        <div class="image-wrapper">
          <img src="${block.content}" alt="${block.metadata.caption || "Image"}" class="block-image" />
          ${block.metadata.caption ? `<div class="image-caption">${block.metadata.caption}</div>` : ""}
          ${block.metadata.aiExplanation ? `
            <div class="ai-explanation">
              <div class="ai-explanation-header">
                <span class="ai-icon">AI</span>
                <span>AI Explanation</span>
              </div>
              <div class="ai-explanation-content">${this.formatMarkdown(block.metadata.aiExplanation)}</div>
            </div>
          ` : `
            <button class="explain-image-btn" data-block-id="${block.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Ask AI to explain this
            </button>
          `}
        </div>
      `;
    } else {
      return `
        <div class="image-upload-zone" data-block-id="${block.id}">
          <div class="upload-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>Click to upload or drag & drop an image</p>
            <span class="upload-hint">PNG, JPG, GIF up to 10MB</span>
          </div>
          <input type="file" accept="image/*" class="image-file-input" hidden />
        </div>
      `;
    }
  }

  renderVideoBlock(block) {
    if (block.content) {
      // Check if it's a YouTube URL
      const youtubeMatch = block.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
      if (youtubeMatch) {
        return `
          <div class="video-wrapper">
            <iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}"
                    frameborder="0" allowfullscreen class="block-video"></iframe>
          </div>
        `;
      }
      return `
        <div class="video-wrapper">
          <video src="${block.content}" controls class="block-video"></video>
        </div>
      `;
    } else {
      return `
        <div class="video-embed-zone" data-block-id="${block.id}">
          <div class="embed-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            <input type="text" placeholder="Paste YouTube URL or video link..." class="video-url-input" />
            <p class="upload-hint">or upload a video file</p>
          </div>
          <input type="file" accept="video/*" class="video-file-input" hidden />
        </div>
      `;
    }
  }

  renderLatexBlock(block, isEditing) {
    return `
      <div class="latex-wrapper">
        <div class="latex-display ${isEditing ? 'hidden' : ''}" data-latex="${this.escapeHtml(block.content)}">$$${block.content}$$</div>
        <div class="latex-edit-zone ${isEditing ? 'active' : ''}">
          <textarea class="latex-editor" data-block-id="${block.id}" placeholder="Enter LaTeX...">${block.content}</textarea>
        </div>
      </div>
    `;
  }

  renderCodeBlock(block, isEditing) {
    const lang = block.metadata.language || "text";
    return `
      <div class="code-wrapper">
        <div class="code-header">
          <span class="code-language">${lang}</span>
          <button class="copy-code-btn" title="Copy code">Copy</button>
        </div>
        <pre class="code-display ${isEditing ? 'hidden' : ''}"><code class="language-${lang}">${this.escapeHtml(block.content)}</code></pre>
        <textarea class="code-editor ${isEditing ? 'active' : ''}" data-block-id="${block.id}">${block.content}</textarea>
      </div>
    `;
  }

  renderCalloutBlock(block, isEditing) {
    const type = block.metadata.calloutType || "info";
    const title = block.metadata.title || "Note";

    return `
      <div class="callout-wrapper callout-${type}">
        <div class="callout-header">
          <span class="callout-icon">${this.getCalloutIcon(type)}</span>
          <span class="callout-title ${isEditing ? 'editable-active' : ''}"
                contenteditable="${isEditing ? 'true' : 'false'}"
                data-block-id="${block.id}"
                data-field="title">${title}</span>
        </div>
        <div class="callout-body ${isEditing ? 'editable-active' : ''}"
             contenteditable="${isEditing ? 'true' : 'false'}"
             data-block-id="${block.id}"
             data-field="content">${this.formatMarkdown(block.content)}</div>
      </div>
    `;
  }

  getCalloutIcon(type) {
    const icons = {
      info: "i",
      tip: "lightbulb",
      warning: "!",
      definition: "key",
      example: "?"
    };
    return icons[type] || "i";
  }

  renderDividerBlock(block) {
    return `<hr class="block-divider" />`;
  }

  /**
   * Render a semantic block (context, intuition, definition, theorem, example, etc.)
   */
  renderSemanticBlock(block, isEditing) {
    const typeConfig = this.blockTypes[block.type] || this.blockTypes.text;
    const title = block.metadata.title || typeConfig.label;
    const icon = typeConfig.icon;
    const color = typeConfig.color;

    // Map semantic types to visual styles
    const styleMap = {
      context: { bgClass: 'semantic-context', borderStyle: 'left' },
      intuition: { bgClass: 'semantic-intuition', borderStyle: 'left' },
      definition: { bgClass: 'semantic-definition', borderStyle: 'accent' },
      theorem: { bgClass: 'semantic-theorem', borderStyle: 'accent' },
      example: { bgClass: 'semantic-example', borderStyle: 'full' },
      insight: { bgClass: 'semantic-insight', borderStyle: 'glow' },
      warning: { bgClass: 'semantic-warning', borderStyle: 'left' },
      summary: { bgClass: 'semantic-summary', borderStyle: 'top' },
      concept: { bgClass: 'semantic-concept', borderStyle: 'left' },
      formula: { bgClass: 'semantic-formula', borderStyle: 'accent' }
    };

    const style = styleMap[block.type] || { bgClass: 'semantic-default', borderStyle: 'left' };

    return `
      <div class="semantic-block ${style.bgClass} border-${style.borderStyle}"
           style="--semantic-color: ${color}">
        <div class="semantic-header">
          <span class="semantic-icon" style="background: ${color}20; color: ${color}">${icon}</span>
          <span class="semantic-title ${isEditing ? 'editable-active' : ''}"
                contenteditable="${isEditing ? 'true' : 'false'}"
                data-block-id="${block.id}"
                data-field="title">${title}</span>
          <span class="semantic-type-badge" style="background: ${color}15; color: ${color}">${typeConfig.label}</span>
        </div>
        <div class="semantic-content ${isEditing ? 'editable-active' : ''}"
             contenteditable="${isEditing ? 'true' : 'false'}"
             data-block-id="${block.id}"
             data-field="content">${this.formatMarkdown(block.content)}</div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.container) return;

    // Add block divider triggers
    this.container.querySelectorAll(".add-block-trigger").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const afterIndex = parseInt(e.target.closest("[data-after-index]")?.dataset.afterIndex ?? this.blocks.length);
        this.showBlockTypeMenu(e.target, afterIndex);
      });
    });

    // Block actions
    this.container.querySelectorAll(".block-action-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const blockWrapper = btn.closest(".block-wrapper");
        const blockId = blockWrapper?.dataset.blockId;

        if (action === "delete") this.deleteBlock(blockId);
        else if (action === "edit") this.enterEditMode(blockId);
        else if (action === "done") this.exitEditMode(blockId, true);
        else if (action === "cancel") this.exitEditMode(blockId, false);
        else if (action === "ai") this.showAiMenu(btn, blockId);
      });
    });

    // Contenteditable changes - only for blocks in edit mode
    this.container.querySelectorAll("[contenteditable='true']").forEach((el) => {
      el.addEventListener("input", (e) => {
        const blockId = el.dataset.blockId;
        const field = el.dataset.field || "content";
        this.updateBlockContent(blockId, field === "content" ? el.innerHTML : el.textContent, field);
      });

      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          const blockWrapper = el.closest(".block-wrapper");
          const blockType = blockWrapper?.querySelector(".block")?.dataset.type;

          // For headings, create new text block
          if (blockType === "heading") {
            e.preventDefault();
            const index = parseInt(blockWrapper.dataset.blockIndex);
            this.exitEditMode(blockWrapper.dataset.blockId, true);
            this.addBlock("text", "", {}, index + 1);
          }
        }

        // Escape to cancel edit
        if (e.key === "Escape") {
          const blockWrapper = el.closest(".block-wrapper");
          if (blockWrapper) {
            this.exitEditMode(blockWrapper.dataset.blockId, false);
          }
        }
      });
    });

    // Textarea changes for code/latex blocks
    this.container.querySelectorAll(".code-editor, .latex-editor").forEach((editor) => {
      editor.addEventListener("input", (e) => {
        const blockId = editor.dataset.blockId;
        const block = this.blocks.find(b => b.id === blockId);
        if (block) {
          block.content = editor.value;
          block.metadata.updatedAt = new Date().toISOString();
        }
      });

      editor.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const blockWrapper = editor.closest(".block-wrapper");
          if (blockWrapper) {
            this.exitEditMode(blockWrapper.dataset.blockId, false);
          }
        }
      });
    });

    // Image upload
    this.container.querySelectorAll(".image-upload-zone").forEach((zone) => {
      const input = zone.querySelector(".image-file-input");

      zone.addEventListener("click", () => input?.click());
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("dragover");
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dragover");
        const file = e.dataTransfer.files[0];
        if (file) this.handleImageUpload(zone.dataset.blockId, file);
      });

      input?.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) this.handleImageUpload(zone.dataset.blockId, file);
      });
    });

    // Video URL input
    this.container.querySelectorAll(".video-url-input").forEach((input) => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const blockId = input.closest(".video-embed-zone")?.dataset.blockId;
          this.updateBlockContent(blockId, input.value);
          this.render();
        }
      });
    });

    // Explain image buttons
    this.container.querySelectorAll(".explain-image-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.explainImage(btn.dataset.blockId));
    });

    // Copy code buttons
    this.container.querySelectorAll(".copy-code-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.closest(".code-wrapper")?.querySelector("code")?.textContent;
        if (code) {
          navigator.clipboard.writeText(code);
          btn.textContent = "Copied!";
          setTimeout(() => btn.textContent = "Copy", 2000);
        }
      });
    });

    // Drag and drop for reordering
    this.setupDragAndDrop();

    // Click outside to save and exit edit mode
    document.addEventListener("click", (e) => {
      if (this.editingBlockId && !e.target.closest(".block-wrapper")) {
        this.exitEditMode(this.editingBlockId, true);
      }
    });
  }

  /**
   * Enter edit mode for a block
   */
  enterEditMode(blockId) {
    // Exit any existing edit mode first
    if (this.editingBlockId && this.editingBlockId !== blockId) {
      this.exitEditMode(this.editingBlockId, true);
    }

    this.editingBlockId = blockId;
    this.render();

    // Focus the editable element
    setTimeout(() => {
      const blockEl = this.container.querySelector(`[data-block-id="${blockId}"]`);
      if (blockEl) {
        const editable = blockEl.querySelector("[contenteditable='true']") ||
                         blockEl.querySelector(".code-editor.active") ||
                         blockEl.querySelector(".latex-editor");
        if (editable) {
          editable.focus();
          // Place cursor at end for contenteditable
          if (editable.contentEditable === 'true') {
            const range = document.createRange();
            range.selectNodeContents(editable);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }
    }, 50);
  }

  /**
   * Exit edit mode for a block
   */
  exitEditMode(blockId, save = true) {
    if (this.editingBlockId !== blockId) return;

    if (save) {
      this.triggerAutoSave();
    }

    this.editingBlockId = null;
    this.render();
  }

  /**
   * Setup drag and drop for block reordering
   */
  setupDragAndDrop() {
    let draggedBlock = null;

    this.container.querySelectorAll(".block-handle").forEach((handle) => {
      handle.addEventListener("dragstart", (e) => {
        draggedBlock = handle.closest(".block-wrapper");
        draggedBlock.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      handle.addEventListener("dragend", () => {
        if (draggedBlock) {
          draggedBlock.classList.remove("dragging");
          draggedBlock = null;
        }
      });
    });

    const blocksContainer = this.container.querySelector(".blocks-container");
    if (blocksContainer) {
      blocksContainer.addEventListener("dragover", (e) => {
        e.preventDefault();
        const afterElement = this.getDragAfterElement(blocksContainer, e.clientY);
        if (draggedBlock) {
          if (afterElement) {
            blocksContainer.insertBefore(draggedBlock, afterElement);
          } else {
            blocksContainer.appendChild(draggedBlock);
          }
        }
      });

      blocksContainer.addEventListener("drop", (e) => {
        e.preventDefault();
        // Update blocks array based on new order
        const newOrder = Array.from(blocksContainer.querySelectorAll(".block-wrapper"))
          .map((el) => el.dataset.blockId);

        this.blocks = newOrder.map((id) => this.blocks.find((b) => b.id === id)).filter(Boolean);
        this.triggerAutoSave();
      });
    }
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll(".block-wrapper:not(.dragging)")];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  /**
   * Show block type selection menu
   */
  showBlockTypeMenu(trigger, afterIndex) {
    // Remove existing menu
    document.querySelector(".block-type-menu")?.remove();

    const menu = document.createElement("div");
    menu.className = "block-type-menu";
    menu.innerHTML = `
      <div class="block-type-menu-header">Add Block</div>
      <div class="block-type-options">
        ${Object.entries(this.blockTypes).map(([type, config]) => `
          <button class="block-type-option" data-type="${type}">
            <span class="block-type-icon" style="background: ${config.color}20; color: ${config.color}">${config.icon}</span>
            <span class="block-type-label">${config.label}</span>
          </button>
        `).join("")}
      </div>
      <div class="block-type-menu-footer">
        <button class="ai-generate-btn">
          <span class="ai-icon">AI</span>
          Generate with AI
        </button>
      </div>
    `;

    // Position menu
    const rect = trigger.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${Math.max(rect.left - 80, 16)}px`;
    document.body.appendChild(menu);

    // Event listeners
    menu.querySelectorAll(".block-type-option").forEach((option) => {
      option.addEventListener("click", () => {
        const newBlock = this.addBlock(option.dataset.type, "", {}, afterIndex);
        menu.remove();
        // Immediately enter edit mode for the new block
        setTimeout(() => this.enterEditMode(newBlock.id), 100);
      });
    });

    menu.querySelector(".ai-generate-btn")?.addEventListener("click", () => {
      this.showAiGenerateDialog(afterIndex);
      menu.remove();
    });

    // Close on outside click
    setTimeout(() => {
      document.addEventListener("click", function closeMenu(e) {
        if (!menu.contains(e.target) && e.target !== trigger) {
          menu.remove();
          document.removeEventListener("click", closeMenu);
        }
      });
    }, 0);
  }

  /**
   * Get action icon SVG by action name
   */
  getActionIcon(action) {
    const icons = {
      'explain': '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      'explain this': '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      'explain more': '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      'simplify': '<path d="M21 12a9 9 0 1 1-9-9"></path><path d="M12 7v5l3 3"></path>',
      'explain simpler': '<path d="M21 12a9 9 0 1 1-9-9"></path><path d="M12 7v5l3 3"></path>',
      'expand': '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>',
      'add examples': '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect>',
      'examples': '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect>',
      'give an example': '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect>',
      'show example': '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect>',
      'show me an example': '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect>',
      'add intuition': '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>',
      'give me an analogy': '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83"></path><circle cx="12" cy="12" r="4"></circle>',
      'prove this': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line>',
      'explain intuitively': '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83"></path><circle cx="12" cy="12" r="4"></circle>',
      'when does this apply?': '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
      'when to use this?': '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
      'why is this true?': '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      'why is this useful?': '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      'explain step by step': '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>',
      'show a simpler example': '<path d="M21 12a9 9 0 1 1-9-9"></path><rect x="8" y="8" width="8" height="8"></rect>',
      'show a harder example': '<polyline points="15 3 21 3 21 9"></polyline><rect x="3" y="11" width="10" height="10"></rect>',
      'derive this': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><line x1="9" y1="11" x2="15" y2="11"></line><line x1="9" y1="15" x2="15" y2="15"></line>',
      'explain each term': '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line>',
      'explain the mistake': '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
      'show correct approach': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
      'give example of error': '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line>',
      'show counterexample': '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line>',
      'expand on a point': '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line>',
      'add more takeaways': '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
      'connect to other concepts': '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>',
      'make it relevant to my field': '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"></path>',
      'show visual representation': '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>',
      'regenerate': '<path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>'
    };
    return icons[action.toLowerCase()] || icons['explain'];
  }

  /**
   * Get action description by action name
   */
  getActionDescription(action) {
    const descriptions = {
      'explain': 'Brief clarification (2-4 sentences)',
      'explain this': 'Brief clarification (2-4 sentences)',
      'explain more': 'More depth on this topic',
      'simplify': 'Same or shorter, easier to understand',
      'explain simpler': 'Same or shorter, easier to understand',
      'expand': 'Incremental depth, not a rewrite',
      'add examples': '1-2 relevant, practical examples',
      'examples': '1-2 relevant, practical examples',
      'give an example': 'A concrete example',
      'show example': 'A worked example',
      'show me an example': 'A practical example',
      'add intuition': 'Build mental models',
      'give me an analogy': 'Relatable comparison',
      'prove this': 'Formal proof or justification',
      'explain intuitively': 'Plain language explanation',
      'when does this apply?': 'Conditions and use cases',
      'when to use this?': 'Practical applications',
      'why is this true?': 'Underlying reasoning',
      'why is this useful?': 'Practical value',
      'explain step by step': 'Detailed walkthrough',
      'show a simpler example': 'Easier version',
      'show a harder example': 'More challenging version',
      'derive this': 'Show the derivation',
      'explain each term': 'Break down components',
      'explain the mistake': 'What went wrong',
      'show correct approach': 'The right way',
      'give example of error': 'Common mistake example',
      'show counterexample': 'When this fails',
      'expand on a point': 'More detail on specific aspect',
      'add more takeaways': 'Additional key points',
      'connect to other concepts': 'Related topics',
      'make it relevant to my field': 'Domain-specific context',
      'show visual representation': 'Diagram or visualization',
      'regenerate': 'Rewrite for clarity'
    };
    return descriptions[action.toLowerCase()] || 'AI assistance';
  }

  /**
   * Show AI actions menu - contextual and concise based on block type
   */
  showAiMenu(trigger, blockId) {
    document.querySelector(".ai-actions-menu")?.remove();

    const block = this.blocks.find((b) => b.id === blockId);
    if (!block) return;

    // Get context-aware actions based on block type
    const blockType = block.type;
    const actions = this.semanticActions[blockType] || this.semanticActions.text;
    const typeConfig = this.blockTypes[blockType] || this.blockTypes.text;

    const menu = document.createElement("div");
    menu.className = "ai-actions-menu";

    // Build action buttons HTML
    const actionButtonsHtml = actions.map(action => `
      <button class="ai-menu-item" data-action="${action}">
        <div class="ai-menu-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${this.getActionIcon(action)}
          </svg>
        </div>
        <div class="ai-menu-item-content">
          <span class="ai-menu-item-title">${action.charAt(0).toUpperCase() + action.slice(1)}</span>
          <span class="ai-menu-item-desc">${this.getActionDescription(action)}</span>
        </div>
      </button>
    `).join('');

    menu.innerHTML = `
      <div class="ai-menu-header">
        <span class="ai-header-icon" style="background: ${typeConfig.color}20; color: ${typeConfig.color}">${typeConfig.icon}</span>
        <span>Actions for ${typeConfig.label}</span>
      </div>
      <div class="ai-menu-description">Context-aware actions for this ${blockType} block</div>
      ${actionButtonsHtml}
      <div class="ai-menu-divider"></div>
      <button class="ai-menu-item ai-menu-item-secondary" data-action="regenerate">
        <div class="ai-menu-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${this.getActionIcon('regenerate')}
          </svg>
        </div>
        <div class="ai-menu-item-content">
          <span class="ai-menu-item-title">Regenerate</span>
          <span class="ai-menu-item-desc">Rewrite for clarity</span>
        </div>
      </button>
    `;

    const rect = trigger.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    document.body.appendChild(menu);

    menu.querySelectorAll(".ai-menu-item").forEach((item) => {
      item.addEventListener("click", async () => {
        const action = item.dataset.action;
        menu.remove();
        await this.handleAiAction(blockId, action);
      });
    });

    setTimeout(() => {
      document.addEventListener("click", function closeMenu(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener("click", closeMenu);
        }
      });
    }, 0);
  }

  /**
   * Handle AI actions on a block - contextual and concise
   */
  async handleAiAction(blockId, action) {
    const block = this.blocks.find((b) => b.id === blockId);
    if (!block) return;

    const blockElement = this.container.querySelector(`[data-block-id="${blockId}"]`)?.closest(".block-wrapper");
    if (blockElement) {
      blockElement.classList.add("processing");
    }

    try {
      const token = localStorage.getItem("token");

      // Get surrounding context for better AI responses
      const blockIndex = this.blocks.findIndex((b) => b.id === blockId);
      const contextBlocks = this.blocks.slice(Math.max(0, blockIndex - 2), blockIndex + 1);
      const context = contextBlocks.map(b => b.content).join("\n\n");

      const response = await fetch("http://localhost:5000/api/content-requests/ai-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          content: block.content,
          blockType: block.type,
          subtopicId: this.subtopicId,
          sessionId: this.sessionId,
          context: context
        })
      });

      if (!response.ok) throw new Error("AI action failed");

      const result = await response.json();
      const generatedContent = result.data.content;

      // Action labels for display
      const actionLabels = {
        explain: "Explanation",
        simplify: "Simplified",
        expand: "Details",
        examples: "Examples",
        regenerate: "Regenerated"
      };

      // Handle the response based on action
      if (action === "explain" || action === "expand" || action === "examples") {
        // Add new AI block after current block with label
        const blockIndex = this.blocks.findIndex((b) => b.id === blockId);
        const newBlock = this.createBlock("ai_content", generatedContent, {
          isAiGenerated: true,
          aiActionLabel: actionLabels[action],
          sourceBlockId: blockId
        });
        this.blocks.splice(blockIndex + 1, 0, newBlock);
        this.render();
      } else if (action === "simplify" || action === "regenerate") {
        // Replace current block content
        block.content = generatedContent;
        block.metadata.updatedAt = new Date().toISOString();
        block.metadata.aiActionLabel = actionLabels[action];
        this.render();
      }

      // Save immediately for AI-generated content (no debounce)
      await this.saveBlocks();
    } catch (error) {
      console.error("AI action error:", error);
      this.showNotification("AI action failed. Please try again.", "error");
    } finally {
      if (blockElement) {
        blockElement.classList.remove("processing");
      }
    }
  }

  /**
   * Show AI generate dialog
   */
  showAiGenerateDialog(afterIndex) {
    const dialog = document.createElement("div");
    dialog.className = "ai-generate-dialog modal";
    dialog.innerHTML = `
      <div class="modal-content">
        <span class="close-button">&times;</span>
        <h3>Generate Content with AI</h3>
        <p>Describe what you want the AI to generate:</p>
        <textarea class="ai-prompt-input" placeholder="e.g., Explain the quadratic formula with examples..."></textarea>
        <div class="ai-style-options">
          <label>Teaching Style:</label>
          <select class="ai-style-select">
            <option value="first_principles">First Principles</option>
            <option value="example_driven">Example Driven</option>
            <option value="step_by_step">Step by Step</option>
            <option value="visual">Visual/Spatial</option>
            <option value="analogy_based">Analogy Based</option>
          </select>
        </div>
        <div class="dialog-actions">
          <button class="btn-secondary cancel-btn">Cancel</button>
          <button class="btn-primary generate-btn">Generate</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector(".close-button").addEventListener("click", () => dialog.remove());
    dialog.querySelector(".cancel-btn").addEventListener("click", () => dialog.remove());
    dialog.querySelector(".generate-btn").addEventListener("click", async () => {
      const prompt = dialog.querySelector(".ai-prompt-input").value;
      const style = dialog.querySelector(".ai-style-select").value;

      if (!prompt.trim()) {
        this.showNotification("Please enter a prompt", "error");
        return;
      }

      dialog.querySelector(".generate-btn").disabled = true;
      dialog.querySelector(".generate-btn").textContent = "Generating...";

      try {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:5000/api/content-requests/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            prompt,
            style,
            subtopicId: this.subtopicId,
            sessionId: this.sessionId
          })
        });

        if (!response.ok) throw new Error("Generation failed");

        const result = await response.json();
        this.addBlock("ai_content", result.data.content, {
          isAiGenerated: true,
          aiActionLabel: "Generated"
        }, afterIndex);
        dialog.remove();
      } catch (error) {
        console.error("AI generation error:", error);
        this.showNotification("Generation failed. Please try again.", "error");
        dialog.querySelector(".generate-btn").disabled = false;
        dialog.querySelector(".generate-btn").textContent = "Generate";
      }
    });

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  /**
   * Handle image upload
   */
  async handleImageUpload(blockId, file) {
    if (!file.type.startsWith("image/")) {
      this.showNotification("Please upload an image file", "error");
      return;
    }

    // Convert to base64 for now (in production, upload to server)
    const reader = new FileReader();
    reader.onload = (e) => {
      this.updateBlockContent(blockId, e.target.result);
      this.render();
    };
    reader.readAsDataURL(file);
  }

  /**
   * Explain image with AI
   */
  async explainImage(blockId) {
    const block = this.blocks.find((b) => b.id === blockId);
    if (!block || !block.content) return;

    const blockElement = this.container.querySelector(`[data-block-id="${blockId}"]`)?.closest(".block-wrapper");
    if (blockElement) blockElement.classList.add("processing");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/content-requests/explain-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          imageData: block.content,
          subtopicId: this.subtopicId,
          sessionId: this.sessionId
        })
      });

      if (!response.ok) throw new Error("Image explanation failed");

      const result = await response.json();
      block.metadata.aiExplanation = result.data.explanation;
      block.metadata.updatedAt = new Date().toISOString();
      this.render();
    } catch (error) {
      console.error("Image explanation error:", error);
      this.showNotification("Failed to explain image. Please try again.", "error");
    } finally {
      if (blockElement) blockElement.classList.remove("processing");
    }
  }

  /**
   * Add a new block
   */
  addBlock(type, content = "", metadata = {}, afterIndex = null) {
    const newBlock = this.createBlock(type, content, metadata);

    if (afterIndex !== null && afterIndex <= this.blocks.length) {
      this.blocks.splice(afterIndex, 0, newBlock);
    } else {
      this.blocks.push(newBlock);
    }

    this.render();
    this.triggerAutoSave();

    return newBlock;
  }

  /**
   * Update block content
   */
  updateBlockContent(blockId, content, field = "content") {
    const block = this.blocks.find((b) => b.id === blockId);
    if (!block) return;

    if (field === "content") {
      block.content = content;
    } else if (field === "title" && block.metadata) {
      block.metadata.title = content;
    }

    block.metadata.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
  }

  /**
   * Delete a block
   */
  deleteBlock(blockId) {
    const index = this.blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return;

    // Don't delete if it's the only block
    if (this.blocks.length === 1) {
      this.blocks[0].content = "";
      this.render();
      return;
    }

    this.blocks.splice(index, 1);
    this.render();
    this.triggerAutoSave();
  }

  /**
   * Trigger auto-save with debounce
   */
  triggerAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    this.autoSaveTimeout = setTimeout(() => this.saveBlocks(), 2000);
  }

  /**
   * Save blocks to backend
   */
  async saveBlocks() {
    if (!this.subtopicId) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/notes/${this.subtopicId}/blocks`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          blocks: this.blocks,
          sessionId: this.sessionId
        })
      });

      if (!response.ok) throw new Error("Save failed");

      this.showNotification("Saved", "success");
      this.onContentChange(this.blocks);
    } catch (error) {
      console.error("Save error:", error);
      this.showNotification("Failed to save", "error");
    }
  }

  /**
   * Load blocks from backend
   */
  async loadBlocks() {
    if (!this.subtopicId) return null;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/notes/${this.subtopicId}/blocks`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) return null;

      const result = await response.json();
      return result.data?.blocks || null;
    } catch (error) {
      console.error("Load error:", error);
      return null;
    }
  }

  /**
   * Render math expressions in blocks
   */
  renderMathInBlocks() {
    if (typeof renderMathInElement === "function") {
      const container = this.container.querySelector(".blocks-container");
      if (container) {
        renderMathInElement(container, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\[", right: "\\]", display: true },
            { left: "\\(", right: "\\)", display: false }
          ]
        });
      }
    }
  }

  /**
   * Format markdown to HTML
   */
  formatMarkdown(text) {
    if (!text) return "";

    let html = text;

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    // Line breaks
    html = html.replace(/\n/g, "<br>");

    return html;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Show notification
   */
  showNotification(message, type = "info") {
    const existing = document.querySelector(".block-editor-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.className = `block-editor-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 3000);
  }

  /**
   * Get blocks as content (for compatibility)
   */
  getContent() {
    return {
      blocks: this.blocks,
      // Also provide traditional format for backwards compatibility
      story: this.blocks.filter((b) => b.metadata.calloutType === "info")[0]?.content || "",
      theory: this.blocks
        .filter((b) => b.type === "text" || b.type === "heading" || b.type === "ai_content")
        .map((b) => b.content)
        .join("\n\n"),
      summary: this.blocks.filter((b) => b.metadata.calloutType === "tip")[0]?.content || ""
    };
  }
}

// Export for global access
window.BlockEditor = BlockEditor;
