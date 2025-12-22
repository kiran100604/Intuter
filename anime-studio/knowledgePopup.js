/**
 * Knowledge Popup Component
 * Shows concept information when clicking/hovering on knowledge tags
 * Works across all modes (Learning, Reading, Revision)
 */

export class KnowledgePopup {
  constructor() {
    this.sessionId = localStorage.getItem("sessionId");
    this.cache = new Map(); // Cache fetched nodes
    this.injectStyles();
    this.setupEventListeners();
  }

  /**
   * Setup global event listeners for tag clicks
   */
  setupEventListeners() {
    document.addEventListener("click", (e) => {
      // Check if clicking on a knowledge tag
      const tag = e.target.closest(".knowledge-tag, [data-tag]");
      if (tag) {
        e.preventDefault();
        const tagId = tag.dataset.tag || tag.textContent.trim();
        this.showPopup(tagId, e.clientX, e.clientY);
        return;
      }

      // Check if clicking on a tag pattern in text (#concept-xxx)
      if (e.target.tagName === "SPAN" && e.target.textContent.match(/^#[\w-]+$/)) {
        e.preventDefault();
        this.showPopup(e.target.textContent, e.clientX, e.clientY);
        return;
      }

      // Close popup if clicking outside
      const popup = document.querySelector(".knowledge-popup");
      if (popup && !popup.contains(e.target)) {
        popup.remove();
      }
    });

    // Also handle keyboard escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelector(".knowledge-popup")?.remove();
      }
    });
  }

  /**
   * Show popup for a knowledge tag
   */
  async showPopup(tagId, x, y) {
    // Remove any existing popup
    document.querySelector(".knowledge-popup")?.remove();

    // Normalize tagId
    const normalizedTagId = tagId.startsWith("#") ? tagId : `#${tagId}`;

    // Show loading popup
    const popup = this.createPopupElement(x, y);
    popup.innerHTML = `
      <div class="popup-loading">
        <div class="spinner"></div>
        <span>Loading concept...</span>
      </div>
    `;
    document.body.appendChild(popup);

    // Position the popup
    this.positionPopup(popup, x, y);

    try {
      const node = await this.fetchKnowledgeNode(normalizedTagId);
      if (node) {
        this.renderPopupContent(popup, node);
      } else {
        this.renderNotFound(popup, normalizedTagId);
      }
    } catch (error) {
      console.error("Error fetching knowledge node:", error);
      this.renderError(popup);
    }
  }

  /**
   * Fetch knowledge node from API or cache
   */
  async fetchKnowledgeNode(tagId) {
    // Check cache first
    const cacheKey = `${this.sessionId}:${tagId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const token = localStorage.getItem("token");
      const encodedTagId = encodeURIComponent(tagId.replace("#", ""));
      const response = await fetch(
        `http://localhost:5000/api/knowledge/tag/${this.sessionId}/${encodedTagId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.cache.set(cacheKey, data.data.node);
        return data.data.node;
      }

      return null;
    } catch (error) {
      console.error("Error fetching node:", error);
      return null;
    }
  }

  /**
   * Create popup element
   */
  createPopupElement(x, y) {
    const popup = document.createElement("div");
    popup.className = "knowledge-popup";
    return popup;
  }

  /**
   * Position popup near click location
   */
  positionPopup(popup, x, y) {
    const margin = 10;
    const rect = popup.getBoundingClientRect();

    // Position below and to the right by default
    let left = x + margin;
    let top = y + margin;

    // Adjust if going off screen
    if (left + 350 > window.innerWidth) {
      left = x - 350 - margin;
    }
    if (top + 300 > window.innerHeight) {
      top = y - 300 - margin;
    }

    popup.style.left = `${Math.max(margin, left)}px`;
    popup.style.top = `${Math.max(margin, top)}px`;
  }

  /**
   * Render popup content
   */
  renderPopupContent(popup, node) {
    const typeIcons = {
      concept: "💡",
      formula: "📐",
      definition: "📖",
      example: "📝",
      tip: "💪",
    };

    const typeColors = {
      concept: "#f97316",
      formula: "#3b82f6",
      definition: "#10b981",
      example: "#8b5cf6",
      tip: "#f59e0b",
    };

    popup.innerHTML = `
      <div class="popup-header" style="border-color: ${typeColors[node.nodeType] || "#666"}">
        <span class="popup-type-icon">${typeIcons[node.nodeType] || "📌"}</span>
        <span class="popup-title">${node.name}</span>
        <span class="popup-tag">${node.tagId}</span>
        <button class="popup-close" onclick="this.closest('.knowledge-popup').remove()">×</button>
      </div>

      <div class="popup-body">
        ${node.explanation ? `
          <div class="popup-section">
            <div class="popup-section-title">Explanation</div>
            <div class="popup-text">${this.renderMarkdown(node.explanation)}</div>
          </div>
        ` : ""}

        ${node.formalDefinition ? `
          <div class="popup-section">
            <div class="popup-section-title">Formal Definition</div>
            <div class="popup-text formal">${node.formalDefinition}</div>
          </div>
        ` : ""}

        ${node.expression ? `
          <div class="popup-section">
            <div class="popup-section-title">Formula</div>
            <div class="popup-formula">$$${node.expression}$$</div>
          </div>
        ` : ""}

        ${node.relatedNodes && node.relatedNodes.length > 0 ? `
          <div class="popup-section">
            <div class="popup-section-title">Related Concepts</div>
            <div class="popup-related">
              ${node.relatedNodes.map(tag => `
                <span class="related-tag" onclick="window.knowledgePopup.showPopup('${tag}', event.clientX, event.clientY)">${tag}</span>
              `).join("")}
            </div>
          </div>
        ` : ""}

        ${node.sourceSubtopic ? `
          <div class="popup-source">
            Learned in: <a href="#" onclick="window.knowledgePopup.navigateToSubtopic(${node.sourceSubtopicId})">${node.sourceSubtopic.name}</a>
          </div>
        ` : ""}
      </div>

      <div class="popup-footer">
        <div class="popup-mastery">
          <span>Mastery:</span>
          <div class="mastery-bar">
            <div class="mastery-fill" style="width: ${node.masteryLevel || 0}%"></div>
          </div>
          <span>${node.masteryLevel || 0}%</span>
        </div>
        <div class="popup-actions">
          <button class="popup-btn" onclick="window.knowledgePopup.addToNotes('${node.tagId}')">
            Save to Notes
          </button>
        </div>
      </div>
    `;

    // Re-render LaTeX
    if (window.renderMathInElement) {
      window.renderMathInElement(popup, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    }

    // Re-position after content is loaded
    const rect = popup.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      popup.style.top = `${Math.max(10, window.innerHeight - rect.height - 10)}px`;
    }
  }

  /**
   * Render not found state
   */
  renderNotFound(popup, tagId) {
    popup.innerHTML = `
      <div class="popup-header popup-header-warning">
        <span class="popup-type-icon">❓</span>
        <span class="popup-title">Concept Not Found</span>
        <button class="popup-close" onclick="this.closest('.knowledge-popup').remove()">×</button>
      </div>
      <div class="popup-body">
        <p>The concept <code>${tagId}</code> hasn't been learned yet.</p>
        <p class="popup-hint">This concept may be introduced in a later topic, or you can request it to be added.</p>
      </div>
      <div class="popup-footer">
        <button class="popup-btn" onclick="window.knowledgePopup.requestConcept('${tagId}')">
          Request This Concept
        </button>
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderError(popup) {
    popup.innerHTML = `
      <div class="popup-header popup-header-error">
        <span class="popup-type-icon">⚠️</span>
        <span class="popup-title">Error</span>
        <button class="popup-close" onclick="this.closest('.knowledge-popup').remove()">×</button>
      </div>
      <div class="popup-body">
        <p>Failed to load concept information. Please try again.</p>
      </div>
    `;
  }

  /**
   * Navigate to a subtopic
   */
  navigateToSubtopic(subtopicId) {
    document.querySelector(".knowledge-popup")?.remove();
    // Trigger subtopic selection
    const subtopicEl = document.querySelector(`.subtopic-item[data-id="${subtopicId}"]`);
    if (subtopicEl) {
      subtopicEl.click();
    }
  }

  /**
   * Add concept to notes
   */
  async addToNotes(tagId) {
    try {
      const node = this.cache.get(`${this.sessionId}:${tagId}`);
      if (!node) return;

      const content = `**${node.name}** (${tagId})\n\n${node.explanation || node.formalDefinition || ""}`;

      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/notes/quick-save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          content,
          sourceType: "knowledge_node",
        }),
      });

      if (response.ok) {
        this.showToast("Saved to notes!");
        document.querySelector(".knowledge-popup")?.remove();
      }
    } catch (error) {
      console.error("Error saving to notes:", error);
    }
  }

  /**
   * Request a concept to be added
   */
  async requestConcept(tagId) {
    // Open the content request modal with pre-filled info
    if (window.contentFeedback) {
      window.contentFeedback.openSuggestModal();
      // Pre-fill the description
      setTimeout(() => {
        const desc = document.getElementById("request-description");
        if (desc) {
          desc.value = `Please explain the concept: ${tagId}`;
        }
      }, 100);
    }
    document.querySelector(".knowledge-popup")?.remove();
  }

  /**
   * Render markdown
   */
  renderMarkdown(text) {
    if (window.marked) {
      return window.marked.parse(text || "");
    }
    return text || "";
  }

  /**
   * Show toast message
   */
  showToast(message) {
    const toast = document.createElement("div");
    toast.className = "knowledge-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  /**
   * Process content to make tags clickable
   */
  static processTagsInContent(container) {
    // Find all text nodes that contain tag patterns
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          return node.textContent.includes("#") && node.textContent.match(/#[\w-]+/)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      }
    );

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach((textNode) => {
      const text = textNode.textContent;
      const parts = text.split(/(#[\w-]+)/g);

      if (parts.length > 1) {
        const fragment = document.createDocumentFragment();
        parts.forEach((part) => {
          if (part.match(/^#[\w-]+$/)) {
            const span = document.createElement("span");
            span.className = "knowledge-tag";
            span.dataset.tag = part;
            span.textContent = part;
            fragment.appendChild(span);
          } else {
            fragment.appendChild(document.createTextNode(part));
          }
        });
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    });
  }

  /**
   * Inject styles
   */
  injectStyles() {
    if (document.getElementById("knowledge-popup-styles")) return;

    const styles = document.createElement("style");
    styles.id = "knowledge-popup-styles";
    styles.textContent = `
      .knowledge-tag {
        background: rgba(249, 115, 22, 0.15);
        color: var(--primary-color, #f97316);
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        font-family: monospace;
        font-size: 0.9em;
      }

      .knowledge-tag:hover {
        background: rgba(249, 115, 22, 0.3);
        text-decoration: underline;
      }

      .knowledge-popup {
        position: fixed;
        width: 350px;
        max-height: 400px;
        background: var(--bg-secondary, #1e1e2e);
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        z-index: 1001;
        display: flex;
        flex-direction: column;
        animation: popupIn 0.2s ease;
      }

      @keyframes popupIn {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .popup-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 3px solid var(--primary-color, #f97316);
      }

      .popup-header-warning {
        border-color: #f59e0b;
      }

      .popup-header-error {
        border-color: #ef4444;
      }

      .popup-type-icon {
        font-size: 1.25rem;
      }

      .popup-title {
        flex: 1;
        font-weight: 600;
        font-size: 1rem;
      }

      .popup-tag {
        font-size: 0.75rem;
        color: var(--text-secondary);
        font-family: monospace;
        background: rgba(0, 0, 0, 0.2);
        padding: 0.2rem 0.4rem;
        border-radius: 4px;
      }

      .popup-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }

      .popup-close:hover {
        color: var(--text-primary);
      }

      .popup-body {
        padding: 1rem;
        overflow-y: auto;
        flex: 1;
      }

      .popup-section {
        margin-bottom: 1rem;
      }

      .popup-section:last-child {
        margin-bottom: 0;
      }

      .popup-section-title {
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--text-secondary);
        margin-bottom: 0.5rem;
        font-weight: 600;
      }

      .popup-text {
        font-size: 0.9rem;
        line-height: 1.5;
      }

      .popup-text.formal {
        font-style: italic;
        background: rgba(0, 0, 0, 0.2);
        padding: 0.5rem;
        border-radius: 4px;
      }

      .popup-formula {
        background: rgba(0, 0, 0, 0.2);
        padding: 0.75rem;
        border-radius: 4px;
        text-align: center;
        overflow-x: auto;
      }

      .popup-related {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .related-tag {
        background: rgba(255, 255, 255, 0.05);
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
        cursor: pointer;
        color: var(--primary-color);
      }

      .related-tag:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .popup-source {
        font-size: 0.8rem;
        color: var(--text-secondary);
        padding-top: 0.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .popup-source a {
        color: var(--primary-color);
        text-decoration: none;
      }

      .popup-source a:hover {
        text-decoration: underline;
      }

      .popup-footer {
        padding: 0.75rem 1rem;
        background: rgba(0, 0, 0, 0.2);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
      }

      .popup-mastery {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
      }

      .mastery-bar {
        width: 60px;
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
      }

      .mastery-fill {
        height: 100%;
        background: linear-gradient(90deg, #10b981, #34d399);
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      .popup-actions {
        display: flex;
        gap: 0.5rem;
      }

      .popup-btn {
        padding: 0.4rem 0.75rem;
        background: var(--primary-color, #f97316);
        border: none;
        border-radius: 4px;
        color: white;
        font-size: 0.8rem;
        cursor: pointer;
        transition: background 0.2s;
      }

      .popup-btn:hover {
        opacity: 0.9;
      }

      .popup-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        gap: 0.75rem;
        color: var(--text-secondary);
      }

      .spinner {
        width: 24px;
        height: 24px;
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-top-color: var(--primary-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .popup-hint {
        font-size: 0.85rem;
        color: var(--text-secondary);
        font-style: italic;
      }

      .knowledge-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 0.75rem 1.25rem;
        border-radius: 8px;
        z-index: 1002;
        animation: slideInRight 0.3s ease;
      }

      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(styles);
  }
}

// Create global instance
window.knowledgePopup = new KnowledgePopup();

export default KnowledgePopup;
