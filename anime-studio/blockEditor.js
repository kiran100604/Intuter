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

    // Block types configuration
    this.blockTypes = {
      text: { icon: "T", label: "Text", color: "#3b82f6" },
      heading: { icon: "H", label: "Heading", color: "#8b5cf6" },
      ai_content: { icon: "AI", label: "AI Generated", color: "#f97316" },
      image: { icon: "IMG", label: "Image", color: "#10b981" },
      video: { icon: "VID", label: "Video", color: "#ef4444" },
      latex: { icon: "fn", label: "Math/LaTeX", color: "#ec4899" },
      code: { icon: "</>", label: "Code", color: "#06b6d4" },
      callout: { icon: "!", label: "Callout", color: "#f59e0b" },
      divider: { icon: "—", label: "Divider", color: "#71717a" }
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

    // If we have existing content (from AI generation), convert it to blocks
    if (existingContent && Object.keys(existingContent).length > 0) {
      this.blocks = this.convertContentToBlocks(existingContent);
    } else {
      // Try to load saved blocks from backend
      const savedBlocks = await this.loadBlocks();
      if (savedBlocks && savedBlocks.length > 0) {
        this.blocks = savedBlocks;
      } else {
        // Start with an empty text block
        this.blocks = [this.createBlock("text", "")];
      }
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
   * Parse markdown-like content into blocks
   */
  parseContentIntoBlocks(content, isAiGenerated = false) {
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
   * Show AI actions menu - contextual and concise
   */
  showAiMenu(trigger, blockId) {
    document.querySelector(".ai-actions-menu")?.remove();

    const block = this.blocks.find((b) => b.id === blockId);
    if (!block) return;

    const menu = document.createElement("div");
    menu.className = "ai-actions-menu";
    menu.innerHTML = `
      <div class="ai-menu-header">
        <span class="ai-header-icon">AI</span>
        <span>How can I help?</span>
      </div>
      <div class="ai-menu-description">Actions are context-aware and concise</div>
      <button class="ai-menu-item" data-action="explain">
        <div class="ai-menu-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div class="ai-menu-item-content">
          <span class="ai-menu-item-title">Explain this</span>
          <span class="ai-menu-item-desc">Brief clarification (2-4 sentences)</span>
        </div>
      </button>
      <button class="ai-menu-item" data-action="simplify">
        <div class="ai-menu-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-9-9"></path>
            <path d="M12 7v5l3 3"></path>
          </svg>
        </div>
        <div class="ai-menu-item-content">
          <span class="ai-menu-item-title">Simplify</span>
          <span class="ai-menu-item-desc">Same or shorter, easier to understand</span>
        </div>
      </button>
      <button class="ai-menu-item" data-action="expand">
        <div class="ai-menu-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </div>
        <div class="ai-menu-item-content">
          <span class="ai-menu-item-title">Add details</span>
          <span class="ai-menu-item-desc">Incremental depth, not a rewrite</span>
        </div>
      </button>
      <button class="ai-menu-item" data-action="examples">
        <div class="ai-menu-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
          </svg>
        </div>
        <div class="ai-menu-item-content">
          <span class="ai-menu-item-title">Add examples</span>
          <span class="ai-menu-item-desc">1-2 relevant, practical examples</span>
        </div>
      </button>
      <div class="ai-menu-divider"></div>
      <button class="ai-menu-item ai-menu-item-secondary" data-action="regenerate">
        <div class="ai-menu-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
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
        this.addBlock("ai_content", generatedContent, {
          isAiGenerated: true,
          aiActionLabel: actionLabels[action],
          sourceBlockId: blockId
        }, blockIndex + 1);
      } else if (action === "simplify" || action === "regenerate") {
        // Replace current block content
        block.content = generatedContent;
        block.metadata.updatedAt = new Date().toISOString();
        block.metadata.aiActionLabel = actionLabels[action];
        this.render();
      }

      this.triggerAutoSave();
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
