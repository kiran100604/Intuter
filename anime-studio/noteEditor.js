/**
 * Rich Note Editor Component
 * Block-based editor for creating and editing notes with various content types
 */

export class NoteEditor {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.sessionId = localStorage.getItem("sessionId");
    this.currentNoteId = null;
    this.currentSubtopicId = null;
    this.blocks = [];
    this.injectStyles();
  }

  /**
   * Initialize for a subtopic
   */
  async init(subtopicId) {
    this.currentSubtopicId = subtopicId;
    await this.loadNotes();
  }

  /**
   * Load notes for current subtopic
   */
  async loadNotes() {
    if (!this.container) return;

    try {
      const token = localStorage.getItem("token");
      const url = this.currentSubtopicId
        ? `http://localhost:5000/api/notes/subtopic/${this.currentSubtopicId}`
        : `http://localhost:5000/api/notes/session/${this.sessionId}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        this.renderNotesList(data.data.notes);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  }

  /**
   * Render the list of notes
   */
  renderNotesList(notes) {
    this.container.innerHTML = `
      <div class="notes-panel">
        <div class="notes-header">
          <h4>Your Notes</h4>
          <button class="btn-icon" onclick="window.noteEditor.createNewNote()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        <div class="notes-list">
          ${notes.length === 0 ? `
            <div class="notes-empty">
              <p>No notes yet</p>
              <button class="btn-secondary" onclick="window.noteEditor.createNewNote()">Create your first note</button>
            </div>
          ` : notes.map(note => this.renderNoteCard(note)).join("")}
        </div>
      </div>
    `;
  }

  /**
   * Render a single note card
   */
  renderNoteCard(note) {
    const blockCount = note.blocks?.length || 0;
    const preview = note.blocks?.[0]?.content?.substring(0, 100) || "Empty note";

    return `
      <div class="note-card ${note.isStarred ? 'starred' : ''}" data-note-id="${note.id}" onclick="window.noteEditor.openNote(${note.id})">
        <div class="note-card-header">
          <span class="note-title">${note.title || "Untitled"}</span>
          <button class="star-btn" onclick="event.stopPropagation(); window.noteEditor.toggleStar(${note.id})">
            ${note.isStarred ? "★" : "☆"}
          </button>
        </div>
        <div class="note-preview">${preview}${preview.length >= 100 ? "..." : ""}</div>
        <div class="note-meta">
          <span>${blockCount} blocks</span>
          <span>${new Date(note.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    `;
  }

  /**
   * Create a new note
   */
  async createNewNote() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          subtopicId: this.currentSubtopicId,
          title: "New Note",
          blocks: [{ type: "text", content: "" }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.openNote(data.data.note.id);
      }
    } catch (error) {
      console.error("Error creating note:", error);
    }
  }

  /**
   * Open a note for editing
   */
  async openNote(noteId) {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/notes/${noteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        this.currentNoteId = noteId;
        this.blocks = data.data.note.blocks || [];
        this.renderEditor(data.data.note);
      }
    } catch (error) {
      console.error("Error opening note:", error);
    }
  }

  /**
   * Render the note editor
   */
  renderEditor(note) {
    this.container.innerHTML = `
      <div class="note-editor">
        <div class="editor-header">
          <button class="btn-back" onclick="window.noteEditor.loadNotes()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back
          </button>
          <input type="text" class="note-title-input" value="${note.title || ''}"
                 onchange="window.noteEditor.updateTitle(this.value)" placeholder="Note title...">
          <button class="btn-delete" onclick="window.noteEditor.deleteNote()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>

        <div class="editor-toolbar">
          <button class="toolbar-btn" onclick="window.noteEditor.addBlock('text')" title="Add Text">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 7V4h16v3"></path>
              <line x1="12" y1="4" x2="12" y2="20"></line>
              <path d="M8 20h8"></path>
            </svg>
          </button>
          <button class="toolbar-btn" onclick="window.noteEditor.addBlock('latex')" title="Add Formula">
            <span style="font-style: italic;">∑</span>
          </button>
          <button class="toolbar-btn" onclick="window.noteEditor.addBlock('image')" title="Add Image">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>
          <button class="toolbar-btn" onclick="window.noteEditor.addBlock('video')" title="Add Video">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </button>
          <button class="toolbar-btn" onclick="window.noteEditor.addBlock('code')" title="Add Code">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </button>
          <button class="toolbar-btn" onclick="window.noteEditor.addBlock('link')" title="Add Link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>
        </div>

        <div class="blocks-container" id="blocks-container">
          ${this.blocks.map((block, index) => this.renderBlock(block, index)).join("")}
        </div>
      </div>
    `;

    // Re-render LaTeX
    this.renderLatexBlocks();
  }

  /**
   * Render a single block
   */
  renderBlock(block, index) {
    const blockHtml = {
      text: () => `
        <div class="note-block text-block" data-block-id="${block.id}" data-index="${index}">
          <div class="block-handle" draggable="true">⋮⋮</div>
          <div class="block-content" contenteditable="true"
               onblur="window.noteEditor.updateBlockContent('${block.id}', this.innerText)">
            ${block.content || ""}
          </div>
          <button class="block-delete" onclick="window.noteEditor.deleteBlock('${block.id}')">×</button>
        </div>
      `,
      latex: () => `
        <div class="note-block latex-block" data-block-id="${block.id}" data-index="${index}">
          <div class="block-handle" draggable="true">⋮⋮</div>
          <div class="latex-edit-wrapper">
            <textarea class="latex-input" placeholder="Enter LaTeX formula..."
                      onblur="window.noteEditor.updateBlockContent('${block.id}', this.value)">${block.content || ""}</textarea>
            <div class="latex-preview"></div>
          </div>
          <button class="block-delete" onclick="window.noteEditor.deleteBlock('${block.id}')">×</button>
        </div>
      `,
      image: () => `
        <div class="note-block image-block" data-block-id="${block.id}" data-index="${index}">
          <div class="block-handle" draggable="true">⋮⋮</div>
          ${block.content ? `
            <img src="${block.content}" alt="${block.metadata?.caption || ''}" />
            <input type="text" class="image-caption" placeholder="Add caption..."
                   value="${block.metadata?.caption || ''}"
                   onblur="window.noteEditor.updateBlockMetadata('${block.id}', 'caption', this.value)">
          ` : `
            <div class="image-upload-area" onclick="window.noteEditor.uploadImage('${block.id}')">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span>Click to upload image</span>
            </div>
          `}
          <button class="block-delete" onclick="window.noteEditor.deleteBlock('${block.id}')">×</button>
        </div>
      `,
      video: () => `
        <div class="note-block video-block" data-block-id="${block.id}" data-index="${index}">
          <div class="block-handle" draggable="true">⋮⋮</div>
          ${block.content ? `
            <iframe src="${this.getEmbedUrl(block.content)}" frameborder="0" allowfullscreen></iframe>
          ` : `
            <div class="video-input-area">
              <input type="text" placeholder="Paste YouTube or video URL..."
                     onchange="window.noteEditor.updateBlockContent('${block.id}', this.value)">
            </div>
          `}
          <button class="block-delete" onclick="window.noteEditor.deleteBlock('${block.id}')">×</button>
        </div>
      `,
      code: () => `
        <div class="note-block code-block" data-block-id="${block.id}" data-index="${index}">
          <div class="block-handle" draggable="true">⋮⋮</div>
          <div class="code-header">
            <select class="code-language" onchange="window.noteEditor.updateBlockMetadata('${block.id}', 'language', this.value)">
              <option value="javascript" ${block.metadata?.language === 'javascript' ? 'selected' : ''}>JavaScript</option>
              <option value="python" ${block.metadata?.language === 'python' ? 'selected' : ''}>Python</option>
              <option value="java" ${block.metadata?.language === 'java' ? 'selected' : ''}>Java</option>
              <option value="cpp" ${block.metadata?.language === 'cpp' ? 'selected' : ''}>C++</option>
              <option value="sql" ${block.metadata?.language === 'sql' ? 'selected' : ''}>SQL</option>
            </select>
          </div>
          <textarea class="code-input" placeholder="Enter code..."
                    onblur="window.noteEditor.updateBlockContent('${block.id}', this.value)">${block.content || ""}</textarea>
          <button class="block-delete" onclick="window.noteEditor.deleteBlock('${block.id}')">×</button>
        </div>
      `,
      link: () => `
        <div class="note-block link-block" data-block-id="${block.id}" data-index="${index}">
          <div class="block-handle" draggable="true">⋮⋮</div>
          <input type="text" class="link-input" placeholder="URL" value="${block.content || ''}"
                 onblur="window.noteEditor.updateBlockContent('${block.id}', this.value)">
          <input type="text" class="link-title" placeholder="Link title" value="${block.metadata?.title || ''}"
                 onblur="window.noteEditor.updateBlockMetadata('${block.id}', 'title', this.value)">
          ${block.content ? `<a href="${block.content}" target="_blank" class="link-preview">${block.metadata?.title || block.content}</a>` : ''}
          <button class="block-delete" onclick="window.noteEditor.deleteBlock('${block.id}')">×</button>
        </div>
      `,
      highlight: () => `
        <div class="note-block highlight-block" data-block-id="${block.id}" data-index="${index}">
          <div class="block-handle" draggable="true">⋮⋮</div>
          <div class="highlight-content">
            <div class="highlight-source">From ${block.metadata?.originalSource?.type || 'learning content'}</div>
            <div class="highlight-text">${block.content || ""}</div>
          </div>
          <button class="block-delete" onclick="window.noteEditor.deleteBlock('${block.id}')">×</button>
        </div>
      `,
    };

    return (blockHtml[block.type] || blockHtml.text)();
  }

  /**
   * Add a new block
   */
  async addBlock(type) {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/notes/${this.currentNoteId}/blocks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, content: "" }),
      });

      if (response.ok) {
        const data = await response.json();
        this.blocks = data.data.note.blocks;
        this.refreshBlocksUI();
      }
    } catch (error) {
      console.error("Error adding block:", error);
    }
  }

  /**
   * Update block content
   */
  async updateBlockContent(blockId, content) {
    try {
      const token = localStorage.getItem("token");
      await fetch(`http://localhost:5000/api/notes/${this.currentNoteId}/blocks/${blockId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      // Update local state
      const block = this.blocks.find((b) => b.id === blockId);
      if (block) block.content = content;

      // Re-render LaTeX if applicable
      this.renderLatexBlocks();
    } catch (error) {
      console.error("Error updating block:", error);
    }
  }

  /**
   * Update block metadata
   */
  async updateBlockMetadata(blockId, key, value) {
    try {
      const token = localStorage.getItem("token");
      await fetch(`http://localhost:5000/api/notes/${this.currentNoteId}/blocks/${blockId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ metadata: { [key]: value } }),
      });
    } catch (error) {
      console.error("Error updating block metadata:", error);
    }
  }

  /**
   * Delete a block
   */
  async deleteBlock(blockId) {
    if (!confirm("Delete this block?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/notes/${this.currentNoteId}/blocks/${blockId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        this.blocks = data.data.note.blocks;
        this.refreshBlocksUI();
      }
    } catch (error) {
      console.error("Error deleting block:", error);
    }
  }

  /**
   * Update note title
   */
  async updateTitle(title) {
    try {
      const token = localStorage.getItem("token");
      await fetch(`http://localhost:5000/api/notes/${this.currentNoteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title }),
      });
    } catch (error) {
      console.error("Error updating title:", error);
    }
  }

  /**
   * Delete the current note
   */
  async deleteNote() {
    if (!confirm("Delete this note? This cannot be undone.")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/notes/${this.currentNoteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        this.currentNoteId = null;
        this.blocks = [];
        this.loadNotes();
      }
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  }

  /**
   * Toggle star on a note
   */
  async toggleStar(noteId) {
    try {
      const token = localStorage.getItem("token");
      await fetch(`http://localhost:5000/api/notes/${noteId}/star`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      this.loadNotes();
    } catch (error) {
      console.error("Error toggling star:", error);
    }
  }

  /**
   * Upload image for a block
   */
  uploadImage(blockId) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        await this.updateBlockContent(blockId, event.target.result);
        this.refreshBlocksUI();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  /**
   * Get embed URL for video
   */
  getEmbedUrl(url) {
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return url;
  }

  /**
   * Refresh blocks UI
   */
  refreshBlocksUI() {
    const container = document.getElementById("blocks-container");
    if (container) {
      container.innerHTML = this.blocks.map((block, index) => this.renderBlock(block, index)).join("");
      this.renderLatexBlocks();
    }
  }

  /**
   * Render LaTeX in preview areas
   */
  renderLatexBlocks() {
    document.querySelectorAll(".latex-block").forEach((block) => {
      const input = block.querySelector(".latex-input");
      const preview = block.querySelector(".latex-preview");
      if (input && preview && input.value) {
        try {
          preview.innerHTML = window.katex
            ? window.katex.renderToString(input.value, { displayMode: true, throwOnError: false })
            : `$$${input.value}$$`;
        } catch (e) {
          preview.innerHTML = `<span class="latex-error">${e.message}</span>`;
        }
      }
    });
  }

  /**
   * Inject styles
   */
  injectStyles() {
    if (document.getElementById("note-editor-styles")) return;

    const styles = document.createElement("style");
    styles.id = "note-editor-styles";
    styles.textContent = `
      .notes-panel {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        overflow: hidden;
      }

      .notes-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .notes-header h4 {
        margin: 0;
      }

      .btn-icon {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 0.25rem;
      }

      .btn-icon:hover {
        color: var(--primary-color);
      }

      .notes-list {
        max-height: 400px;
        overflow-y: auto;
      }

      .notes-empty {
        padding: 2rem;
        text-align: center;
        color: var(--text-secondary);
      }

      .note-card {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        cursor: pointer;
        transition: background 0.2s;
      }

      .note-card:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .note-card.starred {
        border-left: 3px solid var(--primary-color);
      }

      .note-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.25rem;
      }

      .note-title {
        font-weight: 500;
      }

      .star-btn {
        background: none;
        border: none;
        color: var(--primary-color);
        cursor: pointer;
        font-size: 1rem;
      }

      .note-preview {
        font-size: 0.8rem;
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .note-meta {
        display: flex;
        gap: 1rem;
        font-size: 0.75rem;
        color: var(--text-muted, #666);
        margin-top: 0.25rem;
      }

      .note-editor {
        padding: 1rem;
      }

      .editor-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .btn-back {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
      }

      .note-title-input {
        flex: 1;
        background: transparent;
        border: none;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary);
      }

      .note-title-input:focus {
        outline: none;
      }

      .btn-delete {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
      }

      .btn-delete:hover {
        color: #ef4444;
      }

      .editor-toolbar {
        display: flex;
        gap: 0.25rem;
        padding: 0.5rem;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        margin-bottom: 1rem;
      }

      .toolbar-btn {
        padding: 0.5rem;
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        border-radius: 4px;
      }

      .toolbar-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-primary);
      }

      .blocks-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .note-block {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        border: 1px solid transparent;
      }

      .note-block:hover {
        border-color: rgba(255, 255, 255, 0.1);
      }

      .block-handle {
        cursor: grab;
        color: var(--text-muted);
        user-select: none;
      }

      .block-content {
        flex: 1;
        min-height: 1.5em;
        outline: none;
      }

      .block-delete {
        position: absolute;
        top: 0.25rem;
        right: 0.25rem;
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .note-block:hover .block-delete {
        opacity: 1;
      }

      .block-delete:hover {
        color: #ef4444;
      }

      .latex-edit-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .latex-input {
        width: 100%;
        padding: 0.5rem;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        color: var(--text-primary);
        font-family: monospace;
      }

      .latex-preview {
        padding: 0.5rem;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 4px;
        text-align: center;
      }

      .latex-error {
        color: #ef4444;
        font-size: 0.8rem;
      }

      .image-block img {
        max-width: 100%;
        border-radius: 4px;
      }

      .image-upload-area {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        border: 2px dashed rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        cursor: pointer;
        color: var(--text-secondary);
        flex: 1;
      }

      .image-upload-area:hover {
        border-color: var(--primary-color);
      }

      .image-caption {
        width: 100%;
        margin-top: 0.5rem;
        padding: 0.25rem;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        color: var(--text-secondary);
        font-size: 0.8rem;
        text-align: center;
      }

      .video-block iframe {
        width: 100%;
        aspect-ratio: 16/9;
        border-radius: 4px;
      }

      .video-input-area input {
        width: 100%;
        padding: 0.5rem;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        color: var(--text-primary);
      }

      .code-block {
        flex-direction: column;
      }

      .code-header {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .code-language {
        padding: 0.25rem 0.5rem;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        color: var(--text-secondary);
        font-size: 0.75rem;
      }

      .code-input {
        width: 100%;
        min-height: 100px;
        padding: 0.5rem;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        color: var(--text-primary);
        font-family: monospace;
        resize: vertical;
      }

      .link-block {
        flex-direction: column;
      }

      .link-input, .link-title {
        width: 100%;
        padding: 0.5rem;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        color: var(--text-primary);
        margin-bottom: 0.5rem;
      }

      .link-preview {
        color: var(--primary-color);
        text-decoration: none;
      }

      .link-preview:hover {
        text-decoration: underline;
      }

      .highlight-block {
        border-left: 3px solid var(--primary-color);
      }

      .highlight-source {
        font-size: 0.75rem;
        color: var(--text-muted);
        margin-bottom: 0.25rem;
      }

      .highlight-text {
        font-style: italic;
      }
    `;
    document.head.appendChild(styles);
  }
}

// Create global instance
window.noteEditor = new NoteEditor("notes-container");

export default NoteEditor;
